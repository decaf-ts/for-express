/**
 * @module for-express/overrides/Adapter
 * @summary Ambient typings for the Adapter transformer helpers and the context response hook.
 * @description Type-level module augmentation of `@decaf-ts/core` declaring the members whose
 * implementations are assigned at import time by `for-express/overrides/overrides`:
 * `Adapter.transformerFor` and `Adapter.flavoursToTransform` on the `Adapter` namespace, and
 * `Context.toResponse` on the {@link Context} interface.
 *
 * This file contains declarations only; the prototype/namespace patches live in
 * `for-express/overrides/overrides`, which is loaded as a side-effect import through
 * `for-express/overrides/index` (and therefore by `for-express/index`). Without these ambient
 * shapes the runtime assignments in the overrides file would not type-check, and in-package
 * consumers such as `core-module` and the auth interceptor could not call the helpers.
 */
import "@decaf-ts/core";
import type { Constructor } from "@decaf-ts/decoration";
import { RequestToContextTransformer } from "@decaf-ts/for-http/server";
import { ContextOf } from "@decaf-ts/core";

declare module "@decaf-ts/core" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace Adapter {
    /**
     * Resolves the request-to-context transformer registered for an adapter flavour.
     *
     * Augmented ambient declaration; the implementation is patched onto `Adapter` at import
     * time by `for-express/overrides/overrides`, which reads the flavour-keyed `transformers`
     * bucket of the Decaf `Metadata` registry (populated by
     * `requestToContextTransformer` in `@decaf-ts/for-http/server`).
     *
     * @function transformerFor
     * @template A - The adapter type whose request context type is derived via {@link ContextOf}.
     * @param {A | string} adapter - The adapter instance, or its flavour alias string.
     * @return {Constructor<RequestToContextTransformer<ContextOf<A>>> | RequestToContextTransformer<ContextOf<A>>} The transformer constructor (or an already instantiated transformer) registered for the flavour.
     * @category Overrides
     */
    function transformerFor<A extends Adapter<any, any, any, any>>(
      adapter: A | string
    ):
      | Constructor<RequestToContextTransformer<ContextOf<A>>>
      | RequestToContextTransformer<ContextOf<A>>;

    /**
     * Lists the adapter flavours that have a request-to-context transformer registered.
     *
     * Augmented ambient declaration; the implementation is patched onto `Adapter` at import
     * time by `for-express/overrides/overrides`, which returns the flavour keys of the
     * `transformers` bucket in the Decaf `Metadata` registry (or `undefined` when the bucket
     * is empty). Consumed by the Express auth interceptor to walk the registered transformers.
     *
     * @function flavoursToTransform
     * @return {string[] | undefined} The registered flavour aliases, or `undefined` if none are registered.
     * @category Overrides
     */
    function flavoursToTransform(): string[] | undefined;
  }
  /**
   * Extends the core request {@link Context} with an Express-aware response hook.
   *
   * The implementation is patched onto `Context.prototype` at import time by
   * `for-express/overrides/overrides`; the Express request context also provides its own
   * override of the same method.
   */
  export interface Context {
    /**
     * Stamps the context's pending tasks onto a response before it is sent.
     *
     * @template RES - The platform response type being decorated.
     * @param {RES} res - The response object to decorate.
     * @return {RES} The same response, carrying an `x-pending-task` header when the context has pending tasks.
     */
    toResponse<RES = any>(res: RES): RES;
  }
}
