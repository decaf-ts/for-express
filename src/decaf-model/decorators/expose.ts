/**
 * @module for-express/decaf-model/decorators/expose
 * @summary Decorator controlling which flavours a Model is exposed in.
 * @description Provides the {@link expose} class decorator, which records
 * exposure metadata under the `DECAF_EXPOSE` key. `DecafModelModule.isExposed`
 * (from {@link module:for-express/decaf-model/DecafModelModule |
 * DecafModelModule}) reads this metadata when deciding whether to generate
 * Express routes for a tracked model; models without exposure metadata are
 * exposed in every flavour by default.
 */

import { Metadata } from "@decaf-ts/decoration";

import { DECAF_EXPOSE } from "../../constants";

/**
 * Class decorator that marks a Model as exposed for the given adapter
 * flavours.
 *
 * @function expose
 * @description Stores the flavour list in the model's metadata under the
 * `DECAF_EXPOSE` key. Calling the decorator without arguments (`@expose()`)
 * exposes the model in every flavour; calling it with flavour names limits
 * generated routes to those flavours. Module-level `controllerExposure`
 * overrides in `DecafModelModule.forRoot` take precedence over this metadata.
 * @summary Decorator factory declaring model exposure per flavour.
 * @param {...string} flavours - The adapter flavours the model should be
 * exposed in; omit all arguments to expose in every flavour.
 * @return {function} A class decorator that records the exposure metadata on
 * the model constructor.
 * @category Decaf Model Routes
 * @example
 * ```typescript
 * // Exposed only for the "rest" flavour:
 * @expose("rest")
 * @table("users")
 * export class User extends Model<{ id: string }> {
 *   // ...
 * }
 * ```
 */
export function expose(...flavours: string[]) {
  return function expose(target: any) {
    Metadata.set(
      target,
      DECAF_EXPOSE,
      (flavours.length ? flavours : true) as any
    );
    return target;
  };
}
