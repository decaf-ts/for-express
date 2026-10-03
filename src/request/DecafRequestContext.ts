/**
 * @module for-express/request/DecafRequestContext
 * @summary Express implementation of the per-request Decaf context.
 * @description Provides the `RequestContext` specialization for Express: a fresh instance is
 * created per HTTP request (either by the {@link AuthMiddleware} or by the bootstrap's
 * `contextFor` factory), wraps the Express `Request`/`Response` pair, accumulates auth data,
 * overrides and transformer output, and finally writes pending-task hints back onto the
 * response via `toResponse`.
 */
import { UUID } from "@decaf-ts/core";
import { RequestContext } from "@decaf-ts/for-http/server";
import type { Request, Response } from "express";

import { DecafServerCtx } from "../constants";

/**
 * Express implementation of the framework-agnostic {@link RequestContext}.
 *
 * A fresh instance is created per HTTP request (see the request-scoped
 * {@link DecafHandlerExecutor}); it wraps the Express `Request`/`Response` pair
 * so the generated controllers and auth handlers can read headers, resolve
 * overrides and write pending-task hints back onto the response.
 *
 * @class DecafRequestContext
 * @description Per-request context wrapping the Express request/response and accumulating Decaf context data.
 * @summary Extends the framework-agnostic `RequestContext` from `@decaf-ts/for-http/server`, exposing the
 * typed `request`/`response` pair, a generated `uuid`, and an Express-specific `headers` getter. `put`
 * merges records into the context `overrides` bucket (mirroring the Nest request-scoped override
 * accumulation), and `toResponse` serializes the pending-task hint onto the `x-pending-task` response header.
 * @template C - The server context flags type, constrained to {@link DecafServerCtx}; defaults to `DecafServerCtx`.
 * @extends {RequestContext}
 * @see RequestContext Base class from `@decaf-ts/for-http/server`.
 * @category Request Context
 */
export class DecafRequestContext<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  C extends DecafServerCtx = DecafServerCtx,
> extends RequestContext<Request> {
  /**
   * Unique identifier generated for this request's context, used in logging and correlation.
   *
   * @type {string}
   */
  uuid = UUID.instance.generate();
  /**
   * The Express request this context wraps.
   *
   * @type {Request}
   * @override
   */
  override readonly request: Request;
  /**
   * The Express response associated with the request, when available.
   *
   * @type {Response}
   */
  readonly response?: Response;

  /**
   * Creates the context for a single request.
   *
   * Configures the base context with an Express-aware `headersOf` accessor so header
   * resolution works without a framework-specific registry.
   *
   * @param {Request} req - The Express request to wrap.
   * @param {Response} [res] - The Express response associated with the request, when available.
   */
  constructor(req: Request, res?: Response) {
    super(
      {
        headersOf: (request: Request) => (request as any)?.headers || undefined,
      } as any,
      req
    );
    this.request = req;
    this.response = res;
  }

  /**
   * Returns the request headers, or `undefined` when none were captured.
   *
   * @return {Record<string, string | string[] | undefined> | undefined} The raw Express request headers, or `undefined`.
   */
  get headers(): Record<string, string | string[] | undefined> | undefined {
    return this.getOrUndefined("headers" as any);
  }

  /**
   * Merges a record into the context `overrides` bucket, mirroring the
   * Nest integration's request-scoped override accumulation.
   *
   * @param {Record<any, any>} record - The overrides to merge into the existing bucket (existing keys win in `Object.assign` order from the previous bucket).
   * @return {void}
   */
  put(record: Record<any, any>) {
    let overrides: any;
    try {
      overrides = this.get("overrides");
    } catch {
      overrides = {};
    }

    this.accumulate({
      overrides: Object.assign(overrides, record),
    });
  }

  /**
   * Writes the pending-task hint (if any) onto the Express response so clients
   * can observe asynchronous task state, and returns the response unchanged.
   *
   * @template RES - The response type being finalized.
   * @param {RES} res - The response object to annotate; must expose a `header` function for the hint to be written.
   * @return {RES} The same response, unchanged except for the `x-pending-task` header when a pending task exists.
   * @override
   */
  override toResponse<RES = any>(res: RES): RES {
    const pending = (this as any).pending?.();
    if (pending && res && typeof (res as any).header === "function") {
      (res as any).header("x-pending-task", JSON.stringify(pending));
    }
    return res;
  }
}
