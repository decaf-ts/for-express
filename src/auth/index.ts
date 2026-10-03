/**
 * @module for-express/auth
 * @summary Barrel aggregating the Express auth layer.
 * @description Re-exports everything needed to authenticate and authorize requests in the
 * `for-express` package: the metadata {@link AUTH_HANDLER|keys} and route decorators
 * (`@Auth`, `@Public`, `@RequireRoles`, `@RequireNamespaces`, `@SkipModelRoles`,
 * `@SkipModelNamespaces`), the {@link AuthInterceptor} that enforces per-route auth, the
 * {@link AuthMiddleware} that contextualizes requests and primes the handler, and the
 * default {@link DecafAuthHandler} / {@link DecafRoleAuthHandler} implementations.
 *
 * It also re-exports the framework-agnostic auth types from `@decaf-ts/for-http/server`
 * (`AuthHandlerBase`, `AuthData`, `UserData`, `AuthRequestLike`) so consumers can write
 * custom handlers without importing the base package directly.
 */
export * from "./constants";
export * from "./AuthInterceptor";
export * from "./AuthMiddleware";
export * from "./DecafAuthHandler";
export * from "./decorators";

export type {
  AuthHandler as AuthHandlerBase,
  AuthData,
  UserData,
  AuthRequestLike,
} from "@decaf-ts/for-http/server";
