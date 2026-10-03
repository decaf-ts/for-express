/**
 * @module for-express/utils
 * @summary Small lookup helpers shared across the Express integration.
 * @description Provides utility functions used by the Express flavour —
 * currently {@link repoForModel}, which resolves the {@link Repository}
 * registered for a model by its (string) name, as required when only the model
 * name is available (e.g. from decorator metadata or generated controllers).
 */
import { Model } from "@decaf-ts/decorator-validation";
import { InternalError } from "@decaf-ts/db-decorators";
import { Repository } from "@decaf-ts/core";

/**
 * @function repoForModel
 * @description Resolves the repository registered for a model name.
 *
 * Looks the model constructor up by name via `Model.get` and returns the
 * {@link Repository} registered for it.
 * @summary Returns the repository registered for a model identified by its name.
 * @param {string} model - Name of the model (as registered by the `@model` decorator).
 * @return {Repository<any>} The repository registered for the model.
 * @throws {InternalError} If no model with the given name is registered.
 * @category Utils
 */
export function repoForModel(model: string) {
  const m = Model.get(model);
  if (!m)
    throw new InternalError(`Failed to find repository for ${model}`);
  return Repository.forModel(m);
}
