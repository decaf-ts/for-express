import { BaseError } from "@decaf-ts/db-decorators";

/**
 * @module for-express/factory/errors/throttling
 * @summary Rate-limiting error carrying HTTP 429.
 * @description Defines {@link ToManyRequestsError}, the decaf error representing
 * throttled requests. It is thrown indirectly by the rate-limit middleware
 * installed via {@link ExpressBootstraper.useRateLimit} (when configured to
 * produce decaf errors) and mapped back to HTTP 429 by
 * {@link DecafErrorFilter}.
 */

/**
 * Error raised when a client exceeds the configured rate limit.
 *
 * @class ToManyRequestsError
 * @description Too-many-requests error carrying the HTTP 429 status code.
 * @summary Built on {@link BaseError} with an explicit `429` code so
 * {@link DecafErrorFilter} responds with HTTP 429, playing the role of the
 * throttling exceptions in Nest's `@nestjs/throttler`.
 *
 * @extends {BaseError}
 * @category Error Handling
 */
export class ToManyRequestsError extends BaseError {
  /**
   * Creates a rate-limiting error.
   * @param {string | Error} msg - Human-readable throttling message or a source error.
   */
  constructor(msg: string | Error) {
    super(ToManyRequestsError.name, msg, 429);
  }
}
