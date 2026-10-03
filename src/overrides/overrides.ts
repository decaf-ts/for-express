/**
 * @module for-express/overrides/overrides
 * @summary Runtime prototype patches for Adapter transformer lookup and context responses.
 * @description Applies, at import time, the runtime half of the ambient declarations in
 * `for-express/overrides/Adapter` (both are loaded as side-effect imports through
 * `for-express/overrides/index` and `for-express/index`):
 *
 * - assigns `Adapter.transformerFor` to look up the request-to-context transformer registered
 *   for an adapter flavour in the `transformers` bucket of the Decaf `Metadata` registry
 *   (populated by `requestToContextTransformer` in `@decaf-ts/for-http/server`);
 * - assigns `Adapter.flavoursToTransform` to list the flavours that have such a transformer;
 * - patches `Context.prototype.toResponse` so any request context can stamp its pending
 *   tasks onto an Express-style response via the `x-pending-task` header.
 */
import { Constructor, Metadata } from "@decaf-ts/decoration";
import { RequestToContextTransformer } from "@decaf-ts/for-http/server";
import { Adapter, ContextOf, Context } from "@decaf-ts/core";

/**
 * Implementation of the `Adapter.transformerFor` augmentation: resolves the
 * {@link RequestToContextTransformer} registered for an adapter flavour.
 *
 * Reads the flavour-keyed `transformers` bucket from the Decaf `Metadata` registry — the
 * same bucket written by `requestToContextTransformer` in `@decaf-ts/for-http/server` — and
 * is bound to `Adapter` so it can be called as `Adapter.transformerFor(...)`. Consumed by
 * `core-module` and the auth interceptor to wire flavour-specific request transformers.
 *
 * @function Adapter.transformerFor
 * @template A - The adapter type whose request context type is derived via {@link ContextOf}.
 * @param {A | string} adapter - The adapter instance, or its flavour alias string.
 * @return {Constructor<RequestToContextTransformer<ContextOf<A>>>} The transformer constructor registered for the flavour.
 * @category Overrides
 */
(Adapter as any).transformerFor = function toContextFlags<
  A extends Adapter<any, any, any, any>,
>(adapter: A | string): Constructor<RequestToContextTransformer<ContextOf<A>>> {
  const alias =
    typeof adapter === "string" ? adapter : (adapter.alias as string);
  return Metadata["innerGet"](Symbol.for("transformers"), alias);
}.bind(Adapter);

/**
 * Implementation of the `Adapter.flavoursToTransform` augmentation: lists the adapter
 * flavours that have a request-to-context transformer registered.
 *
 * Reads the `transformers` bucket from the Decaf `Metadata` registry and returns its flavour
 * keys; bound to `Adapter` so it can be called as `Adapter.flavoursToTransform(...)`.
 * Consumed by the auth interceptor to walk all registered transformers.
 *
 * @function Adapter.flavoursToTransform
 * @return {string[] | undefined} The registered flavour aliases, or `undefined` when no transformer has been registered.
 * @category Overrides
 */
(Adapter as any).flavoursToTransform = function requestTransformers():
  | string[]
  | undefined {
  const meta = Metadata["innerGet"](Symbol.for("transformers"));
  if (!meta) return undefined;
  return Object.keys(meta);
}.bind(Adapter);

/**
 * Patches `Context.prototype.toResponse` so a Decaf request context can stamp its pending
 * tasks onto an Express-style response before it is sent.
 *
 * When the context has pending tasks (from `Context.pending()`), they are serialized as JSON
 * into the `x-pending-task` response header (see `PENDING_TASK` in `@decaf-ts/for-http`);
 * the response object itself is returned unchanged. The Express request context overrides
 * this method with a defensive variant of the same behaviour.
 *
 * @function Context.prototype.toResponse
 * @template RES - The response type; must expose a `header` method when the context has pending tasks.
 * @param {RES} res - The response object to decorate.
 * @return {RES} The same response, carrying an `x-pending-task` header when pending tasks exist.
 * @category Overrides
 */
(Context as any).prototype.toResponse = function toResponse<
  RES extends { header: any },
>(this: Context, res: RES): RES {
  const pending = this.pending();
  if (pending) res.header("x-pending-task", JSON.stringify(pending));
  return res;
};
