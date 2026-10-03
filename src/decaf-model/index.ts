/**
 * @module for-express/decaf-model
 * @summary Public barrel for the Express model-controller layer.
 * @description Aggregates the {@link module:for-express/decaf-model/decorators |
 * model decorators} (`@expose`, `@controllerConfig`, `@Auth`), the shared
 * types, the internal route-building utilities, the {@link getModuleFor}
 * per-flavour module factory, and the {@link FromModelController} bridge that
 * turns tracked models into Express routes. This is the surface consumed by
 * the package bootstrap when assembling a flavour's model router.
 */

export * from "./decorators";
export * from "./types";
export * from "./utils";
export * from "./DecafModelModule";
export * from "./FromModelController";
