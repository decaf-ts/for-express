/**
 * @module for-express/decaf-model/decorators/types
 * @summary Shared types for the Express model decorators.
 * @description Re-exports the framework-agnostic server-side decorator types
 * from the for-http `server` entry point under Decaf-prefixed names, and
 * defines {@link DecafRouteDecOptions} for custom route declarations. This
 * keeps the Express integration aligned with the Nest integration's decorator
 * types while reusing the for-http server primitives.
 */

import type {
  HttpVerbs as ServerHttpVerbs,
  ServerApiProperty,
  ServerModelRoute,
  ServerParamProps,
  ServerRouteDecOptions,
} from "@decaf-ts/for-http/server";

/**
 * HTTP verbs supported by model routes.
 *
 * @typedef HttpVerbs
 * @description Direct re-export of the for-http server `HttpVerbs` type,
 * shared by the framework-agnostic route definitions the Express
 * integration consumes.
 * @summary Alias of the server `HttpVerbs` union.
 * @category Decaf Model Routes
 */
export type HttpVerbs = ServerHttpVerbs;

/**
 * API property metadata shape for swagger-style route documentation.
 *
 * @typedef DecafApiProperty
 * @description Alias of the for-http `ServerApiProperty`; describes a single
 * documented property of a route's request/response model.
 * @summary Alias of the server `ServerApiProperty` type.
 * @category Decaf Model Routes
 */
export type DecafApiProperty = ServerApiProperty;

/**
 * Metadata describing a single generated model route.
 *
 * @typedef DecafModelRoute
 * @description Alias of the for-http `ServerModelRoute`; carries the route
 * documentation and configuration used by the shared model controller builder.
 * @summary Alias of the server `ServerModelRoute` type.
 * @category Decaf Model Routes
 */
export type DecafModelRoute = ServerModelRoute;

/**
 * Resolved parameter props handed to route implementations.
 *
 * @typedef DecafParamProps
 * @description Alias of the for-http `ServerParamProps`; carries the ordered
 * path parameter values and related metadata used when invoking custom route
 * handlers (see `createRouteHandler` in
 * {@link module:for-express/decaf-model/utils | utils}).
 * @summary Alias of the server `ServerParamProps` type.
 * @category Decaf Model Routes
 */
export type DecafParamProps = ServerParamProps;

/**
 * Options for declaring a custom route on a model controller.
 *
 * @interface DecafRouteDecOptions
 * @description Framework-agnostic subset of the for-http
 * `ServerRouteDecOptions` used by the custom `@route` decorator surface,
 * keeping the Express integration's route declarations decoupled from Nest.
 * @summary Path, HTTP method, and handler for a custom model route.
 * @property {ServerRouteDecOptions.path} path - The route path relative to
 * the model's base path.
 * @property {ServerRouteDecOptions.httpMethod} httpMethod - The HTTP verb
 * the route responds to.
 * @property {ServerRouteDecOptions.handler} handler - The handler invoked
 * for the route.
 * @category Decaf Model Routes
 */
export interface DecafRouteDecOptions {
  path: ServerRouteDecOptions["path"];
  httpMethod: ServerRouteDecOptions["httpMethod"];
  handler: ServerRouteDecOptions["handler"];
}
