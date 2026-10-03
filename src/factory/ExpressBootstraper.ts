/**
 * @module for-express/factory/ExpressBootstraper
 * @summary Fluent, static bootstrap helper for wiring an Express application with decaf factory concerns.
 * @description Provides {@link ExpressBootstraper}, the Express counterpart of the Nest
 * `NestBootstraper`: a chainable entry point that attaches CORS, security headers,
 * rate limiting, global middleware/filters, Swagger documentation and logging to a
 * plain {@link Application} and then starts listening. Re-exports
 * {@link SwaggerSetupOptions} so bootstrap callers can type their Swagger setup.
 */

import type {
  Application,
  ErrorRequestHandler,
  RequestHandler,
} from "express";
import { Logger, Logging } from "@decaf-ts/logging";

import { DecafErrorFilter } from "./exceptions";
import { CorsError } from "./errors";
import {
  SwaggerBuilder,
  type SwaggerSetupOptions,
} from "./openapi";

export type { SwaggerSetupOptions };

/**
 * Fluent, static bootstrap helper for an Express application.
 *
 * @class ExpressBootstraper
 * @description Chainable bootstrap entry point for configuring and starting an Express server.
 * @summary This is the Express equivalent of the Nest `NestBootstraper`. Because Express
 * has no DI container, each configuration method mutates the bound
 * {@link Application} directly and returns the class for chaining. Call
 * {@link ExpressBootstraper.initialize} first, chain any configuration methods,
 * then await {@link ExpressBootstraper.start}. Optional peer middlewares (`cors`,
 * `helmet`, `express-rate-limit`, `swagger-ui-express`) are skipped with a warning
 * when not installed.
 *
 * @example
 * ```ts
 * import express from "express";
 *
 * const app = express();
 *
 * await ExpressBootstraper.initialize(app)
 *   .enableLogger()
 *   .enableCors(["https://example.com"], ["GET", "POST"])
 *   .useHelmet()
 *   .useRateLimit()
 *   .useGlobalMiddleware(express.json())
 *   .useGlobalFilters() // terminal DecafErrorFilter when no handler is given
 *   .setupSwagger({
 *     title: "My API",
 *     description: "Express decaf service",
 *     version: "1.0.0",
 *   })
 *   .start(3000, "localhost");
 * ```
 *
 * @category Bootstrap
 */
export class ExpressBootstraper {
  /**
   * The {@link Application} bound by {@link ExpressBootstraper.initialize}.
   * @private
   */
  private static app: Application;

  /**
   * Lazily created logger, overridable via {@link ExpressBootstraper.enableLogger}.
   * @private
   */
  private static _logger?: Logger;

  /**
   * Logger for bootstrap diagnostics, created on first access.
   * @private
   */
  private static get logger(): Logger {
    if (!this._logger) this._logger = Logging.for(ExpressBootstraper);
    return this._logger;
  }

  /**
   * Binds the Express application to be configured and started.
   * @function initialize
   * @param {Application} app - The Express application instance to bootstrap.
   * @return {ExpressBootstraper} The class itself, for fluent chaining.
   */
  static initialize(app: Application) {
    this.app = app;
    return this;
  }

  /**
   * Enables logging, optionally replacing the default decaf logger.
   * @function enableLogger
   * @param {Logger} [customLogger] - Logger to use instead of the default `Logging.for(ExpressBootstraper)`.
   * @return {ExpressBootstraper} The class itself, for fluent chaining.
   */
  static enableLogger(customLogger?: Logger) {
    this._logger = customLogger || Logging.for(ExpressBootstraper);
    return this;
  }

  /**
   * Attaches CORS middleware with an origin allow-list, mirroring Nest's
   * `app.enableCors()`. Requests without an `Origin` header are always allowed.
   * Credentialed requests (`credentials: true`) are only enabled for an explicit
   * origin allow-list; a wildcard (`"*"`) disables `credentials` and logs a
   * warning, since browsers reject credentialed wildcard CORS responses.
   * Skips silently with a warning when the `cors` package is not installed.
   * @function enableCors
   * @param {"*" | string[]} [origins] - `"*"` to allow any origin, or a list of allowed origins (matched case-insensitively). Defaults to `[]` (none allowed).
   * @param {string[]} [allowMethods] - HTTP methods to allow, joined into the middleware's `methods` option. Defaults to `["GET", "POST", "PUT", "DELETE"]`.
   * @return {ExpressBootstraper} The class itself, for fluent chaining.
   */
  static enableCors(
    origins: "*" | string[] = [],
    allowMethods: string[] = ["GET", "POST", "PUT", "DELETE"]
  ) {
    const allowedOrigins =
      origins === "*" ? "*" : origins.map((o) => o.trim().toLowerCase());

    const credentials = allowedOrigins !== "*";
    if (!credentials) {
      this.logger.warn(
        "enableCors: wildcard origins disables credentialed requests (credentials: false). Use an explicit origin allow-list to allow credentials."
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cors = require("cors");
      this.app.use(
        cors({
          origin: (origin: string | undefined, callback: any) => {
            if (!origin) return callback(null, true);
            if (
              allowedOrigins === "*" ||
              (Array.isArray(allowedOrigins) &&
                allowedOrigins.includes(origin.toLowerCase()))
            )
              return callback(null, true);
            callback(new CorsError(`Origin ${origin} not allowed`));
          },
          credentials,
          methods: allowMethods.join(","),
        })
      );
    } catch {
      this.logger.error("cors not installed. Skipping CORS middleware.");
    }
    return this;
  }

  /**
   * Attaches `helmet` security-header middleware with the given options,
   * mirroring Nest's `HelmetMiddleware`. Skips silently with a warning when
   * the `helmet` package is not installed.
   * @function useHelmet
   * @param {Record<string, any>} [options] - Options forwarded verbatim to `helmet(options)`.
   * @return {ExpressBootstraper} The class itself, for fluent chaining.
   */
  static useHelmet(options?: Record<string, any>) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const helmet = require("helmet");
      this.app.use(helmet(options));
      this.logger.info("Helmet middleware enabled successfully.");
    } catch {
      this.logger.error("Helmet not installed. Skipping middleware.");
    }
    return this;
  }

  /**
   * Builds and mounts the OpenAPI/Swagger endpoints via {@link SwaggerBuilder},
   * the Express counterpart of Nest's `SwaggerModule.setup`. Applies the
   * documented defaults: `path` falls back to `"api"` and
   * `persistAuthorization` to `true`.
   * @function setupSwagger
   * @param {SwaggerSetupOptions} options - Title, description, version and optional mounting options for the Swagger UI.
   * @return {ExpressBootstraper} The class itself, for fluent chaining.
   */
  static setupSwagger(options: SwaggerSetupOptions) {
    const swagger = new SwaggerBuilder(this.app, {
      title: options.title,
      description: options.description,
      version: options.version,
      path: options.path || "api",
      persistAuthorization: options.persistAuthorization ?? true,
      assetsPath: options.assetsPath,
      faviconFilePath: options.faviconFilePath,
      topbarIconFilePath: options.topbarIconFilePath,
      topbarBgColor: options.topbarBgColor,
      openApiJsonPath: options.openApiJsonPath,
      openApiYamlPath: options.openApiYamlPath,
    });
    swagger.setupSwagger();
    return this;
  }

  /**
   * Registers global middleware, mirroring Nest's `app.use(...)` on the
   * Express application. No-op when no handlers are supplied.
   * @function useGlobalMiddleware
   * @param {...RequestHandler} middleware - Express request handlers to register in order.
   * @return {ExpressBootstraper} The class itself, for fluent chaining.
   */
  static useGlobalMiddleware(...middleware: RequestHandler[]) {
    if (middleware.length > 0) this.app.use(...middleware);
    return this;
  }

  /**
   * Registers the terminal error handler. When no handler is supplied the
   * {@link DecafErrorFilter} is used.
   *
   * Mirrors Nest's global exception filters: the handlers are appended after
   * all routes so they receive every error routed through the stack.
   * @function useGlobalFilters
   * @param {...ErrorRequestHandler} filters - Express error handlers; defaults to a single {@link DecafErrorFilter} instance.
   * @return {ExpressBootstraper} The class itself, for fluent chaining.
   */
  static useGlobalFilters(...filters: ErrorRequestHandler[]) {
    this.app.use(
      ...(filters.length > 0
        ? filters
        : [new DecafErrorFilter().handler as unknown as ErrorRequestHandler])
    );
    return this;
  }

  /**
   * Express has no interceptor concept; interceptors are registered as
   * regular middleware.
   *
   * Kept for API parity with the Nest bootstrap: the supplied handlers are
   * appended to the stack (no-op when empty).
   * @function useGlobalInterceptors
   * @param {...RequestHandler} interceptors - Express request handlers acting as interceptors.
   * @return {ExpressBootstraper} The class itself, for fluent chaining.
   */
  static useGlobalInterceptors(...interceptors: RequestHandler[]) {
    if (interceptors.length > 0) this.app.use(...interceptors);
    return this;
  }

  /**
   * Attaches rate limiting via `express-rate-limit`, the Express counterpart
   * of Nest's `@nestjs/throttler`. Defaults to 100 requests per 60s window;
   * supplied options are merged on top of the defaults. Skips silently with a
   * warning when the `express-rate-limit` package is not installed.
   * @function useRateLimit
   * @param {Record<string, any>} [options] - Rate-limit options merged over `{ windowMs: 60000, max: 100 }`.
   * @return {ExpressBootstraper} The class itself, for fluent chaining.
   */
  static useRateLimit(
    options: Record<string, any> = {}
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rateLimit = require("express-rate-limit");
      this.app.use(
        rateLimit({
          windowMs: 60 * 1000,
          max: 100,
          ...options,
        })
      );
    } catch {
      this.logger.error(
        "express-rate-limit not installed. Skipping rate limiting."
      );
    }
    return this;
  }

  /**
   * Starts the bound {@link Application} listening and resolves once the
   * server is up, mirroring Nest's `app.listen`.
   * @function start
   * @param {number} [port] - Port to listen on. Defaults to `process.env.PORT` or 3000.
   * @param {string} [host] - Host interface to bind; falls back to Node's default when omitted.
   * @param {boolean} [log] - Whether to log the running URL. Defaults to `true`.
   * @return {Promise<void>} Resolves after the server successfully starts listening.
   */
  static async start(
    port: number = Number(process.env.PORT) || 3000,
    host?: string,
    log: boolean = true
  ) {
    return new Promise<void>((resolve) => {
      this.app.listen(port, host as any, () => {
        if (log)
          this.logger.info(
            `🚀 Application is running at: http://${host ?? "localhost"}:${port}`
          );
        resolve();
      });
    });
  }
}
