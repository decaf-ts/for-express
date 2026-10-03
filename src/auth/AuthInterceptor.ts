/**
 * @module for-express/auth/AuthInterceptor
 * @summary Per-request auth enforcement and flavour transformer application for Express routes.
 * @description Provides the Express counterpart of the Nest `AuthInterceptor`: it runs the
 * registered {@link AuthHandler} against the route's resolved auth configuration
 * (model, public flag, roles, namespaces) and then applies every registered adapter
 * flavour's {@link RequestToContextTransformer} so persisted pending data is
 * accumulated into the {@link DecafRequestContext}.
 *
 * Because Express has no interceptor or reflection layer, the auth configuration is
 * passed explicitly by the generated router registration (see `DecafModelModule`)
 * instead of being read from decorator metadata.
 */
import { Constructor } from "@decaf-ts/decoration";
import { Logging } from "@decaf-ts/logging";
import { Adapter } from "@decaf-ts/core";
import { RequestToContextTransformer } from "@decaf-ts/for-http/server";

import type { AuthHandler } from "../types";
import { DecafRequestContext } from "../request/DecafRequestContext";

/**
 * Per-route auth configuration handed to the {@link AuthInterceptor} by the
 * generated router registration.
 *
 * @typedef AuthInterceptorOptions
 * @property {string | Constructor} [model] - The model name or constructor being accessed; forwarded to the auth handler for model-level role/namespace resolution.
 * @property {boolean} [public] - When `true`, authorization is skipped entirely and only the flavour transformers run.
 * @property {string[]} [roles] - Route-level roles required to access the route.
 * @property {string[]} [namespaces] - Route-level namespaces required to access the route.
 * @property {boolean} [skipModelRoles] - When `true`, model-level role validation is skipped.
 * @property {boolean} [skipModelNamespaces] - When `true`, model-level namespace validation is skipped.
 *
 * @category Auth
 */
export type AuthInterceptorOptions = {
  model?: string | Constructor;
  public?: boolean;
  roles?: string[];
  namespaces?: string[];
  skipModelRoles?: boolean;
  skipModelNamespaces?: boolean;
};

/**
 * Express equivalent of the Nest `AuthInterceptor`: runs the registered
 * {@link AuthHandler} against the route's resolved auth configuration and then
 * applies the flavour transformers.
 *
 * Unlike Nest, Express has no interceptor/reflection layer, so the auth
 * configuration is passed in explicitly by the generated router registration
 * instead of being read from decorator metadata.
 *
 * @class AuthInterceptor
 * @description Runs a route's authorization and adapter flavour transformers against a {@link DecafRequestContext}.
 * @summary Instantiated per request by the generated router handlers (`DecafModelModule`), which pass the module's
 * `authHandler` plus the route's {@link AuthInterceptorOptions}. `intercept` either skips auth for public routes,
 * delegates to the {@link AuthHandler} for protected ones, or logs an error that the request is running
 * unauthenticated when no handler is registered — and then applies
 * every registered adapter flavour's `RequestToContextTransformer` to accumulate pending data into the context.
 * @category Auth
 *
 * @example
 * const interceptor = new AuthInterceptor(myAuthHandler, {
 *   model: "User",
 *   roles: ["admin"],
 * });
 * await interceptor.intercept(context, req, res);
 */
export class AuthInterceptor {
  /**
   * Creates the interceptor for a single route invocation.
   *
   * @param {AuthHandler} [authHandler] - The registered auth handler; when omitted, authorization is skipped and only logged.
   * @param {AuthInterceptorOptions} [options] - The resolved per-route auth configuration (model, public flag, roles, namespaces).
   */
  constructor(
    protected readonly authHandler?: AuthHandler,
    protected readonly options: AuthInterceptorOptions = {}
  ) {}

  /**
   * Runs authorization (unless the route is public or no handler is registered)
   * and then applies the adapter flavour transformers.
   *
   * @param {DecafRequestContext} context - The request-scoped context under construction; transformers accumulate into it.
   * @param {any} req - The Express request, passed through to the auth handler.
   * @param {any} [_res] - The Express response. Currently unused but kept so call sites can forward both arguments.
   * @return {Promise<void>} Resolves once authorization has run and all flavour transformers have accumulated their output into the context.
   */
  async intercept(
    context: DecafRequestContext,
    req: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _res?: any
  ): Promise<void> {
    const log = Logging.for(this as any).for(this.intercept);

    const { model, public: isPublic, roles, namespaces } = this.options;

    if (isPublic) {
      log.debug(`Public route — skipping auth`);
    } else if (this.authHandler) {
      await this.authHandler.authorize(
        req,
        model as string | Constructor,
        roles,
        namespaces,
        this.options.skipModelNamespaces,
        context
      );
    } else {
      log.error(
        `No auth handler registered for model "${String(
          model ?? "unknown"
        )}" — the route is running UNAUTHENTICATED. Register an authHandler or mark the route public.`
      );
    }

    await this.applyTransformers(context);
  }

  /**
   * Applies every registered adapter flavour's `RequestToContextTransformer`
   * to the context.
   *
   * Resolves the flavours registered on `Adapter.flavoursToTransform()`, instantiates
   * each transformer when necessary, and accumulates the transformed output into the
   * context so it is available to the controller that runs after this interceptor.
   *
   * @param {DecafRequestContext} context - The request-scoped context to accumulate transformer output into.
   * @return {Promise<void>} Resolves when all registered flavour transformers have been applied.
   * @protected
   */
  protected async applyTransformers(
    context: DecafRequestContext
  ): Promise<void> {
    const flavours = Adapter.flavoursToTransform();
    if (!flavours) return;

    for (const flavour of flavours) {
      const transformer = Adapter.transformerFor(
        flavour
      ) as RequestToContextTransformer<any>;
      if (!transformer) continue;
      const instance = (transformer as any).from
        ? transformer
        : new (transformer as any)();
      const from = await instance.from(context);
      if (from) context.accumulate(from);
    }
  }
}
