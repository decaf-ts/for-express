/**
 * @module for-express/overrides
 * @summary Barrel for the runtime overrides applied by the Express integration.
 * @description Aggregates the patches this package applies to shared Decaf primitives:
 * - side-effect imports of `./overrides` (the `Adapter.transformerFor`,
 *   `Adapter.flavoursToTransform` and `Context.prototype.toResponse` prototype patches) and
 *   `./logging` (activation of the shared server logging parameter registration via
 *   `@decaf-ts/for-http/server`), both of which run at import time because this barrel is
 *   loaded by `for-express/index`;
 * - re-exports of `./Adapter` (ambient typings for those patches), `./constants` (the
 *   swagger-style metadata keys) and `./ModelBuilderExtensions` (the `ModelBuilder`
 *   augmentation and prototype patches).
 */
import "./overrides";
import "./logging";

export * from "./Adapter";
export * from "./constants";
export * from "./overrides";
export * from "./ModelBuilderExtensions";
