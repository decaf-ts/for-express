/**
 * @module for-express/decaf-model/FromModelController
 * @summary Express bridge between Decaf models and generated model controllers.
 * @description Provides the {@link ExpressRoute} shape and the
 * {@link FromModelController} orchestrator that turns a tracked model into
 * concrete Express route registrations, plus the {@link resolveRouteArgs}
 * helper that binds an incoming Express request to the positional arguments
 * the framework-agnostic for-http `ServerRoute` implementations expect. This
 * module replaces Nest's parameter decorators (`@Param`, `@Query`,
 * `@DecafBody`, `@DecafQuery`) with explicit request-to-argument resolution,
 * and is consumed by {@link module:for-express/decaf-model/DecafModelModule |
 * DecafModelModule.forRoot} when building the per-flavour router.
 */

import type { Request } from "express";
import {
  ModelService,
  type Repo,
  Repository,
  Service,
} from "@decaf-ts/core";
import { Model, ModelConstructor } from "@decaf-ts/decorator-validation";
import { Logging, toKebabCase } from "@decaf-ts/logging";
import { DBKeys } from "@decaf-ts/db-decorators";
import { Metadata } from "@decaf-ts/decoration";
import {
  ModelControllerFactory,
  type AuthConfig,
  type ModelControllerFactoryConfig,
  type ServerRoute,
} from "@decaf-ts/for-http/server";

import { DECAF_CONTROLLER_CONFIG } from "../constants";
import { DecafModelController } from "../controllers";

/**
 * A single Express route registration produced from a Decaf model.
 *
 * @interface ExpressRoute
 * @template T - The model type the route operates on; defaults to
 * {@link Model<boolean>}.
 * @description Describes one route emitted by `FromModelController.create`.
 * The `implementation` is the framework-agnostic function from the for-http
 * `ModelControllerFactory` routes and is invoked with arguments resolved by
 * {@link resolveRouteArgs}, bound to a generated
 * {@link DecafModelController} instance.
 * @summary Framework-agnostic route descriptor for an Express registration.
 * @property {("GET" | "POST" | "PUT" | "PATCH" | "DELETE")} method - HTTP
 * verb of the route.
 * @property {string} path - Route path relative to the model's base path
 * (e.g. `""`, `"bulk"`, `"find/:value"`).
 * @property {boolean} requiresAuth - `false` only when the route opted out of
 * authentication (defaults to `true`).
 * @property {ModelConstructor<T>} model - The model constructor the route
 * was generated from.
 * @property {AuthConfig} [auth] - Merged {@link AuthConfig} from the
 * controller configuration, consumed by the {@link AuthInterceptor}.
 * @property {function} implementation - The route implementation, invoked
 * with `this` bound to a {@link DecafModelController} instance.
 * @category Decaf Model Routes
 */
export type ExpressRoute<T extends Model<boolean> = Model<boolean>> = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  requiresAuth: boolean;
  model: ModelConstructor<T>;
  auth?: AuthConfig;
  implementation: (...args: any[]) => any;
};

/**
 * Pagination/query details extracted from a request's query string.
 *
 * @typedef Details
 * @description Collected by `queryDetails` and forwarded to route
 * implementations as the final argument where the route accepts it.
 * @summary Optional direction/limit/offset/bookmark query parameters.
 * @property {string} [direction] - Sort direction for list-like queries.
 * @property {number} [limit] - Maximum number of records to return.
 * @property {number} [offset] - Number of records to skip.
 * @property {any} [bookmark] - Pagination bookmark for bookmark-based
 * adapters.
 * @category Decaf Model Routes
 */
type Details = {
  direction?: string;
  limit?: number;
  offset?: number;
  bookmark?: any;
};

/**
 * Coerces a string to a number when possible, leaving other values untouched.
 *
 * @function coerce
 * @description Used for path parameters and query values that arrive as
 * strings from the URL; empty strings are preserved as-is.
 * @summary Numeric coercion helper for request-supplied values.
 * @param {any} value - The raw value (typically from `req.params`/`req.query`).
 * @return {any} The number form of the string, or the original value when not
 * numeric.
 * @category Decaf Model Routes
 */
function coerce(value: any): any {
  if (typeof value !== "string") return value;
  if (value.trim() === "") return value;
  const asNumber = Number(value);
  return Number.isNaN(asNumber) ? value : asNumber;
}

/**
 * Extracts the parameter names from a normalized route path.
 *
 * @function pathParamNames
 * @description Segments starting with `:` (named parameters) or `*`
 * (wildcards) are stripped of their prefix and returned in order.
 * @summary Collects `:param`/`*param` names from a route path.
 * @param {string} path - The route path (e.g. `"find/:value"`).
 * @return {string[]} The parameter names in path order.
 * @category Decaf Model Routes
 */
function pathParamNames(path: string): string[] {
  return path
    .split("/")
    .filter((segment) => segment.startsWith(":") || segment.startsWith("*"))
    .map((segment) => segment.slice(1));
}

/**
 * Extracts pagination details from an Express query object.
 *
 * @function queryDetails
 * @description Recognizes `direction`, `limit`, `offset`, and `bookmark`
 * keys, coercing numeric ones with {@link coerce}.
 * @summary Maps known query-string keys to a {@link Details} object.
 * @param {Record<string, any>} query - The request's query object.
 * @return {Details} The recognized details, empty when none are present.
 * @category Decaf Model Routes
 */
function queryDetails(query: Record<string, any>): Details {
  const details: Details = {};
  if (query.direction !== undefined) details.direction = query.direction;
  if (query.limit !== undefined) details.limit = coerce(query.limit);
  if (query.offset !== undefined) details.offset = coerce(query.offset);
  if (query.bookmark !== undefined) details.bookmark = coerce(query.bookmark);
  return details;
}

/**
 * Binds the incoming Express request to the positional arguments the
 * framework-agnostic {@link ServerRoute} implementation expects.
 *
 * This mirrors the parameter decorators the Nest integration attaches to the
 * generated controller methods (`@Param`, `@Query`, `@DecafBody`, `@DecafQuery`),
 * but resolves them explicitly from the Express request.
 *
 * @function resolveRouteArgs
 * @description Handles the standard model routes (create/createAll, read,
 * update, delete, bulk, statement, listBy, paginateBy, find, page, findOneBy,
 * findBy, grouping aggregations, and dynamic `query/` routes) as well as
 * custom `@route` methods, falling back to positional path parameters when no
 * specific shape matches.
 * @summary Maps an Express request to the argument list of a route
 * implementation.
 * @param {{method: string, path: string}} route - Minimal route descriptor:
 * HTTP method (e.g. `"GET"`) and the route path (e.g. `"find/:value"`).
 * @param {Request} req - The incoming Express request.
 * @return {any[]} The positional arguments to apply to the route
 * implementation.
 * @category Decaf Model Routes
 */
export function resolveRouteArgs(
  route: { method: string; path: string },
  req: Request
): any[] {
  const normalizedPath = route.path.replace(/^\/+|\/+$/g, "");
  const method = route.method;
  const params = (req.params ?? {}) as Record<string, any>;
  const query = (req.query ?? {}) as Record<string, any>;
  const body = (req as any).body;
  const names = pathParamNames(normalizedPath);
  const pathValues = names.map((name) => coerce(params[name]));
  const details = queryDetails(query);
  const hasDetails = Object.keys(details).length > 0;

  if (method === "POST" && normalizedPath === "") return [body];
  if (method === "POST" && normalizedPath === "bulk") return [body];
  if (method === "PUT" && normalizedPath === "bulk") return [body];
  if (method === "GET" && normalizedPath === "bulk")
    return [normalizeBulkIds(query.ids)];
  if (method === "DELETE" && normalizedPath === "bulk")
    return [normalizeBulkIds(query.ids)];

  if (method === "GET" && normalizedPath === "statement/:method/*args") {
    const args = Array.isArray(params.args)
      ? params.args
      : params.args !== undefined
        ? [params.args]
        : [];
    const methodName = params.method as string;
    const coercedArgs = args.map((arg) => coerce(arg));
    const pathDirection = coercedArgs.length > 1 ? coercedArgs[1] : undefined;
    const resolved: Details = {
      ...details,
      direction: details.direction ?? (pathDirection as string | undefined),
    };
    return [methodName, coercedArgs, resolved];
  }

  if (method === "GET" && normalizedPath === "listBy/:key")
    return [pathValues[0], details];
  if (method === "GET" && normalizedPath === "paginateBy/:key/:page")
    return [pathValues[0], pathValues[1], details];
  if (method === "GET" && normalizedPath === "find/:value")
    return [pathValues[0], details];
  if (method === "GET" && normalizedPath === "page/:value")
    return [pathValues[0], details];
  if (method === "GET" && normalizedPath === "findOneBy/:key/:value")
    return [pathValues[0], pathValues[1]];
  if (method === "GET" && normalizedPath === "findBy/:key/:value")
    return [pathValues[0], pathValues[1]];

  const groupingRoutes = [
    "countOf/:field",
    "maxOf/:field",
    "minOf/:field",
    "avgOf/:field",
    "sumOf/:field",
    "distinctOf/:field",
    "groupOf/:field",
  ];
  if (method === "GET" && groupingRoutes.includes(normalizedPath))
    return [pathValues[0]];

  if (method === "GET" && normalizedPath.startsWith("query/")) {
    return hasDetails ? [...pathValues, details] : pathValues;
  }

  // Custom @route() methods.
  if (method === "POST" || method === "PUT") {
    return pathValues.length ? [body, ...pathValues] : [body];
  }
  if (method === "DELETE" || method === "GET") {
    return hasDetails && pathValues.length === 0
      ? [details]
      : pathValues;
  }

  return pathValues;
}

/**
 * Normalizes a bulk-operations `ids` argument to an array of ids.
 *
 * @function normalizeBulkIds
 * @description Accepts a repeated query parameter (`?ids=a&ids=b`), a single
 * value (`?ids=a`), or nothing; missing values become an empty array so bulk
 * routes can validate the input themselves.
 * @summary Coerces the `ids` query value into a string array.
 * @param {string | string[] | undefined | null} ids - Raw `ids` value from
 * the query string.
 * @return {string[]} The ids as an array (empty when none were supplied).
 * @category Decaf Model Routes
 */
function normalizeBulkIds(ids: string | string[] | undefined | null): string[] {
  if (Array.isArray(ids)) return ids;
  if (typeof ids === "string") return [ids];
  return [];
}

/**
 * Factory-style helper class that derives Express routes and controller
 * classes from Decaf models.
 *
 * @class FromModelController
 * @description Static-only utility consumed by
 * {@link module:for-express/decaf-model/DecafModelModule | DecafModelModule}.
 * It reuses the framework-agnostic for-http `ModelControllerFactory` to build
 * route implementations, wraps them in {@link ExpressRoute} descriptors, and
 * provides the concrete {@link DecafModelController} subclass the Express
 * handlers instantiate per request (replacing Nest's DI container).
 * @summary Bridge from Decaf models to Express route registrations.
 * @category Decaf Model Routes
 */
export class FromModelController {
  private static readonly log = Logging.for(FromModelController.name);

  /**
   * Resolves the persistence layer backing a model.
   *
   * @function getPersistence
   * @description Tries, in order: the registered {@link ModelService} singleton
   * (`Service.get`), the model service registry
   * (`ModelService.getService`), and finally the
   * {@link Repository.forModel | Repository}. This lets controllers work
   * whether or not services were auto-registered.
   * @summary Locates the `Repo`/`ModelService` for a model.
   * @template T - The model type; must extend {@link Model<boolean>}.
   * @param {ModelConstructor<T>} ModelClazz - The model constructor.
   * @return {Repo<T> | ModelService<T>} The resolved persistence layer.
   * @category Decaf Model Routes
   */
  static getPersistence<T extends Model<boolean>>(
    ModelClazz: ModelConstructor<T>
  ): Repo<T> | ModelService<T> {
    try {
      return Service.get<ModelService<T>>(ModelClazz);
    } catch {
      try {
        return ModelService.getService(ModelClazz) as ModelService<T>;
      } catch {
        return Repository.forModel(ModelClazz) as Repo<T>;
      }
    }
  }

  /**
   * Derives the identifier path segment and primary-key resolver for a model.
   *
   * @function getRouteParametersFromModel
   * @description Reads the model's primary key and, when present, its
   * composed-key metadata (`DBKeys.COMPOSED`) to build a path such as
   * `:id` or `:key1/:key2`, together with a `getPK` resolver that joins the
   * positional values using the composed separator.
   * @summary Builds the path parameter metadata for a model's primary key.
   * @template T - The model type.
   * @param {ModelConstructor<T>} ModelClazz - The model constructor.
   * @return {{path: string, description: string, getPK: function}} The
   * parameterized path, the model's description, and the primary-key resolver
   * joining path values into the model's id.
   * @category Decaf Model Routes
   */
  static getRouteParametersFromModel<T extends Model<any>>(
    ModelClazz: ModelConstructor<T>
  ): {
    path: string;
    description: string;
    getPK: (...params: Array<string | number>) => string;
  } {
    const pk = Model.pk(ModelClazz) as keyof Model<any>;
    const composed = Metadata.get(
      ModelClazz,
      Metadata.key(DBKeys.COMPOSED, pk)
    );
    const composedKeys = composed?.args ?? [];

    const uniqueKeys =
      Array.isArray(composedKeys) && composedKeys.length > 0
        ? Array.from(new Set([...composedKeys]))
        : Array.from(new Set([pk]));

    const description = Metadata.description(ModelClazz) ?? "";
    const path = `:${uniqueKeys.join("/:")}`;

    return {
      path,
      description,
      getPK: (...params: Array<string | number>) =>
        composed?.separator ? params.join(composed.separator) : params.join(""),
    };
  }

  /**
   * Builds the sorted list of Express route registrations for a model.
   *
   * @function create
   * @description Merges configuration from three sources (global defaults,
   * the `@controllerConfig` decorator metadata stored under
   * `DECAF_CONTROLLER_CONFIG`, and per-model module overrides), delegates to
   * the for-http `ModelControllerFactory.create` to produce the underlying
   * `ServerRoute` implementations, wraps them as {@link ExpressRoute}
   * descriptors sharing the merged {@link AuthConfig}, and sorts the routes
   * so more-specific paths (more literal segments, fewer parameters) register
   * before less-specific ones.
   * @summary Generates the `ExpressRoute` descriptors for a model.
   * @template T - The model type.
   * @param {ModelConstructor<T>} ModelConstr - The model constructor to build
   * routes for.
   * @param {Record<string, ModelControllerFactoryConfig>} [moduleConfigOverrides] - Per-model
   * configuration overrides keyed by model name, from the module options'
   * `controllerConfig`.
   * @param {Partial<ModelControllerFactoryConfig>} [globalDefaults] - Default
   * configuration applied to every model (e.g. aggregation toggles).
   * @return {Array.<ExpressRoute<T>>} The sorted route registrations.
   * @category Decaf Model Routes
   */
  static create<T extends Model<any>>(
    ModelConstr: ModelConstructor<T>,
    moduleConfigOverrides?: Record<string, ModelControllerFactoryConfig>,
    globalDefaults?: Partial<ModelControllerFactoryConfig>
  ): ExpressRoute<T>[] {
    const log = FromModelController.log.for(FromModelController.create);
    const tableName = Model.tableName(ModelConstr);
    const routePath = toKebabCase(tableName);
    const persistence = FromModelController.getPersistence(ModelConstr);

    const factoryPersistence =
      persistence instanceof ModelService ? persistence.repo : persistence;

    const decoratorConfig = Metadata.get(
      ModelConstr,
      Metadata.key(DECAF_CONTROLLER_CONFIG)
    ) as ModelControllerFactoryConfig | undefined;
    const moduleOverride = moduleConfigOverrides?.[ModelConstr.name];
    const mergedConfig: ModelControllerFactoryConfig = {
      ...(globalDefaults || {}),
      ...(decoratorConfig || {}),
      ...(moduleOverride || {}),
    };

    const FactoryController = ModelControllerFactory.create<T>(
      ModelConstr,
      factoryPersistence,
      mergedConfig
    );
    const factoryRoutes = ((FactoryController as any).__routes__ ??
      []) as ServerRoute[];

    const authConfig: AuthConfig | undefined = mergedConfig.auth;

    const routes = factoryRoutes.map((route) => ({
      method: route.method as ExpressRoute<T>["method"],
      path: route.path,
      requiresAuth: route.requiresAuth !== false,
      model: ModelConstr,
      auth: authConfig,
      implementation: route.implementation as (...args: any[]) => any,
    }));

    const sorted = [...routes].sort((a, b) => {
      const aSegments = a.path.split("/").filter(Boolean);
      const bSegments = b.path.split("/").filter(Boolean);
      const aParamCount = aSegments.filter((s) => s.startsWith(":")).length;
      const bParamCount = bSegments.filter((s) => s.startsWith(":")).length;
      const aLiteralCount = aSegments.length - aParamCount;
      const bLiteralCount = bSegments.length - bParamCount;
      if (aLiteralCount !== bLiteralCount)
        return bLiteralCount - aLiteralCount;
      if (aParamCount !== bParamCount) return aParamCount - bParamCount;
      return 0;
    });

    log.debug(
      `Created controller for model: ${ModelConstr.name} route: /${routePath} with ${sorted.length} routes`
    );

    return sorted;
  }

  /**
   * Builds a concrete {@link DecafModelController} subclass for a model.
   *
   * The framework-agnostic `ModelControllerFactory` produces route
   * implementations that rely on `this.ctx`/`this.persistence`, so Express
   * instantiates them through this class instead of Nest's DI container.
    *
    * @function createControllerClass
    * @summary Produces the per-request controller constructor for a model.
    * @template T - The model type.
    * @param {ModelConstructor<T>} ModelConstr - The model constructor the
    * controller operates on.
    * @return {function(new:DecafModelController<T>)} A controller
    * class constructor accepting the {@link DecafRequestContext}.
    * @category Decaf Model Routes
    */
  static createControllerClass<T extends Model<any>>(
    ModelConstr: ModelConstructor<T>
  ): new (context: any) => DecafModelController<T> {
    return class DynamicModelController extends DecafModelController<T> {
      override get class(): ModelConstructor<T> {
        return ModelConstr;
      }

      constructor(context: any) {
        super(context, ModelConstr.name);
      }
    };
  }

  /**
   * Instantiates a generated controller bound to the supplied request context
   * and returns the callable for the given route.
   *
   * @function createHandler
   * @summary Binds a route implementation to a fresh controller instance.
   * @param {ExpressRoute<any>} route - The route whose implementation should
   * be invoked.
   * @param {function(new:DecafModelController<any>)} ControllerClass - The
   * controller class produced by {@link FromModelController.createControllerClass}.
   * @param {any} context - The request-bound {@link DecafRequestContext}.
   * @return {function} The route implementation bound to the controller
   * instance.
   * @category Decaf Model Routes
   */
  static createHandler(
    route: ExpressRoute<any>,
    ControllerClass: new (context: any) => DecafModelController<any>,
    context: any
  ): (...args: any[]) => any {
    const controller = new ControllerClass(context);
    return (route.implementation as any).bind(controller);
  }
}
