/**
 * @module for-express/factory/openapi/constants
 * @summary Path and package-name constants for the OpenAPI/Swagger setup.
 * @description Defines the defaults used by {@link SwaggerBuilder.setupSwagger}
 * when mounting the OpenAPI endpoints and Swagger UI: the UI base path, the
 * JSON/YAML document routes and the optional `swagger-ui-express` package name
 * resolved at runtime.
 */

/**
 * Default base path under which the Swagger UI is mounted.
 * @const OPENAPI_DEFAULT_PATH
 * @description Default Swagger UI mount path (`"api"`), overridable via {@link SwaggerSetupOptions.path}.
 * @category OpenAPI
 */
export const OPENAPI_DEFAULT_PATH = "api";

/**
 * Route segment serving the OpenAPI JSON document.
 * @const OPENAPI_JSON_PATH
 * @description JSON document route segment (`"api-json"`), appended to the base path unless {@link SwaggerSetupOptions.openApiJsonPath} is set.
 * @category OpenAPI
 */
export const OPENAPI_JSON_PATH = "api-json";

/**
 * Route segment serving the OpenAPI YAML document.
 * @const OPENAPI_YAML_PATH
 * @description YAML document route segment (`"api-yaml"`), appended to the base path unless {@link SwaggerSetupOptions.openApiYamlPath} is set.
 * @category OpenAPI
 */
export const OPENAPI_YAML_PATH = "api-yaml";

/**
 * Name of the optional package providing the Swagger UI middleware.
 * @const SWAGGER_UI_PACKAGE
 * @description `swagger-ui-express` package name, required at runtime and skipped with a warning when not installed.
 * @category OpenAPI
 */
export const SWAGGER_UI_PACKAGE = "swagger-ui-express";
