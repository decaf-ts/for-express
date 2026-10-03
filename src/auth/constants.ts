/**
 * @module for-express/auth/constants
 * @summary Metadata keys and symbols used by the Express auth layer.
 * @description Declares the metadata keys attached to controllers/routes by the auth decorators
 * (see `for-express/auth/decorators`) and the symbol under which the bootstrap factory registers
 * the auth handler. These keys are the contract between the decorators and the code that resolves
 * per-route auth configuration when generating Express routes.
 */

/**
 * Symbol key under which the resolved {@link AuthHandler} is stored/looked up on the module.
 *
 * @const AUTH_HANDLER
 * @description Metadata symbol identifying the registered auth handler instance, consumed by the Express bootstrap/module wiring when mounting routes.
 * @category Auth
 */
export const AUTH_HANDLER = Symbol("AUTH_HANDLER");

/**
 * Metadata key set by {@link Auth} with the model resource being accessed.
 *
 * @const AUTH_META_KEY
 * @description Metadata key (`"auth:meta"`) holding the model resource name for authenticated routes; read when the generated router resolves per-route auth configuration.
 * @category Auth
 */
export const AUTH_META_KEY = "auth:meta";

/**
 * Metadata key set by {@link Public} to mark a controller/route as public.
 *
 * @const IS_PUBLIC_KEY
 * @description Metadata key (`"isPublic"`) flagging routes whose authorization is skipped by the {@link AuthInterceptor}.
 * @category Auth
 */
export const IS_PUBLIC_KEY = "isPublic";

/**
 * Metadata key set by {@link RequireRoles} with the roles required to access a route.
 *
 * @const REQUIRED_ROLES_KEY
 * @description Metadata key (`"requiredRoles"`) holding the route-level role list checked against the authenticated principal's roles.
 * @category Auth
 */
export const REQUIRED_ROLES_KEY = "requiredRoles";

/**
 * Metadata key set by {@link RequireNamespaces} with the namespaces required to access a route.
 *
 * @const REQUIRED_NAMESPACES_KEY
 * @description Metadata key (`"requiredNamespaces"`) holding the route-level namespace list checked against the authenticated principal's namespaces.
 * @category Auth
 */
export const REQUIRED_NAMESPACES_KEY = "requiredNamespaces";

/**
 * Metadata key set by {@link SkipModelRoles} to bypass model-level role validation.
 *
 * @const SKIP_MODEL_ROLES_KEY
 * @description Metadata key (`"skipModelRoles"`) flagging routes for which model-level role checks are skipped.
 * @category Auth
 */
export const SKIP_MODEL_ROLES_KEY = "skipModelRoles";

/**
 * Metadata key set by {@link SkipModelNamespaces} to bypass model-level namespace validation.
 *
 * @const SKIP_MODEL_NAMESPACES_KEY
 * @description Metadata key (`"skipModelNamespaces"`) flagging routes for which model-level namespace checks are skipped.
 * @category Auth
 */
export const SKIP_MODEL_NAMESPACES_KEY = "skipModelNamespaces";
