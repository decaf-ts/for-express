/**
 * @module for-express/types
 * @summary Shared options, handler and auth types for the Express integration.
 * @description Defines the contract between the application and the Express
 * bootstrap: the {@link DecafModuleOptions} accepted by
 * {@link DecafModule.forRoot}, the {@link DecafRequestHandler} interface
 * implemented by request pipeline handlers, the {@link ObserverEventsOptions}
 * controlling the SSE observer events router, and the Express-narrowed
 * {@link AuthHandler} specialization of the for-http server auth handler.
 */
import { Adapter, ConfigOf, ContextOf } from "@decaf-ts/core";
import { Constructor } from "@decaf-ts/decoration";
import type { Request, Response } from "express";
import {
  RequestToContextTransformer,
  type ModelControllerFactoryConfig,
  type AuthHandler as AuthHandlerBase,
} from "@decaf-ts/for-http/server";
import { DecafRequestContext } from "./request/index";

/**
 * @interface DecafRequestHandler
 * @description Contract for request handlers participating in the Express
 * request pipeline. Implementations are instantiated once by
 * `DecafCoreModule.buildRequestPipeline` and their `handle` method is awaited
 * for every request, after auth and before the route middleware.
 * @summary A pipeline step executed per request with the request-scoped context.
 * @template {DecafRequestContext} [C=DecafRequestContext] - Request context specialization passed to the handler.
 * @method handle - Executes the handler for the current request.
 * @method handle param {C} context - Request-scoped decaf context for the current request.
 * @method handle param {Request} req - The incoming Express request.
 * @method handle param {Response} res - The Express response.
 * @method handle return {Promise<void>} Resolves when the handler completed; thrown errors abort the pipeline.
 * @category Types
 */
export interface DecafRequestHandler<
  C extends DecafRequestContext = DecafRequestContext,
> {
  handle(context: C, req: Request, res: Response): Promise<void>;
}

/**
 * @interface ObserverEventsOptions
 * @description Options controlling the SSE observer events router mounted by
 * {@link DecafModule.forRoot} when `enableObserverEvents` is set.
 * @summary Configuration for the SSE observer events endpoint.
 * @property {boolean} [enableObserverEvents] - Enables or disables SSE stream events globally
 * @property {boolean} [subscriptionMode] - Enables explicit subscription registration and per-subscriber filtering.
 * Broadcast remains the default when omitted or false.
 * @property {boolean} [authenticate] - Runs the registered auth handler (AuthMiddleware) on the SSE stream and on
 * the subscribe/unsubscribe endpoints. The authenticated user then scopes the
 * requester fingerprint (`user:<user>:<x-correlation-id>`). A rejected stream
 * gets the auth handler's HTTP error (e.g. 401).
 * @property {any[]} [observerFlavours] - List of adapter flavours that will emit stream events
 * If omitted, all registered flavours may be used
 * @property {string} [observerApiPath] - SSE endpoint path
 * @default "/events"
 * @category Types
 */
export interface ObserverEventsOptions {
  /**
   * Enables or disables SSE stream events globally
   */
  enableObserverEvents?: boolean;

  /**
   * Enables explicit subscription registration and per-subscriber filtering.
   * Broadcast remains the default when omitted or false.
   */
  subscriptionMode?: boolean;

  /**
   * Runs the registered auth handler (AuthMiddleware) on the SSE stream and on
   * the subscribe/unsubscribe endpoints. The authenticated user then scopes the
   * requester fingerprint (`user:<user>:<x-correlation-id>`). A rejected stream
   * gets the auth handler's HTTP error (e.g. 401).
   */
  authenticate?: boolean;

  /**
   * List of adapter flavours that will emit stream events
   * If omitted, all registered flavours may be used
   */
  observerFlavours?: any[];

  /**
   * SSE endpoint path
   * @default "/events"
   */
  observerApiPath?: string;
}

/**
 * @typedef DecafModuleOptions
 * @description Options accepted by the Express bootstrap factory
 * {@link DecafModule.forRoot}. The `conf` entries pair an adapter constructor
 * with its configuration and an optional trailing request-to-context
 * transformer (instance or constructor) consumed by
 * `DecafCoreModule.bootPersistence`.
 * @summary Runtime options for booting the Express decaf server.
 * @template {any} [CONF=any] - Adapter configuration type.
 * @template {Adapter<CONF, any, any, any>} [A=Adapter<CONF, any, any, any>] - Adapter type being configured.
 * @property {Array.<any>} conf - Adapter configurations: constructor, configuration, optional extra adapter args, and an optional trailing request-to-context transformer.
 * @property {string} [alias] - Optional alias for the adapter registration.
 * @property {boolean} autoControllers - When true, mounts auto-generated model controllers for every exposed model of each booted flavour.
 * @property {boolean} [autoServices] - When true, also auto-registers model services for tracked models.
 * @property {Record<string, boolean | string[]>} [controllerExposure] - Per-model exposure overrides keyed by model name: force on/off or restrict to flavours.
 * @property {Record<string, ModelControllerFactoryConfig>} [controllerConfig] - Per-model controller configuration passed to the for-http model controller factory.
 * @property {ObserverEventsOptions} [observerOptions] - SSE observer events configuration; only mounted when `enableObserverEvents` is set.
 * @property {boolean} [aggregations] - When true, exposes aggregation endpoints on generated controllers.
 * @property {Array.<Constructor<DecafRequestHandler>>} [handlers] - Request handlers executed after auth and before the route middleware, in registration order.
 * @property {function(): Promise.<void>} [initialization] - Async hook awaited after the persistence layer boots.
 * @property {AuthHandler} [authHandler] - The auth handler used to authenticate/authorize requests. In the Nest
 * integration this is supplied through DI; on Express it is passed explicitly.
 * @property {boolean} [allowAnonymous] - Explicitly opts generated model routes into running without an
 * `authHandler`. When `autoControllers` is enabled and no handler is configured,
 * {@link DecafModule.forRoot} fails closed unless this is `true`.
 * @category Types
 */
export type DecafModuleOptions<
  CONF = any,
  A extends Adapter<CONF, any, any, any> = Adapter<CONF, any, any, any>,
> = {
  conf: [
    Constructor<A>,
    ConfigOf<A>,
    ...args:
      | any[]
      | [
          ...any[],
          (
            | RequestToContextTransformer<ContextOf<A>>
            | Constructor<RequestToContextTransformer<ContextOf<A>>>
          ),
        ],
  ][];
  alias?: string;
  autoControllers: boolean;
  autoServices?: boolean;
  controllerExposure?: Record<string, boolean | string[]>;
  controllerConfig?: Record<string, ModelControllerFactoryConfig>;
  observerOptions?: ObserverEventsOptions;
  aggregations?: boolean;
  handlers?: Constructor<DecafRequestHandler>[];
  initialization?: () => Promise<void>;
  /**
   * The auth handler used to authenticate/authorize requests. In the Nest
   * integration this is supplied through DI; on Express it is passed explicitly.
   */
  authHandler?: AuthHandler;
  /**
   * Explicitly opts generated model routes into running without an
   * `authHandler`. When `autoControllers` is enabled and no handler is
   * configured, `forRoot` fails closed unless this is `true`.
   */
  allowAnonymous?: boolean;
};

/**
 * @typedef AuthHandler
 * @description Express-narrowed alias for the base {@link AuthHandlerBase} class from
 * `@decaf-ts/for-http/server`, specializing the execution context to an
 * Express request and the request context to {@link DecafRequestContext}.
 *
 * Concrete handlers extend this class and override `extractFromRequest`.
 * @summary Express specialization of the for-http server `AuthHandler`.
 * @template {Request} [EC=Request] - Execution context: the Express request.
 * @template {DecafRequestContext} [C=DecafRequestContext] - Request context specialization produced by the handler.
 * @example
 * export class CustomAuthHandler extends AuthHandler {
 *   protected extractFromRequest(req: Request) {
 *     const userRole = req.headers.authorization?.split(" ")[1] as string;
 *     if (!userRole) throw new AuthorizationError("Unauthenticated");
 *     return { user: userRole, roles: [userRole] };
 *   }
 * }
 * @category Types
 */
export type AuthHandler<
  EC = Request,
  C extends DecafRequestContext = DecafRequestContext,
> = AuthHandlerBase<EC, C>;
