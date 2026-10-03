/**
 * @module for-express/request/contextualize
 * @summary Idempotent population of the {@link DecafRequestContext} from an Express request.
 * @description Provides the helper that fills a freshly created request context with the default
 * adapter flags, request headers, an IP-bound logger, timestamp, operation string and an
 * idempotency marker. Mirrors the Nest integration's contextualization helper but reads directly
 * from the Express request instead of a Nest execution context.
 */
import { DefaultAdapterFlags } from "@decaf-ts/core";
import { Logging, Logger } from "@decaf-ts/logging";

import { DecafRequestContext } from "./DecafRequestContext";
import { type DecafServerFlags } from "../constants";

/**
 * Context key marking a {@link DecafRequestContext} as already contextualized, so
 * {@link contextualizeRequestContext} runs at most once per request.
 *
 * @const REQUEST_CONTEXTUALIZED_KEY
 * @description Internal context key (`"__decafRequestContextContextualized"`) checked and set by {@link contextualizeRequestContext} to guarantee idempotent contextualization.
 * @category Request Context
 */
const REQUEST_CONTEXTUALIZED_KEY = "__decafRequestContextContextualized";

/**
 * Populates the request context with the default adapter flags, headers,
 * overrides, timestamp, operation and IP-bound logger exactly once per request.
 *
 * Mirrors the Nest integration helper but reads directly from the Express
 * request instead of a Nest execution context.
 *
 * @function contextualizeRequestContext
 * @description Populates the request context once per request with flags, headers, logger, timestamp and operation.
 * @summary Guards with the {@link REQUEST_CONTEXTUALIZED_KEY} marker (returns `false` when already contextualized),
 * builds the `DecafServerFlags` from the request headers, resolves the request IP via
 * `x-forwarded-for` / `x-real-ip` (falling back to `req.ip`) to bind a request-scoped logger, and
 * accumulates the merged `DefaultAdapterFlags`, logger, timestamp and `"METHOD /url"` operation
 * into the context.
 * @param {DecafRequestContext} requestContext - The request context to populate.
 * @param {any} req - The Express request supplying headers, method, url and IP.
 * @return {boolean} `true` when the context was populated, `false` when it was already contextualized.
 * @category Request Context
 */
export function contextualizeRequestContext(
  requestContext: DecafRequestContext,
  req: any
): boolean {
  if (requestContext.getOrUndefined(REQUEST_CONTEXTUALIZED_KEY as any)) {
    return false;
  }

  const headers = req.headers;
  const flags: DecafServerFlags = {
    headers: headers,
    overrides: {},
  } as any;

  const ip = extractIp(req);
  const currentLog = requestContext.getOrUndefined("logger" as any) as
    | Logger
    | undefined;
  const logger = ip
    ? (currentLog ?? Logging.get()).for({ ip })
    : currentLog ?? Logging.get();

  requestContext.accumulate(
    Object.assign(
      {},
      DefaultAdapterFlags,
      {
        logger,
        timestamp: new Date(),
        operation: `${req.method} ${req.url}`,
      },
      flags,
      { [REQUEST_CONTEXTUALIZED_KEY]: true }
    )
  );

  return true;
}

/**
 * Extracts the client IP from an Express request.
 *
 * Parses `x-forwarded-for` (first comma-separated entry), then `x-real-ip`, trying both
 * lowercase and title-case header variants, and finally falls back to Express's `req.ip`.
 *
 * @function extractIp
 * @param {any} req - The Express request whose headers are inspected.
 * @return {string | undefined} The first resolvable client IP, or `undefined` when no source yields one.
 * @category Request Context
 */
function extractIp(req: any): string | undefined {
  const headers = req.headers;
  function parseIpHeader(value?: string | string[]): string | undefined {
    if (!value) return undefined;
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate
      .split(",")
      .map((segment) => segment.trim())
      .filter(Boolean)[0];
  }
  return (
    parseIpHeader(headers?.["x-forwarded-for"]) ??
    parseIpHeader(headers?.["x-real-ip"]) ??
    parseIpHeader(headers?.["X-Forwarded-For"]) ??
    parseIpHeader(headers?.["X-Real-IP"]) ??
    req.ip
  );
}
