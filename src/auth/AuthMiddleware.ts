/**
 * @module for-express/auth/AuthMiddleware
 * @summary Early Express middleware that contextualizes the request and primes the auth handler.
 * @description Mounts a `RequestHandler` that lazily creates (or reuses) the {@link DecafRequestContext}
 * stored on the request, populates it via {@link contextualizeRequestContext}, and — when an
 * {@link AuthHandler} is registered — primes it (`prime`) so authentication data is bound to the
 * context as early as possible. Priming is best-effort; the per-route authorization performed by
 * {@link AuthInterceptor} still runs and will surface a real auth error.
 *
 * Mirrors the Nest integration's global guard pipeline: what Nest performs in a guard's
 * `canActivate`, Express performs here before the route handler executes.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { AuthHandler } from "../types";
import { DecafRequestContext } from "../request/DecafRequestContext";
import { contextualizeRequestContext } from "../request/contextualize";

/**
 * Express middleware that contextualizes the request and primes the registered
 * {@link AuthHandler} as early as possible.
 *
 * Priming is best-effort: the per-route authorization performed by
 * {@link AuthInterceptor} still runs and will surface a real auth error.
 *
 * @class AuthMiddleware
 * @description Express middleware that builds the {@link DecafRequestContext} and primes the {@link AuthHandler} per request.
 * @summary Instantiated once at bootstrap with the module's `authHandler`; the `handler` getter returns the
 * `RequestHandler` mounted on generated routes. It reuses a context already attached to the request
 * (`req.decafContext`), contextualizes it, and lets the auth handler bind auth data before `next()` is called.
 * @category Auth
 *
 * @example
 * const middleware = new AuthMiddleware(new MyAuthHandler());
 * app.use("/users", middleware.handler);
 */
export class AuthMiddleware {
  /**
   * Creates the middleware.
   *
   * @param {AuthHandler} [authHandler] - The auth handler to prime per request; when omitted, only contextualization runs.
   */
  constructor(protected readonly authHandler?: AuthHandler) {}

  /**
   * Returns the Express request handler performing contextualization and auth priming.
   *
   * The handler creates (or reuses) the {@link DecafRequestContext} stored on the
   * request, populates it with flags/headers/logger/operation via
   * {@link contextualizeRequestContext}, and then — best-effort — invokes
   * `authHandler.prime` to bind authentication data. Priming failures are swallowed
   * here because route-level authorization still runs in {@link AuthInterceptor}.
   *
   * @return {RequestHandler} The `RequestHandler` to mount before generated route handlers.
   */
  get handler(): RequestHandler {
    return async (
      req: Request,
      _res: Response,
      next: NextFunction
    ): Promise<void> => {
      const context =
        (req as any).decafContext ??
        ((req as any).decafContext = new DecafRequestContext(req, _res));
      contextualizeRequestContext(context, req);
      if (this.authHandler) {
        try {
          await this.authHandler.prime(req as any, context as any);
        } catch {
          // Priming is best-effort. The interceptor will still perform
          // validation on routes that require it.
        }
      }
      next();
    };
  }
}
