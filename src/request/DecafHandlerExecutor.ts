/**
 * @module for-express/request/DecafHandlerExecutor
 * @summary Sequential executor for the request-scoped Decaf handlers.
 * @description Provides the class that runs all registered {@link DecafRequestHandler} instances
 * against a single shared {@link DecafRequestContext} for each HTTP request. It replaces the
 * Nest integration's request-scoped DI resolution: on Express, the handler instances are
 * constructed by the bootstrap factory and passed in explicitly.
 */
import { Logging } from "@decaf-ts/logging";
import type { Request, Response } from "express";

import { DecafRequestContext } from "./DecafRequestContext";
import { type DecafRequestHandler } from "../types";

/**
 * Executes all registered {@link DecafRequestHandler} instances for a request,
 * giving each the shared {@link DecafRequestContext}.
 *
 * In the Nest integration these handlers are resolved through Nest's request-scoped
 * DI container; on Express they are passed explicitly by the bootstrap factory.
 *
 * @class DecafHandlerExecutor
 * @description Runs every registered {@link DecafRequestHandler} against the shared {@link DecafRequestContext}.
 * @summary Instantiated per request with the handler list and the request context; `exec` logs the
 * context uuid and the incoming request, then awaits each handler's `handle` in registration order
 * so handlers can accumulate data into the shared context before the controller runs.
 * @category Request Context
 */
export class DecafHandlerExecutor {
  /**
   * Creates the executor for a single request.
   *
   * @param {DecafRequestHandler[]} handlers - The request handlers to run, in registration order.
   * @param {DecafRequestContext} context - The request-scoped context shared by all handlers.
   */
  constructor(
    protected readonly handlers: DecafRequestHandler[],
    protected readonly context: DecafRequestContext
  ) {}

  /**
   * Runs all registered handlers sequentially against the shared context.
   *
   * Logs the context uuid and the incoming request at debug level, then awaits each
   * handler's `handle(context, req, res)` in order.
   *
   * @param {Request} req - The Express request being processed.
   * @param {Response} res - The Express response handed to each handler.
   * @return {Promise<void>} Resolves once every handler has completed.
   */
  async exec(req: Request, res: Response): Promise<void> {
    const log = Logging.for(DecafHandlerExecutor.name).for(this.exec);
    log.debug(
      `CONTEXT ${this.context.uuid} running ${this.handlers.length} handlers for request ${req.method} ${req.url}`
    );
    for (const handler of this.handlers) {
      await handler.handle(this.context, req, res);
    }
  }
}
