import type { NextFunction, Request, Response } from "express";
import {
  BadRequestError,
  BaseError,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "@decaf-ts/db-decorators";
import { LoggedEnvironment, Logging } from "@decaf-ts/logging";
import {
  AuthorizationError,
  ForbiddenError,
  PersistenceKeys,
  UnsupportedError,
} from "@decaf-ts/core";

import { ToManyRequestsError } from "../errors/throttling";
import { DecafRequestContext } from "../../request/DecafRequestContext";

/**
 * @module for-express/factory/exceptions/DecafErrorFilter
 * @summary Terminal Express error handler mapping arbitrary errors onto the decaf error contract.
 * @description Provides {@link DecafErrorFilter} and its internal HTTP-status to
 * decaf-error mapping table. Registered by
 * {@link ExpressBootstraper.useGlobalFilters} (or manually) as the final
 * four-argument Express error middleware, it normalizes thrown values into
 * decaf {@link BaseError} instances, logs them through any request-scoped
 * {@link DecafRequestContext} and emits a consistent JSON error body.
 */

/**
 * Lookup table translating numeric HTTP statuses carried by foreign errors
 * into decaf error factories.
 *
 * @const STATUS_TO_DECAF_ERROR
 * @description Maps HTTP status codes onto the matching decaf {@link BaseError} constructors.
 * @summary Used by {@link DecafErrorFilter.decafErrorFor} to convert non-decaf
 * errors that expose a `status`/`statusCode` property: 401 to
 * {@link AuthorizationError}, 403 to {@link ForbiddenError}, 400 to
 * `BadRequestError`, 409 to `ConflictError`, 422 to `ValidationError`, 404 to
 * `NotFoundError` and 429 to {@link ToManyRequestsError}.
 * @category Error Handling
 */
const STATUS_TO_DECAF_ERROR: Array<{
  status: number;
  factory: (msg: string) => BaseError;
}> = [
  { status: 401, factory: (msg) => new AuthorizationError(msg) },
  { status: 403, factory: (msg) => new ForbiddenError(msg) },
  { status: 400, factory: (msg) => new BadRequestError(msg) },
  { status: 409, factory: (msg) => new ConflictError(msg) },
  { status: 422, factory: (msg) => new ValidationError(msg) },
  { status: 404, factory: (msg) => new NotFoundError(msg) },
  { status: 429, factory: (msg) => new ToManyRequestsError(msg) },
];

/**
 * Express error-handling middleware mapping any thrown error onto the decaf
 * error contract.
 *
 * @class DecafErrorFilter
 * @description Terminal error handler that converts thrown values into HTTP responses with decaf semantics.
 * @summary This is the Express equivalent of the Nest `DecafExceptionFilter`: unlike Nest
 * there is no exception-filter system, so it is registered as the terminal
 * four-argument Express error handler. The mapping it performs:
 *
 * - `UnsupportedError` becomes an `InternalError` answered with HTTP 406.
 * - Values that are not decaf {@link BaseError} instances but carry a numeric
 *   `status`/`statusCode` are converted through {@link DecafErrorFilter.decafErrorFor}
 *   (401 → {@link AuthorizationError}, 403 → {@link ForbiddenError},
 *   400 → `BadRequestError`, 409 → `ConflictError`, 422 → `ValidationError`,
 *   404 → `NotFoundError`, 429 → {@link ToManyRequestsError}).
 * - Foreign errors with an unmapped `status` keep that status as the response code.
 * - Anything else becomes an `InternalError` answered with HTTP 500.
 *
 * The response is a JSON body `{ status, error, timestamp, path, method }`
 * where `error` is the error `name` in production and the full `message`
 * otherwise; nothing is written when headers were already sent.
 * {@link AuthorizationError} instances additionally trigger an audit action log.
 *
 * @category Error Handling
 */
export class DecafErrorFilter {
  /**
   * Returns the Express error handler. Must be registered after all routes.
   *
   * The returned handler normalizes the exception, logs it (see
   * {@link DecafErrorFilter.logError}), emits the audit action for
   * {@link AuthorizationError} and sends the JSON error response.
   * @return {Function} Async `(err, req, res, next)` middleware resolving the response status from the mapped error (defaulting to 500).
   */
  get handler() {
    return async (
      exception: any,
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      void next;
      const isProduction = LoggedEnvironment.env === "production";
      let statusCode: number | undefined;
      let error: Error = exception;

      if (exception instanceof UnsupportedError) {
        error = new InternalError(exception.message);
        statusCode = 406;
      } else if (!(exception instanceof BaseError)) {
        const mapped = this.decafErrorFor(exception);
        if (mapped) {
          error = mapped(exception.message);
        } else if ((exception as any)?.status) {
          statusCode = (exception as any).status;
        } else {
          error = new InternalError(exception?.message ?? String(exception));
        }
      }

      await this.logError(req, error);
      if (error instanceof AuthorizationError) {
        await this.logAuthAction(req, error);
      }

      const code = statusCode ?? (error as BaseError).code ?? 500;
      if (res.headersSent) return;
      res.status(code).json({
        status: code,
        error: isProduction ? error.name : error.message,
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
      });
    };
  }

  /**
   * Resolves the decaf error factory matching a foreign exception's HTTP status.
   *
   * Reads `status` (falling back to `statusCode`) and looks it up in
   * {@link STATUS_TO_DECAF_ERROR}.
   * @protected
   * @param {any} exception - The thrown value, expected to expose a numeric `status` or `statusCode`.
   * @return {Function | undefined} Factory `(msg) => BaseError` for the matching status, or `undefined` when none applies.
   */
  protected decafErrorFor(
    exception: any
  ): ((msg: string) => BaseError) | undefined {
    const status = exception?.status ?? exception?.statusCode;
    if (typeof status !== "number") return undefined;
    return STATUS_TO_DECAF_ERROR.find((entry) => entry.status === status)
      ?.factory;
  }

  /**
   * Logs the normalized error using the request-scoped decaf context when
   * available, falling back to the global logger and finally to silence so
   * response delivery is never disrupted.
   * @protected
   * @param {Request} request - The Express request that triggered the error.
   * @param {Error} exception - The normalized error to report.
   * @return {Promise<void>} Resolves once the error has been logged (or intentionally skipped).
   */
  protected async logError(
    request: Request,
    exception: Error
  ): Promise<void> {
    const message = `Unhandled error on ${request?.method} ${request?.url}`;
    try {
      const context = this.resolveRequestContext(request);
      const log = context?.logger ?? Logging.get();
      log.error(message, exception);
    } catch {
      try {
        Logging.get().error(message, exception);
      } catch {
        // logging unavailable — the response is still sent by the caller
      }
    }
  }

  /**
   * Emits an audit action ({@link PersistenceKeys.FORBIDDEN}) for authorization
   * failures, including the attempted operation when the request carries a
   * decaf context. Failures are swallowed so the response is still sent.
   * @protected
   * @param {Request} request - The Express request rejected by authorization.
   * @param {AuthorizationError} exception - The authorization error carrying the response code.
   * @return {Promise<void>} Resolves once the audit action has been recorded (or intentionally skipped).
   */
  protected async logAuthAction(
    request: Request,
    exception: AuthorizationError
  ): Promise<void> {
    try {
      const context = this.resolveRequestContext(request);
      const log = context?.logger ?? Logging.get();
      const operation =
        context?.getOrUndefined("operation" as any) ??
        `${request?.method} ${request?.url}`;
      log.action(PersistenceKeys.FORBIDDEN, exception.code, {
        operation,
        error: exception.message,
      });
    } catch {
      // logging unavailable — the response is still sent by the caller
    }
  }

  /**
   * Extracts the request-scoped {@link DecafRequestContext} attached to the
   * Express request (under `request.decafContext`), if any.
   * @protected
   * @param {Request} request - The Express request being processed.
   * @return {DecafRequestContext | undefined} The attached decaf request context, or `undefined` when absent.
   */
  protected resolveRequestContext(
    request: Request
  ): DecafRequestContext | undefined {
    return (request as any)?.decafContext as
      | DecafRequestContext
      | undefined;
  }
}
