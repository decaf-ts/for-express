/**
 * @module for-express/auth/decorators
 * @summary Auth decorators that stamp controller/route metadata on Express handlers.
 * @description Provides the Express mirrors of the Nest integration's auth decorators —
 * {@link Auth}, {@link Public}, {@link RequireRoles}, {@link RequireNamespaces},
 * {@link SkipModelRoles} and {@link SkipModelNamespaces} — plus low-level metadata helpers.
 * Each decorator attaches its value under a key from `for-express/auth/constants` onto the
 * decorated class or method so the generated router registration and the {@link AuthInterceptor}
 * can resolve the per-route auth configuration.
 *
 * Unlike the Nest counterpart, these decorators do not rely on Nest's `SetMetadata`; they write
 * directly to the Decaf `Metadata` registry.
 */
import { Constructor, Metadata } from "@decaf-ts/decoration";

import {
  AUTH_META_KEY,
  IS_PUBLIC_KEY,
  REQUIRED_NAMESPACES_KEY,
  REQUIRED_ROLES_KEY,
  SKIP_MODEL_NAMESPACES_KEY,
  SKIP_MODEL_ROLES_KEY,
} from "./constants";

/**
 * Builds a class decorator that stores `value` under `key` in the Decaf `Metadata` registry.
 *
 * @function defineClassMetadata
 * @param {string} key - The metadata key to set on the decorated class.
 * @param {any} value - The metadata value to store.
 * @return {ClassDecorator} A class decorator writing the key/value pair onto the target.
 * @category Auth
 */
function defineClassMetadata(key: string, value: any): ClassDecorator {
  return (target: any) => {
    Metadata.set(target, key, value);
    return target;
  };
}

/**
 * Builds a method decorator that stores `value` under `key` on the decorated method.
 *
 * @function defineMethodMetadata
 * @param {string} key - The metadata key to set on the decorated method.
 * @param {any} value - The metadata value to store.
 * @return {MethodDecorator} A method decorator writing the key/value pair onto the method.
 * @category Auth
 */
function defineMethodMetadata(key: string, value: any): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: any) => {
    Metadata.set(target[propertyKey] ?? target, key, value);
    return descriptor;
  };
}

/**
 * Dual-purpose decorator factory storing `value` under `key` on either a class or a method.
 *
 * When applied with a `propertyKey`/`descriptor` it behaves as a method decorator; otherwise it
 * behaves as a class decorator. Used by all exported auth decorators so the same factory can
 * annotate a controller or an individual route.
 *
 * @function defineMetadata
 * @param {string} key - The metadata key to set on the decorated class or method.
 * @param {any} value - The metadata value to store.
 * @return {ClassDecorator | MethodDecorator} A decorator writing the key/value pair onto the target.
 * @category Auth
 */
function defineMetadata(key: string, value: any): ClassDecorator & MethodDecorator {
  return ((target: any, propertyKey?: string | symbol, descriptor?: any) => {
    if (descriptor || propertyKey) {
      Metadata.set(target[propertyKey as any] ?? target, key, value);
      return descriptor;
    }
    Metadata.set(target, key, value);
    return target;
  }) as ClassDecorator & MethodDecorator;
}

/**
 * Marks a controller/route as authenticated for the given model.
 *
 * Attaches the model resource name under {@link AUTH_META_KEY} (`"auth:meta"`) so the
 * route resolution can tie the endpoint to a model for model-level role/namespace
 * checks performed by the {@link AuthInterceptor}.
 *
 * @function Auth
 * @param {string | Constructor} [model] - The model being accessed: either its name or its constructor. When omitted, no model resource is associated.
 * @return {ClassDecorator | MethodDecorator} A decorator stamping the model resource metadata; usable on controllers and routes.
 * @category Auth
 *
 * @example
 * ```js
 * @Auth("User")
 * @RequireRoles("admin")
 * class UserController { ... }
 * ```
 */
export function Auth(model?: string | Constructor) {
  const resource = model
    ? typeof model === "string"
      ? model
      : model.name
    : undefined;
  return defineMetadata(AUTH_META_KEY, resource);
}

/**
 * Marks a controller/route as public (skips auth).
 *
 * Attaches `true` under {@link IS_PUBLIC_KEY} (`"isPublic"`) so the resolved route
 * configuration tells the {@link AuthInterceptor} to skip authorization entirely.
 *
 * @function Public
 * @return {ClassDecorator | MethodDecorator} A decorator stamping the public flag; usable on controllers and routes.
 * @category Auth
 *
 * @example
 * ```js
 * @Public()
 * @Get("/health")
 * health() { ... }
 * ```
 */
export function Public() {
  return defineMetadata(IS_PUBLIC_KEY, true);
}

/**
 * Declares the roles required to access a controller/route.
 *
 * Attaches the role list under {@link REQUIRED_ROLES_KEY} (`"requiredRoles"`); the
 * {@link AuthInterceptor} forwards it to the registered {@link AuthHandler}, which
 * rejects the request with an `AuthorizationError` when the principal lacks any role.
 *
 * @function RequireRoles
 * @param {...string} roles - The roles granted access to the decorated controller or route.
 * @return {ClassDecorator | MethodDecorator} A decorator stamping the required-roles metadata.
 * @category Auth
 */
export function RequireRoles(...roles: string[]) {
  return defineMetadata(REQUIRED_ROLES_KEY, roles);
}

/**
 * Declares the namespaces required to access a controller/route.
 *
 * Attaches the namespace list under {@link REQUIRED_NAMESPACES_KEY} (`"requiredNamespaces"`);
 * the {@link AuthInterceptor} forwards it to the registered {@link AuthHandler}, which
 * rejects the request when the principal lacks any namespace.
 *
 * @function RequireNamespaces
 * @param {...string} namespaces - The namespaces granted access to the decorated controller or route.
 * @return {ClassDecorator | MethodDecorator} A decorator stamping the required-namespaces metadata.
 * @category Auth
 */
export function RequireNamespaces(...namespaces: string[]) {
  return defineMetadata(REQUIRED_NAMESPACES_KEY, namespaces);
}

/**
 * Skips model-level role validation for a controller/route.
 *
 * Attaches `true` under {@link SKIP_MODEL_ROLES_KEY} (`"skipModelRoles"`) so route-level
 * roles still apply but the roles declared on the model via `@roles()` are ignored.
 *
 * @function SkipModelRoles
 * @return {ClassDecorator | MethodDecorator} A decorator stamping the skip-model-roles flag.
 * @category Auth
 */
export function SkipModelRoles() {
  return defineMetadata(SKIP_MODEL_ROLES_KEY, true);
}

/**
 * Skips model-level namespace validation for a controller/route.
 *
 * Attaches `true` under {@link SKIP_MODEL_NAMESPACES_KEY} (`"skipModelNamespaces"`) so
 * route-level namespaces still apply but the namespaces declared on the model via
 * `@namespace()` are ignored.
 *
 * @function SkipModelNamespaces
 * @return {ClassDecorator | MethodDecorator} A decorator stamping the skip-model-namespaces flag.
 * @category Auth
 */
export function SkipModelNamespaces() {
  return defineMetadata(SKIP_MODEL_NAMESPACES_KEY, true);
}

/**
 * Re-exports the low-level metadata helpers for consumers building custom decorators.
 *
 * - `defineClassMetadata`: class-scoped metadata writer ({@link defineClassMetadata}).
 * - `defineMethodMetadata`: method-scoped metadata writer ({@link defineMethodMetadata}).
 *
 * @category Auth
 */
export { defineClassMetadata, defineMethodMetadata };
