/**
 * @module for-express/decaf-model/decorators/controller-config
 * @summary Decorator attaching controller factory configuration to a Model.
 * @description Provides the {@link controllerConfig} class decorator, which
 * stores a for-http {@link ModelControllerFactoryConfig} as metadata under
 * `DECAF_CONTROLLER_CONFIG`. The configuration is picked up by
 * `FromModelController.create()` (from
 * {@link module:for-express/decaf-model/FromModelController |
 * FromModelController}) and passed to `ModelControllerFactory.create()` when
 * generating the model's Express routes. This mirrors the Nest integration's
 * controller-config decorator.
 */

import { Metadata } from "@decaf-ts/decoration";
import type { ModelControllerFactoryConfig } from "@decaf-ts/for-http/server";

import { DECAF_CONTROLLER_CONFIG } from "../../constants";

/**
 * Class decorator that attaches a {@link ModelControllerFactoryConfig} to a Model,
 * so `FromModelController.create()` can pass it to `ModelControllerFactory.create()`.
 *
 * The per-model config can be overridden by the module-level `controllerConfig`
 * option in `DecafModuleOptions`.
 *
 * @function controllerConfig
 * @description Stores the given configuration in the model's metadata under
 * the `DECAF_CONTROLLER_CONFIG` key. At route-generation time the config is
 * merged with (and takes precedence over) the global defaults, while per-model
 * entries in the module options' `controllerConfig` take precedence over the
 * decorator.
 * @summary Decorator factory configuring the generated controller for a model.
 * @param {ModelControllerFactoryConfig} config - The controller factory
 * configuration (query/aggregation toggles, auth config, etc.).
 * @return {function} A class decorator that records the configuration on the
 * model constructor.
 * @category Decaf Model Routes
 * @example
 * ```typescript
 * @controllerConfig({ allowStatementlessQuery: false })
 * @table("users")
 * export class User extends Model<{ id: string }> {
 *   // ...
 * }
 * ```
 */
export function controllerConfig(config: ModelControllerFactoryConfig) {
  return function controllerConfigDecorator(target: any) {
    Metadata.set(target, DECAF_CONTROLLER_CONFIG, config as any);
    return target;
  };
}
