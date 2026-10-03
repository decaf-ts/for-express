/**
 * @module for-express/decaf-model/utils
 * @summary Internal helpers for building and running model route handlers.
 * @description Provides the low-level plumbing shared by the Express
 * model-route builders: persistence-method resolution, custom-route handler
 * construction, prototype method definition, error normalization, and a
 * logging helper mirroring the Nest integration's route builder logging.
 * These helpers are consumed by {@link FromModelController} and the generated
 * {@link DecafModelController} subclasses.
 */

import { Logger, Logging } from "@decaf-ts/logging";
import { DirectionLimitOffset, ModelService, Repo } from "@decaf-ts/core";
import { Model } from "@decaf-ts/decorator-validation";
import { BaseError, InternalError } from "@decaf-ts/db-decorators";

import type { DecafModelController } from "../controllers";
import type { DecafParamProps } from "./decorators/types";

/**
 * Normalizes any thrown value into a {@link BaseError}.
 *
 * @function toDecafError
 * @description Errors that are already `BaseError` instances pass through
 * unchanged; anything else is wrapped in an {@link InternalError}, optionally
 * prefixed with a fallback message.
 * @summary Error normalization helper for route handlers.
 * @param {unknown} error - The caught value.
 * @param {string} fallbackMessage - Message used when wrapping non-`Error`
 * values, or prefixing wrapped `Error` messages.
 * @return {BaseError} The normalized error.
 * @category Decaf Model Routes
 */
function toDecafError(error: unknown, fallbackMessage: string): BaseError {
  if (error instanceof BaseError) return error;
  return new InternalError(
    error instanceof Error
      ? `${fallbackMessage}: ${error.message}`
      : fallbackMessage
  );
}

/**
 * Resolves a persistence method (or statement) by name on a repository or
 * model service.
 *
 * @function resolvePersistenceMethod
 * @description On a {@link ModelService}, the named method is invoked directly
 * when it exists and otherwise falls back to `statement(...)`. On a plain
 * {@link Repo}, the method must exist as a function; missing methods throw an
 * {@link InternalError}.
 * @summary Invokes a named persistence method with the supplied arguments.
 * @template T - The model type; must extend {@link Model<boolean>}.
 * @param {Repo<T> | ModelService<T>} persistence - The resolved persistence
 * layer for the model.
 * @param {string} methodName - The persistence method name (e.g. `"countOf"`).
 * @param {...any} args - Arguments forwarded to the method.
 * @return {any} The result of invoking the persistence method.
 * @category Decaf Model Routes
 */
export function resolvePersistenceMethod<T extends Model<boolean>>(
  persistence: Repo<T> | ModelService<T>,
  methodName: string,
  ...args: any[]
): any {
  if (persistence instanceof ModelService) {
    return typeof (persistence as any)[methodName] === "function"
      ? (persistence as any)[methodName](...args)
      : persistence.statement(methodName, ...args);
  }

  if (typeof (persistence as any)[methodName] === "function")
    return (persistence as any)[methodName](...args);

  throw new InternalError(
    `Persistence method "${methodName}" not found on ${persistence?.constructor?.name}`
  );
}

/**
 * Builds a route handler for a custom persistence method, resolving the
 * persistence from the controller's request context.
 *
 * @function createRouteHandler
 * @description Returns an async handler intended to be installed on a
 * generated {@link DecafModelController} prototype (see
 * {@link defineRouteMethod}). It forwards the ordered path parameters plus
 * the direction/limit/offset query details to the persistence method, and
 * wraps failures via `toDecafError` so clients receive proper
 * {@link BaseError}s.
 * @summary Factory producing custom-route handlers for persistence methods.
 * @template T - The result model type of the persistence call.
 * @param {string} methodName - The persistence method the handler invokes.
 * @return {function} An async handler with signature
 * `(pathParams: DecafParamProps, queryParams: DirectionLimitOffset) => Promise<T>`,
 * meant to be called with `this` bound to a {@link DecafModelController}.
 * @category Decaf Model Routes
 */
export function createRouteHandler<T>(methodName: string) {
  return async function (
    this: DecafModelController<any>,
    pathParams: DecafParamProps,
    queryParams: DirectionLimitOffset
  ): Promise<T> {
    const log: Logger = this.log.for(methodName);

    try {
      log.debug(
        `Invoking persistence method "${methodName}" given parameters: ${JSON.stringify(pathParams.valuesInOrder)}`
      );
      const { direction, limit, offset } = queryParams;
      return await resolvePersistenceMethod(
        this.persistence(this.ctx),
        methodName,
        ...pathParams.valuesInOrder,
        direction,
        limit,
        offset
      );
    } catch (e: any) {
      log.error(`Custom query "${methodName}" failed`, e);
      throw toDecafError(e, `Custom query "${methodName}" failed`);
    }
  };
}

/**
 * Defines a route method on a controller prototype.
 *
 * @function defineRouteMethod
 * @description Installs the handler as a non-enumerable, non-writable,
 * configurable property on the class prototype (falling back to the class
 * itself when no prototype exists), then returns the resulting property
 * descriptor so callers can register it with the route machinery.
 * @summary Installs a handler as a prototype method and returns its descriptor.
 * @param {function(...any): any} ControllerClass - The controller class
 * (or its constructor) to augment.
 * @param {string} methodName - The method name to define.
 * @param {function} handler - The handler implementation to install.
 * @return {PropertyDescriptor | undefined} The descriptor of the defined
 * property, or `undefined` when it could not be read back.
 * @category Decaf Model Routes
 */
export function defineRouteMethod(
  ControllerClass: new (...args: any[]) => any,
  methodName: string,
  handler: (...args: any[]) => any
): PropertyDescriptor | undefined {
  Object.defineProperty(
    ControllerClass.prototype || ControllerClass,
    methodName,
    {
      value: handler,
      writable: false,
      configurable: true,
      enumerable: false,
    }
  );

  return Object.getOwnPropertyDescriptor(
    ControllerClass.prototype || ControllerClass,
    methodName
  );
}

/**
 * Logging helper mirroring the Nest integration's route builder logging.
 *
 * @function routeLogger
 * @description Thin wrapper over {@link Logging.for} so route builders create
 * loggers the same way across the Express and Nest integrations.
 * @summary Creates a logger scoped to the given name.
 * @param {string} name - The logger scope name (e.g. a controller or builder
 * name).
 * @return {Logger} A {@link Logger} scoped to `name`.
 * @category Decaf Model Routes
 */
export function routeLogger(name: string): Logger {
  return Logging.for(name);
}
