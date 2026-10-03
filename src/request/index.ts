/**
 * @module for-express/request
 * @summary Barrel aggregating the Express request-context layer.
 * @description Re-exports the request-context primitives of the `for-express` package: the
 * `DecafAuthHandlerBase` alias and auth data types from `@decaf-ts/for-http/server`, the
 * per-request {@link DecafRequestContext}, the {@link DecafHandlerExecutor} that runs the
 * registered request handlers, and the {@link contextualizeRequestContext} helper that
 * populates the context from an Express request.
 */
export * from "./DecafAuthHandler";
export * from "./DecafRequestContext";
export * from "./DecafHandlerExecutor";
export * from "./contextualize";
