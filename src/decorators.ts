/**
 * @module for-express/decorators
 * @summary Route and auth decorators for the Express integration.
 * @description Re-exports the framework-agnostic route decorators from
 * `@decaf-ts/for-http/server`.
 *
 * On Express these decorators only record route metadata (`@decaf-ts/for-http`'s
 * `ModelControllerFactory` discovers it to build `ServerRoute` registrations);
 * unlike the Nest integration they do not register the route by themselves.
 *
 * Also re-exports the Express auth decorators ({@link Auth}, {@link Public},
 * {@link RequireRoles}, {@link RequireNamespaces}) used to annotate models and
 * controllers with authentication and authorization requirements.
 *
 * @see @decaf-ts/for-http/server for the underlying route decorator implementation.
 *
 * The re-exported route decorators ({@link route}, {@link get}, {@link post},
 * {@link put}, {@link patch}, {@link delete} / {@link del}) are documented in
 * `@decaf-ts/for-http/server`.
 */
export {
  route,
  get,
  post,
  put,
  patch,
  del as delete,
  del,
} from "@decaf-ts/for-http/server";

/**
 * Re-exports the Express auth decorators from `./auth/decorators`: use
 * {@link Auth} on models to declare role/namespace requirements, {@link Public}
 * to opt routes out of authentication, and {@link RequireRoles} /
 * {@link RequireNamespaces} to attach per-handler requirements.
 * @category Decorators
 */
export { Auth, Public, RequireRoles, RequireNamespaces } from "./auth/decorators";
