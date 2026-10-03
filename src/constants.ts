/**
 * @module for-express/constants
 * @summary Decoration keys, service identifiers and server context types for the Express integration.
 * @description Central registry of metadata keys used to annotate controllers,
 * routes, handlers and exposed models, plus the identifiers under which module
 * options, adapters and task services are registered. Also defines the
 * Express-specific server flags and context types shared by the request
 * pipeline, controllers and auth handlers. Mirrors the constants of
 * `@decaf-ts/for-nest` and `@decaf-ts/for-http/server`.
 */
import { AdapterFlags, Context } from "@decaf-ts/core";
import { Logger } from "@decaf-ts/logging";

/**
 * @const DECAF_MODULE_OPTIONS
 * Metadata key under which the {@link DecafModuleOptions | module options} are
 * registered, used by the model module factory to access shared configuration.
 * @type {string}
 * @category Constants
 */
export const DECAF_MODULE_OPTIONS = "DecafModuleOptions";

/**
 * @const DECAF_ADAPTER_ID
 * Identifier under which the configured adapter is registered in the service
 * registry, so controllers and services can resolve the persistence layer.
 * @type {string}
 * @category Constants
 */
export const DECAF_ADAPTER_ID = "DecafAdapter";

/**
 * @const DECAF_TASK_SERVICE_ID
 * Identifier under which the task service is registered in the service
 * registry.
 * @type {string}
 * @category Constants
 */
export const DECAF_TASK_SERVICE_ID = "DecafTaskService";

/**
 * @const DECAF_ROUTE
 * Metadata key storing the route definition recorded on handler methods by the
 * re-exported route decorators (see {@link route}); consumed by the for-http
 * `ModelControllerFactory` when building server routes.
 * @type {string}
 * @category Constants
 */
export const DECAF_ROUTE = "DecafRoute";

/**
 * @const DECAF_HANDLERS
 * Metadata key (symbol) under which request handler definitions are collected
 * on controllers and services.
 * @type {Symbol}
 * @category Constants
 */
export const DECAF_HANDLERS = Symbol("DecafHandlers");

/**
 * @const DECAF_EXPOSE
 * Metadata key marking a model as exposed through auto-generated controllers.
 * @type {string}
 * @category Constants
 */
export const DECAF_EXPOSE = "DecafExpose";

/**
 * @const DECAF_CONTROLLER_CONFIG
 * Metadata key storing per-model controller configuration overrides.
 * @type {string}
 * @category Constants
 */
export const DECAF_CONTROLLER_CONFIG = "DecafControllerConfig";

/**
 * @const DECAF_CONTEXT_KEY
 * Symbol used to attach the request-scoped {@link DecafServerCtx} onto Express
 * request objects when contextualizing a request.
 * @type {Symbol}
 * @category Constants
 */
export const DECAF_CONTEXT_KEY = Symbol("decaf:context");

/**
 * @typedef DecafServerFlags
 * @description Extended adapter flags carried by the Express server context.
 * Adds the incoming request headers and the accumulated repository overrides
 * on top of the standard {@link AdapterFlags} surface.
 * @summary Server-side context flags for the Express integration, shared by the request pipeline, controllers and auth handlers.
 * @template {Logger} [LOG=Logger] - Logger specialization for the adapter flags.
 * @property {Record<string, any>} headers - Headers of the incoming Express request.
 * @property {Record<string, any>} overrides - Request-scoped repository overrides accumulated by the request context.
 * @category Constants
 */
export type DecafServerFlags<LOG extends Logger = Logger> =
  AdapterFlags<LOG> & {
    headers: Record<string, any>;
    overrides: Record<string, any>;
  };

/**
 * @typedef DecafServerCtx
 * @description Server-side decaf context bound to the Express-specific
 * {@link DecafServerFlags}. This is the context specialization used by
 * controllers, generated model routes and auth handlers in this package.
 * @summary Alias for `Context<DecafServerFlags>`, the server context type of the Express integration.
 * @category Constants
 */
export type DecafServerCtx = Context<DecafServerFlags>;
