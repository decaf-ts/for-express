/**
 * @module for-express/decaf-model/decorators
 * @summary Barrel for the model decorators of the Express integration.
 * @description Aggregates the {@link expose} exposure decorator, the
 * {@link controllerConfig} controller factory configuration decorator, the
 * re-exported {@link Auth} decorator, and the shared decorator types
 * ({@link HttpVerbs}, {@link DecafApiProperty}, {@link DecafModelRoute},
 * {@link DecafParamProps}, {@link DecafRouteDecOptions}). These decorators
 * configure how {@link FromModelController} and
 * {@link module:for-express/decaf-model/DecafModelModule | DecafModelModule}
 * generate Express routes for models.
 */

export * from "./types";
export * from "./expose";
export * from "./decorators";
export * from "./controller-config";
