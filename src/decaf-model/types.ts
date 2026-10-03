/**
 * @module for-express/decaf-model/types
 * @summary Shared type definitions for the Express model-controller layer.
 * @description Exposes the {@link ControllerConstructor} type used when
 * building concrete controllers from models, and the {@link DecoratorBundle}
 * shape used to carry grouped method and parameter decorators when assembling
 * framework-agnostic model routes for Express. Mirrors the corresponding
 * types in the Nest integration.
 */

import { DecafModelController } from "../controllers";
import { Model } from "@decaf-ts/decorator-validation";

/**
 * Constructor of a Decaf model controller.
 *
 * @typedef ControllerConstructor
 * @template T - The model type the controller operates on; must extend
 * {@link Model<boolean>}.
 * @description Describes any class whose instances are
 * {@link DecafModelController}s for the given model, regardless of the
 * constructor arguments they accept. Used by the model-route machinery when
 * instantiating generated or hand-written controllers.
 * @summary Type of constructors producing {@link DecafModelController} instances.
 * @category Decaf Model Routes
 */
export type ControllerConstructor<T extends Model<boolean>> = new (
  ...args: any[]
) => DecafModelController<T>;

/**
 * A bundle of decorators attached to a generated model route.
 *
 * @typedef DecoratorBundle
 * @description Groups the method decorators for a route with the optional
 * parameter decorators for its handler, mirroring how the Nest integration
 * attaches `@Get`/`@Post`-style decorators plus parameter decorators to
 * generated controller methods.
 * @summary Method decorators plus optional parameter decorators for a route.
 * @property {MethodDecorator[]} method - Decorators applied to the route
 * method.
 * @property {ParameterDecorator[]} [params] - Decorators applied to the
 * handler's parameters, when applicable.
 * @category Decaf Model Routes
 */
export type DecoratorBundle = {
  method: MethodDecorator[];
  params?: ParameterDecorator[];
};
