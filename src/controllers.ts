/**
 * @module for-express/controllers
 * @summary Abstract controller base classes for the Express integration.
 * @description Provides the {@link DecafController} and {@link DecafModelController}
 * base classes that concrete Express controllers extend. They wrap the
 * framework-agnostic `@decaf-ts/for-http/server` controller primitives,
 * specializing them to an Express `Request` and the request-scoped
 * {@link DecafRequestContext}. `DecafModelController` additionally resolves the
 * persistence layer (repository or model service) for its model class,
 * applying request-scoped overrides from the active context.
 */

import { type Request } from "express";
import { DecafController as HttpDecafController } from "@decaf-ts/for-http/server";
import {
  Context,
  ModelService,
  Repo,
  Repository,
  Service,
} from "@decaf-ts/core";
import { Model, type ModelConstructor } from "@decaf-ts/decorator-validation";

import { DecafServerCtx } from "./constants";
import { DecafRequestContext } from "./request/DecafRequestContext";

/**
 * @class DecafController
 * @abstract
 * @description Base class for Express decaf controllers.
 * @summary Express counterpart of the for-http server `DecafController`, binding
 * controllers to an Express `Request` and the request-scoped
 * {@link DecafRequestContext} instead of a generic HTTP server context. Concrete
 * controllers (auto-generated or hand-written) extend this class and are
 * instantiated per request with the current request context.
 * @template {DecafServerCtx} [CONTEXT=DecafServerCtx] - Server context specialization carried by the controller (present for signature parity; not used internally).
 * @extends {HttpDecafController<Request, any, DecafRequestContext>}
 * @category Controllers
 */
export abstract class DecafController<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CONTEXT extends DecafServerCtx = DecafServerCtx,
> extends HttpDecafController<Request, any, DecafRequestContext> {
  /**
   * @constructor
   * @param {DecafRequestContext} clientContext - Request-scoped context of the current Express request, forwarded to the base for-http controller.
   * @param {string} name - Controller name. Kept for signature parity with {@link DecafModelController}; not used by this base class.
   */
  protected constructor(
    protected readonly clientContext: DecafRequestContext,
    name: string
  ) {
    super(clientContext);
    void name;
  }
}

/**
 * @class DecafModelController
 * @abstract
 * @description Base class for Express controllers backed by a decaf model.
 * @summary Express equivalent of the Nest `DecafModelController`: extends
 * {@link DecafController} with model awareness, exposing the model class of the
 * controller and lazily resolving its persistence layer — first from the
 * service registry, then via `ModelService.getService`, and finally falling
 * back to a {@link Repository} for the model. When an explicit context is
 * supplied, the resolved persistence is re-scoped to that context's overrides.
 * @template {Model<boolean>} M - Model class served by the controller.
 * @template {DecafServerCtx} [C=DecafServerCtx] - Server context specialization carried by the controller.
 * @extends {DecafController<C>}
 * @category Controllers
 */
export abstract class DecafModelController<
  M extends Model<boolean>,
  C extends DecafServerCtx = DecafServerCtx,
> extends DecafController<C> {
  /**
   * Lazily resolved persistence layer for the controller's model; either a
   * repository or a model service, depending on what is registered.
   * @private
   */
  private _persistence?: Repo<M> | ModelService<M>;

  /**
   * @constructor
   * @param {DecafRequestContext} clientContext - Request-scoped context of the current Express request; used as the default context by {@link DecafModelController.persistence | persistence}.
   * @param {string} name - Controller name, forwarded to {@link DecafController}.
   */
  protected constructor(
    protected override readonly clientContext: DecafRequestContext,
    name: string
  ) {
    super(clientContext, name);
  }

  /**
   * Model constructor served by this controller. Concrete controllers must
   * implement this; it drives persistence resolution in
   * {@link DecafModelController.persistence | persistence}.
   * @abstract
   * @return {ModelConstructor<M>} The constructor of the model class handled by this controller.
   */
  abstract get class(): ModelConstructor<M>;

  /**
   * @function persistence
   * @description Resolves the persistence layer for this controller's model,
   * caching it on first call. When an explicit `ctx` is provided, the resolved
   * repository or service is re-scoped to the overrides extracted from that
   * context (`override` for repositories, `for` for services); otherwise the
   * cached instance is returned as-is, without applying any overrides.
   * @summary Returns the {@link Repo} or {@link ModelService} backing this controller's model, optionally re-scoped to a context's overrides. Mutates the internal cache.
   * @param {Context<any>} [ctx] - Optional context whose overrides scope the returned persistence; defaults to the controller's client context when omitted.
   * @return {Repo<M> | ModelService<M>} The repository or model service for the controller's model class.
   * @category Controllers
   */
  persistence(ctx?: Context<any>): Repo<M> | ModelService<M> {
    if (!this._persistence)
      try {
        this._persistence = Service.get<ModelService<M>>(this.class);
      } catch {
        try {
          this._persistence = ModelService.getService(
            this.class
          ) as ModelService<M>;
        } catch {
          this._persistence = Repository.forModel(this.class) as Repo<M>;
        }
      }

    const activeCtx = ctx ?? this.clientContext;
    const overrides = activeCtx.toOverrides();

    return ctx
      ? this._persistence instanceof Repository
        ? this._persistence.override(overrides)
        : this._persistence.for(overrides)
      : this._persistence;
  }
}
