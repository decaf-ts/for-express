/**
 * @module for-express/request/DecafAuthHandler
 * @summary Barrel re-exporting the framework-agnostic auth handler base and auth data types.
 * @description Re-exports the `AuthHandler` base class from `@decaf-ts/for-http/server` under the
 * Express-facing alias `DecafAuthHandlerBase`, together with the `AuthData`, `AuthRequestLike` and
 * `UserData` types. This gives the request-context layer a single import point for authoring custom
 * auth handlers without depending on the base package's internal paths.
 *
 * Note: the concrete Express handler lives in `for-express/auth/DecafAuthHandler`; this module
 * exposes only the base class and types.
 */
export {
  AuthHandler as DecafAuthHandlerBase,
  type AuthData,
  type AuthRequestLike,
  type UserData,
} from "@decaf-ts/for-http/server";
