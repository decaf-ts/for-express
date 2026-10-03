/**
 * @module for-express/decaf-model/DecafModelModule
 * @summary Express implementation of the per-flavour Decaf model module.
 * @description Provides {@link getModuleFor}, the Express equivalent of the Nest
 * `DecafModelModule` factory. Given an adapter flavour it returns a static class
 * whose `forRoot` method turns every exposed, tracked model into concrete
 * Express routes mounted on a ready-to-use {@link Router} (each model's
 * routes under a per-model kebab-cased base path). Route
 * implementations are produced by the framework-agnostic
 * {@link FromModelController} pipeline on top of the for-http
 * `ModelControllerFactory`, while authentication is enforced per request
 * through the {@link AuthInterceptor} built from the module's `authHandler`
 * and `contextFor` options. This module is the counterpart consumed by the
 * server bootstrap in `module.ts` when it builds the model routes for a
 * flavour.
 */

import { Router, type Request, type RequestHandler, type Response } from "express";
import { Adapter, ModelService } from "@decaf-ts/core";
import { Logging, toKebabCase } from "@decaf-ts/logging";
import { Metadata } from "@decaf-ts/decoration";
import { Model, ModelConstructor } from "@decaf-ts/decorator-validation";
import { InternalError } from "@decaf-ts/db-decorators";
import type { ModelControllerFactoryConfig } from "@decaf-ts/for-http/server";

import { DECAF_EXPOSE } from "../constants";
import type { DecafModuleOptions } from "../types";
import { DecafRequestContext } from "../request/DecafRequestContext";
import { AuthInterceptor } from "../auth/AuthInterceptor";
import type { AuthHandler } from "../types";
import {
  FromModelController,
  resolveRouteArgs,
  type ExpressRoute,
} from "./FromModelController";

/**
 * Options accepted by the module's `forRoot` method.
 *
 * @interface DecafModelModuleOptions
 * @description Fully-shaped runtime options for the model module. In practice
 * callers pass a {@link DecafModelModuleOptionsInput} (a partial of this shape)
 * to `forRoot`; the same option names mirror the Nest `DecafModuleOptions`
 * where applicable.
 * @summary Runtime configuration controlling auto-services, controller
 * exposure, per-model controller config, aggregation queries, and request
 * context/auth wiring for generated routes.
 * @property {boolean} [autoServices] - When true, auto-registers a
 * {@link ModelService} singleton for each tracked model. Controllers always
 * rely on a backing service regardless of this flag.
 * @property {Record<string, boolean | string[]>} [controllerExposure] - Per-model
 * exposure overrides keyed by model name: `true`/`false` to force exposure on
 * or off, or an array of flavour names limiting the model to those flavours.
 * Takes precedence over the `@expose` decorator metadata.
 * @property {Record<string, ModelControllerFactoryConfig>} [controllerConfig] - Per-model
 * {@link ModelControllerFactoryConfig} overrides keyed by model name, merged on
 * top of any `@controllerConfig` decorator and the global defaults.
 * @property {boolean} [aggregations] - When explicitly `false`, disables
 * grouping/aggregation queries globally by setting
 * `allowGroupingQueries: false` in the default factory config.
 * @property {AuthHandler} [authHandler] - Handler used by the
 * {@link AuthInterceptor} to resolve request authentication/authorization.
 * @property {function} contextFor - Builds the {@link DecafRequestContext} for
 * an incoming request; invoked for every generated route handler.
 * @property {RequestHandler} [authMiddleware] - Optional Express middleware
 * applied as a guard in front of every non-public route.
 * @category Decaf Model Routes
 */
export type DecafModelModuleOptions = {
  autoServices?: boolean;
  controllerExposure?: Record<string, boolean | string[]>;
  controllerConfig?: Record<string, ModelControllerFactoryConfig>;
  aggregations?: boolean;
  authHandler?: AuthHandler;
  contextFor: (req: Request, res: Response) => DecafRequestContext;
  authMiddleware?: RequestHandler;
};

/**
 * Result of building the model routes for a flavour.
 *
 * @interface DecafModelModuleResult
 * @description Returned by `DecafModelModule.forRoot` so the server bootstrap
 * can mount the router and inspect what was generated.
 * @summary The tracked models, their generated routes, and the assembled router.
 * @property {Array.<ModelConstructor<any>>} models - The exposed, tracked models for
 * which routes were generated.
 * @property {Array.<ExpressRoute<any>>} routes - The framework-agnostic route
 * registrations produced by {@link FromModelController.create}; each route's
 * `path` is relative to its model's base path.
 * @property {Router} router - The Express {@link Router} with all generated
 * routes mounted under each model's kebab-cased base path
 * (`/${toKebabCase(Model.tableName(model))}`), ready to be attached to the
 * application.
 * @category Decaf Model Routes
 */
export type DecafModelModuleResult = {
  models: ModelConstructor<any>[];
  routes: ExpressRoute<any>[];
  router: Router;
};

/**
 * Express equivalent of the Nest `DecafModelModule` (created via
 * `getModuleFor(flavour)`).
 *
 * Instead of a Nest `DynamicModule`, `forRoot` returns a ready-to-mount Express
 * {@link Router} together with the generated routes and exposed models.
 *
 * @function getModuleFor
 * @description Creates the static `DecafModelModule` class for a flavour. The
 * returned class is assigned the name `DecafModule${flavour}` and exposes the
 * same surface as its Nest counterpart (`isExposed`, `forRoot`), so the server
 * bootstrap can treat both integrations uniformly.
 * @summary Factory returning the per-flavour model-route module class.
 * @param {string} flavour - The adapter flavour (e.g. `"rest"`, `"pouch"`)
 * whose tracked models should be turned into Express routes.
 * @return {DecafModelModule} The static `DecafModelModule` class for
 * the flavour, providing `isExposed` and `forRoot`.
 * @category Decaf Model Routes
 * @example
 * ```typescript
 * const DecafModelModule = getModuleFor("rest");
 * const { router } = DecafModelModule.forRoot("rest", {
 *   contextFor: (req, res) => buildContext(req, res),
 *   authHandler: myAuthHandler,
 *   aggregations: false,
 * });
 * app.use("/api", router);
 * ```
 */
export function getModuleFor(flavour: string) {
  /**
   * @class DecafModelModule
   * @description Static container for model-exposure checks and route
   * generation; never instantiated directly.
   * @summary Per-flavour module class that converts exposed models into
   * Express routes via {@link FromModelController} and the for-http
   * `ModelControllerFactory`.
   * @category Decaf Model Routes
   */
  class DecafModelModule {
    static readonly log = Logging.for(DecafModelModule.name).for(flavour);

    /**
     * Determines whether a model should be exposed for the flavour.
     *
     * @function isExposed
     * @description Resolution order: an explicit entry in the `exposure`
     * override map wins; otherwise the metadata set by the {@link expose}
     * decorator is used. Models with no information at all default to
     * exposed; an array value only exposes the model for the listed flavours.
     * @summary Checks exposure overrides and `@expose` metadata for a model.
     * @param {ModelConstructor<any>} model - The model constructor to check.
     * @param {Record<string, boolean | string[]>} [exposure] - Per-model
     * exposure overrides keyed by model name, typically
     * `options.controllerExposure`.
     * @return {boolean} `true` when the model should get generated routes.
     * @category Decaf Model Routes
     */
    static isExposed(
      model: ModelConstructor<any>,
      exposure?: Record<string, boolean | string[]>
    ): boolean {
      const override = exposure?.[model.name];
      const value =
        typeof override !== "undefined"
          ? override
          : Metadata.get(model, Metadata.key(DECAF_EXPOSE));

      if (typeof value === "undefined") return true;
      if (value === true) return true;
      if (Array.isArray(value)) return value.includes(flavour);
      return false;
    }

    /**
     * Generates the Express router and routes for all exposed models.
     *
     * @function forRoot
     * @description Filters the adapter's tracked models through
     * `isExposed`, warms the {@link ModelService} singleton registry so
     * shutdown sees the live services behind the generated routes, merges the
     * controller configuration (global defaults, `@controllerConfig` decorator
     * metadata, and per-model module overrides), and registers each route on a
     * per-model {@link Router} mounted at
     * `/${toKebabCase(Model.tableName(model))}` (mirroring for-nest's
     * per-controller `@Controller(routePath)`), so multiple exposed models do
     * not register colliding flat routes. Each exposed model's kebab-cased base
     * path is precomputed up front and validated for uniqueness before any
     * route is built: when two exposed models resolve to the same base path,
     * `forRoot` fails fast by throwing a decaf {@link InternalError} naming
     * both colliding models. The precomputed base paths are then reused for
     * mounting. Every route handler builds a
     * {@link DecafRequestContext} via `contextFor`, runs the
     * {@link AuthInterceptor} (skipped for public routes; model-level
     * role/namespace validation can be skipped per route via the route auth
     * config), instantiates the generated controller class, and serializes the
     * result (`201` for POST, `200` otherwise, `204` for empty results).
     * @summary Builds and mounts all model routes for the flavour.
     * @param {string} flavour - The adapter flavour whose models are exposed.
     * @param {Partial<DecafModelModuleOptionsInput>} [options] - Partial module
     * options; `contextFor` is required, everything else is optional.
     * @return {DecafModelModuleResult} The tracked models, generated routes,
     * and the mounted {@link Router}.
     * @throws {InternalError} When two exposed models resolve to the same
     * kebab-cased base path.
     * @category Decaf Model Routes
     */
    static forRoot(
      flavour: string,
      options: Partial<DecafModelModuleOptionsInput> = {}
    ): DecafModelModuleResult {
      const log = this.log.for(this.forRoot);
      log.info(`Generating routes for flavour...`);

      const trackedModels = Adapter.models(flavour).filter((model) =>
        this.isExposed(model, options.controllerExposure)
      );

      const basePathByModel = new Map<ModelConstructor<any>, string>();
      const modelByBasePath = new Map<string, ModelConstructor<any>>();
      for (const model of trackedModels) {
        const basePath = toKebabCase(Model.tableName(model));
        const collision = modelByBasePath.get(basePath);
        if (collision) {
          throw new InternalError(
            `Duplicate base path "/${basePath}" resolved for exposed models "${collision.name}" and "${model.name}"; kebab-cased table names must be unique`
          );
        }
        modelByBasePath.set(basePath, model);
        basePathByModel.set(model, basePath);
      }

      // Controllers always rely on a backing ModelService, even when services
      // are not auto-registered. Warm the singleton registry so shutdown can
      // see the live services created for the generated routes.
      for (const model of trackedModels) ModelService.forModel(model as any);

      const globalDefaults: Partial<ModelControllerFactoryConfig> = {};
      if (options.aggregations === false) {
        globalDefaults.allowGroupingQueries = false;
      }

      const router = Router();
      const routes: ExpressRoute<any>[] = [];

      for (const model of trackedModels) {
        const modelRoutes = FromModelController.create(
          model,
          options.controllerConfig,
          globalDefaults
        );
        const ControllerClass =
          FromModelController.createControllerClass(model);
        const modelName = model.name;
        const basePath = basePathByModel.get(model)!;
        const modelRouter = Router();

        for (const route of modelRoutes) {
          const path = route.path
            ? `/${route.path.replace(/^\/+|\/+$/g, "")}`
            : "/";
          const method = route.method.toLowerCase() as
            | "get"
            | "post"
            | "put"
            | "patch"
            | "delete";

          const authConfig = route.auth;
          const isPublic =
            authConfig?.public === true || route.requiresAuth === false;

          const guards: RequestHandler[] = [];
          if (options.authMiddleware && !isPublic)
            guards.push(options.authMiddleware);

          const handler: RequestHandler = async (req, res, next) => {
            try {
              const context = options.contextFor!(req, res);
              const interceptor = new AuthInterceptor(options.authHandler, {
                model: authConfig?.skipModelRoles ? undefined : modelName,
                public: isPublic,
                roles: authConfig?.roles,
                namespaces: authConfig?.namespaces,
                skipModelRoles: authConfig?.skipModelRoles,
                skipModelNamespaces: authConfig?.skipModelNamespaces,
              });
              await interceptor.intercept(context, req, res);

              const controller = new ControllerClass(context);
              const args = resolveRouteArgs(route, req);
              const result = await route.implementation.apply(
                controller,
                args
              );
              context.toResponse(res);
              if (result === undefined || result === null) {
                if (!res.headersSent) res.status(204).end();
              } else if (!res.headersSent) {
                res
                  .status(route.method === "POST" ? 201 : 200)
                  .json(result);
              }
            } catch (e) {
              next(e);
            }
          };

          (modelRouter as any)[method](path, ...guards, handler);
          routes.push(route);
        }

        // Mirror for-nest's per-controller `@Controller(routePath)`: every
        // model's routes mount under its own kebab-cased table name so multiple
        // exposed models do not register colliding flat routes.
        router.use(`/${basePath}`, modelRouter);
      }

      log.info(
        `Generated ${routes.length} routes for ${trackedModels.length} models`
      );

      return { models: trackedModels, routes, router };
    }
  }
  Object.assign(DecafModelModule, "name", {
    value: `DecafModule${flavour}`,
  });
  return DecafModelModule;
}

/**
 * Internal input shape for `forRoot`, picking the shareable fields from
 * {@link DecafModuleOptions} and adding the Express-specific context/auth
 * wiring.
 *
 * @typedef DecafModelModuleInput
 * @description Alias kept separate from {@link DecafModelModuleOptions} so the
 * Nest-derived options shape stays decoupled from the Express runtime surface.
 * @summary Subset of {@link DecafModuleOptions} plus Express auth/context hooks.
 * @category Decaf Model Routes
 */
type DecafModelModuleInput = Pick<
  DecafModuleOptions,
  | "autoServices"
  | "controllerExposure"
  | "controllerConfig"
  | "aggregations"
> & {
  authHandler?: AuthHandler;
  contextFor: (req: Request, res: Response) => DecafRequestContext;
  authMiddleware?: RequestHandler;
};

/**
 * Options shape actually accepted by `DecafModelModule.forRoot`.
 *
 * @typedef DecafModelModuleOptionsInput
 * @description Currently identical to {@link DecafModelModuleInput}; exists as
 * a named alias so callers can reference the input type directly.
 * @summary Alias of {@link DecafModelModuleInput}.
 * @category Decaf Model Routes
 */
type DecafModelModuleOptionsInput = DecafModelModuleInput;
