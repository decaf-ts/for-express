/**
 * @module for-express/module
 * @summary Server bootstrap: `DecafModule.forRoot` and the `ExpressDecafApp` bundle.
 * @description Provides {@link DecafModule}, the Express equivalent of the Nest
 * `DecafModule`, whose `forRoot` factory boots the persistence layer through
 * {@link DecafCoreModule.bootPersistence | bootPersistence}, mounts the request
 * pipeline (context, handlers and auth) and, when enabled, the auto-generated
 * model routes and the SSE observer events router. The result is an
 * {@link ExpressDecafApp} bundle whose {@link Router} can be mounted on any
 * Express application.
 */
import { Router } from "express";
import { Adapter } from "@decaf-ts/core";
import { InternalError } from "@decaf-ts/db-decorators";

import type { DecafModuleOptions } from "./types";
import { DecafCoreModule } from "./core-module";
import { getModuleFor } from "./decaf-model/DecafModelModule";
import { EventsRouter } from "./events-module/EventsRouter";
import { ObserverSubscriptionRegistry } from "./events-module/ObserverSubscriptionRegistry";
import { DecafRequestContext } from "./request/DecafRequestContext";

/**
 * @typedef ExpressDecafApp
 * @description The application bundle produced by {@link DecafModule.forRoot}.
 * @summary Mountable router plus the booted adapters, the request-context resolver and a shutdown hook.
 * @property {Router} router - Router mounting the request pipeline, model routes and SSE events.
 * @property {Array.<Adapter<any, any, any, any>>} adapters - Adapter instances booted from the persistence configuration.
 * @property {string[]} flavours - The booted adapter flavours.
 * @property {function(Request, Response): DecafRequestContext} contextFor - Resolves (or creates) the request context for a request.
 * @property {function(): Promise.<void>} shutdown - Shuts down every booted adapter and the service registry.
 * @category Module
 */
export type ExpressDecafApp = {
  /** Router mounting the request pipeline, model routes and SSE events. */
  router: Router;
  /** Adapter instances booted from the persistence configuration. */
  adapters: Adapter<any, any, any, any>[];
  /** The booted adapter flavours. */
  flavours: string[];
  /** Resolves (or creates) the request context for a request. */
  contextFor: (
    req: import("express").Request,
    res: import("express").Response
  ) => DecafRequestContext;
  /** Shuts down every booted adapter and the service registry. */
  shutdown: () => Promise<void>;
};

/**
 * @class DecafModule
 * @description Server bootstrap for the Express integration.
 * @summary Express equivalent of the Nest `DecafModule`.
 *
 * `forRoot` boots persistence, mounts the request pipeline (context + handlers +
 * auth) and, when enabled, the auto-generated model routes and the SSE events
 * router, returning a mountable Express {@link Router}.
 *
 * @example
 * ```ts
 * const app = express();
 * app.use(express.json());
 * const decaf = await DecafModule.forRoot({
 *   conf: [[MyAdapter, {}]],
 *   autoControllers: true,
 *   authHandler: new MyAuthHandler(),
 * });
 * app.use(decaf.router);
 * ExpressBootstraper.initialize(app).useGlobalFilters().start(3000);
 * ```
 * @category Module
 */
export class DecafModule {
  /**
   * @function forRoot
   * @description Boots the Express flavour of the decaf server from the module
   * options. Delegates persistence boot to
   * {@link DecafCoreModule.bootPersistence | bootPersistence}, mounts the auth
   * and handlers middleware on a fresh {@link Router}, and — when
   * `autoControllers` is enabled — mounts the per-flavour model module routers
   * built by `getModuleFor`, exposing auto-generated model routes. When
   * `observerOptions.enableObserverEvents` is set, also mounts the SSE
   * {@link EventsRouter} under `observerOptions.observerApiPath` (default
   * `/events`). Fails closed when `autoControllers` is enabled without an
   * `authHandler` unless `allowAnonymous` is explicitly `true`; SSE routes are
   * mounted before the generated model routes so a single-segment model path
   * cannot shadow `/events`. Idempotency is delegated to the persistence boot;
   * calling this twice boots a new pipeline but reuses the registered
   * persistence service.
   * @summary Express equivalent of the Nest `DecafModule.forRoot`: boots adapters, builds the request pipeline and returns the mountable application bundle.
   * @param {DecafModuleOptions} options - Module options: adapter configuration, auto-controller/auto-service flags, optional auth handler, request handlers and observer (SSE) options.
   * @return {Promise<ExpressDecafApp>} The application bundle with the mountable router, booted adapters and flavours, the request-context resolver and a shutdown hook.
   * @category Module
   */
  static async forRoot(
    options: DecafModuleOptions
  ): Promise<ExpressDecafApp> {
    const { autoControllers, autoServices } = options;

    if (autoControllers && !options.authHandler && options.allowAnonymous !== true) {
      throw new InternalError(
        "DecafModule.forRoot: autoControllers is enabled but no authHandler was provided. " +
          "Pass an authHandler to authenticate generated routes, or set allowAnonymous: true to explicitly run them unauthenticated."
      );
    }

    const adapters = await DecafCoreModule.bootPersistence(options);
    const flavours = adapters.map((adapter) => adapter.flavour);

    const pipeline = DecafCoreModule.buildRequestPipeline(options);
    const router = Router();

    router.use(pipeline.authMiddleware);
    router.use(pipeline.handlersMiddleware);

    // Mount fixed-prefix SSE routes before the parametric generated model
    // routes so a single-segment model route (e.g. `GET /:productCode`) cannot
    // shadow `/events`.
    if (options.observerOptions?.enableObserverEvents) {
      const observerOptions = options.observerOptions;
      const registry = new ObserverSubscriptionRegistry();
      const events = new EventsRouter({
        flavours: observerOptions.observerFlavours || flavours,
        options: observerOptions,
        registry,
        contextFor: pipeline.contextFor,
        authMiddleware: pipeline.authMiddleware,
      });
      const apiPath = (observerOptions.observerApiPath ?? "/events").replace(
        /^\/+/,
        ""
      );
      router.use(`/${apiPath}`, events.router);
    }

    if (autoControllers) {
      for (const flavour of flavours) {
        const built = getModuleFor(flavour).forRoot(flavour, {
          autoServices,
          controllerExposure: options.controllerExposure,
          controllerConfig: options.controllerConfig,
          aggregations: options.aggregations,
          authHandler: options.authHandler,
          contextFor: pipeline.contextFor,
          authMiddleware: pipeline.authMiddleware,
        });
        router.use(built.router);
      }
    }

    return {
      router,
      adapters,
      flavours,
      contextFor: pipeline.contextFor,
      shutdown: () => DecafCoreModule.shutdown(),
    };
  }
}

/**
 * @function runMigrations
 * @deprecated Use {@link DecafModule.forRoot}; retained for parity with the Nest
 * integration, where migrations are run through the Nest CLI.
 * @summary No-op migration runner kept for API parity with `@decaf-ts/for-nest`.
 * @return {Promise<void>} Resolves immediately without performing any work.
 * @category Module
 */
export async function runMigrations(): Promise<void> {}
