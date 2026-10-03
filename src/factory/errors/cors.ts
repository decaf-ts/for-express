import { ForbiddenError } from "@decaf-ts/core";

/**
 * @module for-express/factory/errors/cors
 * @summary CORS-specific decaf error for rejected origins.
 * @description Defines {@link CorsError}, thrown by the CORS middleware built in
 * {@link ExpressBootstraper.enableCors} when a request originates from a
 * disallowed origin. Being a {@link ForbiddenError}, it carries the decaf
 * 403 error code and flows through {@link DecafErrorFilter} unchanged.
 */

/**
 * Error raised when a request comes from an origin not in the CORS allow-list.
 *
 * @class CorsError
 * @description Forbidden error signalling a rejected CORS origin.
 * @summary Wraps the origin-rejection message produced by the CORS origin
 * callback in {@link ExpressBootstraper.enableCors} so it is reported as HTTP
 * 403 through the decaf error contract, mirroring the Nest integration's
 * CORS error handling.
 *
 * @extends {ForbiddenError}
 * @category Error Handling
 */
export class CorsError extends ForbiddenError {
  /**
   * Creates a CORS rejection error.
   * @param {string | Error} msg - Human-readable rejection message (typically includes the rejected origin) or a source error.
   */
  constructor(msg: string | Error) {
    super(msg, CorsError.name);
  }
}
