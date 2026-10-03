export * from "./errors";
export * from "./exceptions";
export * from "./openapi";
export * from "./ExpressBootstraper";

/**
 * @module for-express/factory
 * @summary Barrel for the `for-express` factory layer.
 * @description Aggregates everything needed to bootstrap and harden an Express
 * application with decaf semantics: the fluent {@link ExpressBootstraper}, the
 * factory-level errors ({@link CorsError}, {@link ToManyRequestsError}), the
 * {@link DecafErrorFilter} exception handler and the {@link SwaggerBuilder}
 * OpenAPI tooling with its {@link SwaggerSetupOptions} and path constants.
 */
