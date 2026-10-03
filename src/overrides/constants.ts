/**
 * @module for-express/overrides/constants
 * @summary Swagger-style metadata key constants mirrored from `@nestjs/swagger`.
 * @description Declares the metadata-key naming convention ("swagger/...") used by the
 * NestJS swagger decorators, mirrored here so Express-side decorators and OpenAPI tooling
 * can stamp and read the same keys in the Decaf `Metadata` registry. `DECORATORS` enumerates
 * one key per decorator kind (operation, response, parameters, security, schema, ...); the
 * keys are namespaced under {@link DECORATORS_PREFIX}.
 */
/**
 * Namespace prefix for the swagger-style metadata keys collected in {@link DECORATORS}.
 *
 * @const DECORATORS_PREFIX
 * @description The literal `"swagger"` string every key in {@link DECORATORS} is prefixed with.
 * @category Overrides
 */
export const DECORATORS_PREFIX = "swagger";
/**
 * Registry of swagger-style metadata keys, one per decorator kind.
 *
 * @const DECORATORS
 * @description Maps a decorator kind (operation, response, produces, consumes, tags,
 * callbacks, parameters, headers, model properties, security, endpoint/controller exclusion,
 * extra models, extensions, schema, default getter and links) to its fully qualified
 * metadata key — `"swagger/<kind>"`, built from {@link DECORATORS_PREFIX}. Mirrors the
 * `DECORATORS` map of `@nestjs/swagger` so Express-mirrored decorators stay key-compatible.
 * @category Overrides
 */
export const DECORATORS = {
  API_OPERATION: `${DECORATORS_PREFIX}/apiOperation`,
  API_RESPONSE: `${DECORATORS_PREFIX}/apiResponse`,
  API_PRODUCES: `${DECORATORS_PREFIX}/apiProduces`,
  API_CONSUMES: `${DECORATORS_PREFIX}/apiConsumes`,
  API_TAGS: `${DECORATORS_PREFIX}/apiUseTags`,
  API_CALLBACKS: `${DECORATORS_PREFIX}/apiCallbacks`,
  API_PARAMETERS: `${DECORATORS_PREFIX}/apiParameters`,
  API_HEADERS: `${DECORATORS_PREFIX}/apiHeaders`,
  API_MODEL_PROPERTIES: `${DECORATORS_PREFIX}/apiModelProperties`,
  API_MODEL_PROPERTIES_ARRAY: `${DECORATORS_PREFIX}/apiModelPropertiesArray`,
  API_SECURITY: `${DECORATORS_PREFIX}/apiSecurity`,
  API_EXCLUDE_ENDPOINT: `${DECORATORS_PREFIX}/apiExcludeEndpoint`,
  API_EXCLUDE_CONTROLLER: `${DECORATORS_PREFIX}/apiExcludeController`,
  API_EXTRA_MODELS: `${DECORATORS_PREFIX}/apiExtraModels`,
  API_EXTENSION: `${DECORATORS_PREFIX}/apiExtension`,
  API_SCHEMA: `${DECORATORS_PREFIX}/apiSchema`,
  API_DEFAULT_GETTER: `${DECORATORS_PREFIX}/apiDefaultGetter`,
  API_LINK: `${DECORATORS_PREFIX}/apiLink`,
};
