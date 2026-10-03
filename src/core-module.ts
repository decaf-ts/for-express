/**
 * @module for-express/core-module
 * @summary Static core module holding the bootstrap responsibilities of the Express integration.
 * @description Provides {@link DecafCoreModule}, the Express equivalent of the
 * Nest `DecafCoreModule`. Since Express has no DI container or module
 * lifecycle, it exposes the core responsibilities as static helpers: booting
 * the persistence layer (adapters plus request-to-context transformers) from
 * the {@link DecafModuleOptions | module options}, building the request-context
 * middleware pipeline (context creation, auth and handlers) and shutting
 * adapters and services down. Consumed by {@link DecafModule.forRoot}.
 */
import type { Request, RequestHandler, Response } from "express";
import {
  Adapter,
  PersistenceService,
  Service,
} from "@decaf-ts/core";
import { InternalError } from "@decaf-ts/db-decorators";
import { Constructor } from "@decaf-ts/decoration";
import { Logger, Logging } from "@decaf-ts/logging";
import {
  RequestToContextTransformer,
  requestToContextTransformer,
} from "@decaf-ts/for-http/server";

import type { DecafModuleOptions } from "./types";
import { DecafRequestContext } from "./request/DecafRequestContext";
import { DecafHandlerExecutor } from "./request/DecafHandlerExecutor";
import { contextualizeRequestContext } from "./request/contextualize";
import { AuthMiddleware } from "./auth/AuthMiddleware";
import type { AuthHandler } from "./types";

/**
 * Express equivalent of the Nest `DecafCoreModule`.
 *
 * Since Express has no DI container or module lifecycle, this class exposes the
 * same responsibilities as static helpers: booting persistence, wiring the
 * request-context pipeline and shutting adapters/services down.
 */
/**
 * @class DecafCoreModule
 * @description Static core module for the Express integration.
 * @summary Express equivalent of the Nest `DecafCoreModule`.
 *
 * Since Express has no DI container or module lifecycle, this class exposes the
 * same responsibilities as static helpers: booting persistence, wiring the
 * request-context pipeline and shutting adapters/services down.
 * @category Core Module
 */
export class DecafCoreModule {
  /**
   * Lazily created logger for the core module.
   * @private
   */
  private static _logger?: Logger;

  /**
   * Persistence service booted from the module options by
   * {@link DecafCoreModule.bootPersistence | bootPersistence}; `undefined` until the first boot.
   * @private
   */
  private static _persistence?: PersistenceService<
    Adapter<any, any, any, any>
  >;

  /**
   * @function persistence
   * @protected
   * @description Accessor for the booted persistence service.
   * @summary Returns the persistence service, throwing if persistence has not been booted yet.
   * @return {PersistenceService<Adapter<any, any, any, any>>} The booted persistence service.
   * @throws {InternalError} If {@link DecafCoreModule.bootPersistence | bootPersistence} has not been called.
   * @category Core Module
   */
  protected static get persistence(): PersistenceService<
    Adapter<any, any, any, any>
  > {
    if (!this._persistence)
      throw new InternalError("Persistence service not initialized");
    return this._persistence;
  }

  /**
   * @function log
   * @protected
   * @description Lazily creates and returns the module logger.
   * @summary Returns the shared {@link Logger} for the core module, creating it on first access.
   * @return {Logger} The logger scoped to {@link DecafCoreModule}.
   * @category Core Module
   */
  protected static get log(): Logger {
    if (!this._logger) this._logger = Logging.for(DecafCoreModule);
    return this._logger;
  }

  /**
   * @function bootPersistence
   * @description Boots the persistence layer from the module options, registering the
   * request-to-context transformers for every adapter flavour.
   *
   * Each configuration entry is trimmed of its trailing transformer argument
   * before being handed to `PersistenceService.boot`. For every booted adapter,
   * a request-to-context transformer is then resolved — from the provided
   * configuration entry, or from the flavour's registered transformer — and
   * registered via {@link requestToContextTransformer}, failing hard when no
   * transformer can be found for a flavour. Finally, the optional
   * `initialization` callback from the options is awaited. Idempotent: the
   * persistence service is only created on the first call; subsequent calls
   * return the already-booted adapters.
   * @summary Boots adapters and their request-to-context transformers, runs the optional initialization hook, and returns the booted adapters. Mutates module state.
   * @param {DecafModuleOptions} options - Module options carrying the adapter configuration, optional request-to-context transformers and the initialization hook.
   * @return {Promise.<Array.<Adapter<any, any, any, any>>>} The booted adapter clients.
   * @throws {InternalError} If no request-to-context transformer can be resolved for an adapter flavour, the transformer cannot be instantiated, or the initialization callback fails.
   * @category Core Module
   */
  static async bootPersistence(
    options: DecafModuleOptions
  ): Promise<Adapter<any, any, any, any>[]> {
    const log = this.log.for(this.bootPersistence);

    if (!this._persistence) {
      const trimmed = options.conf.map(([contr, cfg, ...args]) => {
        const possible = args.pop();
        if (!possible) return [contr, cfg];
        return [contr, cfg, ...args];
      });
      this._persistence = new PersistenceService();
      await this._persistence.boot(trimmed as any);
      const clients = this._persistence.client;
      for (let i = 0; i < clients.length; i++) {
        const c = options.conf[i];
        const possibleTransf = c.slice(2, c.length);
        let transformer = possibleTransf.pop() as any;
        if (
          !transformer ||
          !(transformer as RequestToContextTransformer<any>).from
        ) {
          const contr = Adapter.transformerFor(clients[i].flavour);
          if (!contr)
            throw new InternalError(
              `No transformer found for flavour ${clients[i].flavour}. you should either @requestToContextTransformer or provide a transformer in the config`
            );
          try {
            transformer = (contr as any).from
              ? contr
              : new (contr as Constructor<
                  RequestToContextTransformer<any>
                >)();
          } catch (e: unknown) {
            throw new InternalError(
              `Failed to boot transformer for ${clients[i].flavour}: ${e}`
            );
          }
        }
        requestToContextTransformer(clients[i].flavour)(transformer);
      }
      log.info("persistence layer created successfully!");

      if (options.initialization) {
        try {
          await options.initialization();
        } catch (e: unknown) {
          throw new InternalError(`Failed to initialize application: ${e}`);
        }
      }
    }

    return this.persistence.client;
  }

  /**
   * @function buildRequestPipeline
   * @description Builds the request-context middleware chain: context creation + auth
   * priming, then the registered {@link DecafHandlerExecutor} handlers.
   *
   * `contextFor` is idempotent per request — it reuses the context previously
   * stored on the request (re-contextualizing it) or creates and caches a fresh
   * {@link DecafRequestContext}. The returned `authMiddleware` wraps the
   * optional `authHandler` from the options (an {@link AuthMiddleware}); the
   * returned `handlersMiddleware` executes the instantiated
   * {@link DecafRequestHandler} classes and forwards errors to the Express
   * error path.
   * @summary Assembles the auth middleware, the handlers middleware and the shared `contextFor` resolver from the module options.
   * @param {DecafModuleOptions} options - Module options carrying the optional auth handler and request handler classes.
   * @return {{authMiddleware: RequestHandler, handlersMiddleware: RequestHandler, contextFor: function(Request, Response): DecafRequestContext}} The auth middleware, the handlers middleware, and a per-request resolver for the {@link DecafRequestContext}.
   * @category Core Module
   */
  static buildRequestPipeline(options: DecafModuleOptions): {
    authMiddleware: RequestHandler;
    handlersMiddleware: RequestHandler;
    contextFor: (req: Request, res: Response) => DecafRequestContext;
  } {
    const authHandler: AuthHandler | undefined = options.authHandler;
    const handlers = (options.handlers ?? []).map((H) => new H());

    const contextFor = (req: Request, res: Response): DecafRequestContext => {
      const existing = (req as any).decafContext as
        | DecafRequestContext
        | undefined;
      if (existing) {
        contextualizeRequestContext(existing, req);
        return existing;
      }
      const context = new DecafRequestContext(req, res);
      (req as any).decafContext = context;
      contextualizeRequestContext(context, req);
      return context;
    };

    const authMiddleware = new AuthMiddleware(authHandler).handler;

    const handlersMiddleware: RequestHandler = async (req, res, next) => {
      try {
        const context = contextFor(req, res);
        const executor = new DecafHandlerExecutor(handlers, context);
        await executor.exec(req, res);
        next();
      } catch (e) {
        next(e);
      }
    };

    return { authMiddleware, handlersMiddleware, contextFor };
  }

  /**
   * @function shutdown
   * @description Shuts down every booted adapter and the global service registry.
   *
   * Iterates the booted adapters, calling `shutdown` on each and logging
   * individual failures without aborting, then shuts down the global decaf
   * {@link Service} registry. Safe to call when persistence was never booted.
   * @summary Gracefully shuts down all booted adapters and the service registry, logging any per-adapter or registry failures. Mutates module state.
   * @return {Promise<void>} Resolves once all shutdown attempts completed.
   * @category Core Module
   */
  static async shutdown(): Promise<void> {
    const log = this.log.for(this.shutdown);
    if (this._persistence) {
      for (const adapter of this._persistence.client) {
        try {
          if (adapter) {
            log.info(`Shutting down ${adapter.toString()}`);
            await adapter.shutdown();
          }
        } catch (e: unknown) {
          log.error(`Failed to shutdown application`, e as Error);
        }
      }
    }
    try {
      await Service.shutdown();
    } catch (e: unknown) {
      log.error(`Failed to shutdown services`, e as Error);
    }
  }
}
