export * from "./cors";
export * from "./throttling";

/**
 * @module for-express/factory/errors
 * @summary Barrel for the factory-level decaf HTTP errors.
 * @description Aggregates the errors raised by the factory middleware layer and
 * re-exported from the `for-express/factory` barrel: {@link CorsError} for
 * rejected CORS origins and {@link ToManyRequestsError} for rate-limited
 * requests. Both extend the decaf error hierarchy so they map cleanly onto
 * HTTP statuses in {@link DecafErrorFilter}.
 */
