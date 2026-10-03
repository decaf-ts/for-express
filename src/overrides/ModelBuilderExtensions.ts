/**
 * @module for-express/overrides/ModelBuilderExtensions
 * @summary Adds Express auth class-decorator support to {@link ModelBuilder}.
 * @description Augments the `@decaf-ts/decorator-validation` `ModelBuilder` interface with the
 * `Auth` and `decorateClass` builder methods and patches the `ModelBuilder` prototype at
 * import time (this module is a side-effect import wired through
 * `for-express/overrides/index`, and therefore by `for-express/index`).
 *
 * What the patch actually does at runtime:
 * - `decorateClass` accumulates class decorators in the builder's `_classDecorators` bucket so
 *   they can be applied when the model class is built.
 * - `Auth` is a convenience wrapper that pushes the package's {@link Auth} class decorator
 *   (which stamps the auth resource metadata consumed by the Express auth layer).
 * - `build` is wrapped (guarded by the `__hasClassDecoratorSupport` flag so the patch is only
 *   applied once) to replay the accumulated class decorators over the constructor produced by
 *   the original `build`.
 */
import "@decaf-ts/decorator-validation";
import { Constructor } from "@decaf-ts/decoration";
import { ModelBuilder } from "@decaf-ts/decorator-validation";
import { Auth } from "../decaf-model/decorators/decorators";

declare module "@decaf-ts/decorator-validation" {
  export interface ModelBuilder<M> {
    /**
     * Registers the package's auth class decorator on the model being built, so the built
     * class is stamped with the auth resource metadata consumed by the Express auth layer.
     *
     * @function Auth
     * @template M - The model type being built.
     * @param {string | Constructor} model - The auth resource name, or the model constructor whose name is used as the resource.
     * @return {ModelBuilder<M>} The same builder, for chaining.
     */
    Auth(model: string | Constructor): ModelBuilder<M>;
    /**
     * Accumulates a class decorator to be applied to the model class when `build` runs.
     *
     * @function decorateClass
     * @template M - The model type being built.
     * @param {ClassDecorator} decorator - The class decorator to replay over the built constructor.
     * @return {ModelBuilder<M>} The same builder, for chaining.
     */
    decorateClass(decorator: ClassDecorator): ModelBuilder<M>;
  }
}

const prototype = ModelBuilder.prototype as ModelBuilder<any> & {
  Auth: (model: string | Constructor) => ModelBuilder<any>;
};

if (!prototype.decorateClass) {
  /**
   * Fallback implementation of the `decorateClass` augmentation: stores the decorator in the
   * builder's `_classDecorators` bucket and returns the builder for chaining.
   *
   * @function decorateClass
   * @param {ClassDecorator} decorator - The class decorator to accumulate.
   * @return {ModelBuilder<any>} The same builder, for chaining.
   * @category Overrides
   */
  prototype.decorateClass = function (decorator: ClassDecorator) {
    if (!(this as any)._classDecorators) {
      (this as any)._classDecorators = [];
    }
    (this as any)._classDecorators.push(decorator);
    return this;
  };
}

/**
 * Convenience patch registering the package's {@link Auth} class decorator through
 * {@link ModelBuilder.decorateClass}, so built models carry the auth resource metadata.
 *
 * @function Auth
 * @param {string | Constructor} model - The auth resource name, or the model constructor whose name is used as the resource.
 * @return {ModelBuilder<any>} The same builder, for chaining.
 * @category Overrides
 */
prototype.Auth = function (model: string | Constructor) {
  return this.decorateClass(Auth(model));
};

if (!(prototype as any).__hasClassDecoratorSupport) {
  const originalBuild = prototype.build;
  /**
   * Wraps the original `ModelBuilder.build` so the class decorators accumulated by
   * `decorateClass` are replayed over the constructor the original `build` produced, with
   * each decorator's (optional) return value becoming the new result. The enclosing
   * `__hasClassDecoratorSupport` flag ensures the wrapper is installed only once.
   *
   * @function build
   * @return {Constructor<any>} The built model class, with all accumulated class decorators applied.
   * @category Overrides
   */
  prototype.build = function () {
    let result = originalBuild.call(this);
    const decorators = (this as any)._classDecorators;
    if (decorators?.length) {
      for (const decorator of decorators) {
        const decorated = decorator(result as any) as typeof result | void;
        if (decorated) {
          result = decorated;
        }
      }
    }
    return result;
  };
  (prototype as any).__hasClassDecoratorSupport = true;
}
