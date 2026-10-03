import type { Application, Request, Response } from "express";
import { Logging } from "@decaf-ts/logging";

import {
  OPENAPI_DEFAULT_PATH,
  OPENAPI_JSON_PATH,
  OPENAPI_YAML_PATH,
  SWAGGER_UI_PACKAGE,
} from "./constants";
import type {
  ReferenceObject,
  SchemaObject,
  SecuritySchemeObject,
} from "../../swagger-types";

/**
 * @module for-express/factory/openapi/SwaggerBuilder
 * @summary Minimal explicit OpenAPI document builder and Swagger UI mount for Express.
 * @description Provides {@link SwaggerBuilder} and its {@link SwaggerSetupOptions}
 * contract. Because Express has no decorator-driven metadata pipeline, the
 * OpenAPI document is assembled programmatically (paths, schemas, security
 * schemes) and then exposed as JSON/YAML endpoints plus the Swagger UI, the
 * Express counterpart of Nest's `SwaggerModule` setup.
 */

/**
 * Options accepted by {@link SwaggerBuilder}.
 *
 * @interface SwaggerSetupOptions
 * @description Configuration for building the OpenAPI document and mounting its endpoints.
 * @summary Supplied to {@link ExpressBootstraper.setupSwagger} or directly to the
 * {@link SwaggerBuilder} constructor; `path` defaults to `"api"` and
 * `persistAuthorization` to `true`.
 *
 * @property {string} title - API title shown in the document header and the Swagger UI site title.
 * @property {string} description - API description placed in the OpenAPI `info` block.
 * @property {string} version - API version placed in the OpenAPI `info` block.
 * @property {string} [path] - Base path under which the Swagger UI is mounted (default `"api"`).
 * @property {boolean} [persistAuthorization] - Whether the Swagger UI keeps authorizations across page reloads (default `true`).
 * @property {string} [assetsPath] - Custom assets location for the Swagger UI.
 * @property {string} [topbarBgColor] - Custom Swagger UI topbar background color.
 * @property {string} [topbarIconFilePath] - Custom icon file for the Swagger UI topbar.
 * @property {string} [faviconFilePath] - Custom favicon for the Swagger UI.
 * @property {string} [openApiJsonPath] - Route serving the OpenAPI JSON document (default `/<path>/api-json`).
 * @property {string} [openApiYamlPath] - Route serving the OpenAPI YAML document (default `/<path>/api-yaml`).
 * @category OpenAPI
 */
export interface SwaggerSetupOptions {
  title: string;
  description: string;
  version: string;
  path?: string;
  persistAuthorization?: boolean;
  assetsPath?: string;
  topbarBgColor?: string;
  topbarIconFilePath?: string;
  faviconFilePath?: string;
  openApiJsonPath?: string;
  openApiYamlPath?: string;
}

/**
 * A single OpenAPI path-item entry (operations keyed by HTTP method plus
 * optional per-path parameters).
 *
 * @typedef OpenApiPathItem
 * @category OpenAPI
 */
type OpenApiPathItem = Record<string, unknown>;

/**
 * Minimal Express OpenAPI document builder.
 *
 * @class SwaggerBuilder
 * @description Builds an OpenAPI 3.0 document explicitly and serves it with the Swagger UI when available.
 * @summary Unlike the Nest integration, Express has no decorator-driven metadata, so
 * documents are assembled explicitly via `addPath`/`addSchema`/`addSecurityScheme`
 * and served through `swagger-ui-express` when the optional dependency is present.
 * Call {@link SwaggerBuilder.setupSwagger} after populating the document to mount
 * the JSON/YAML endpoints and the UI.
 *
 * @example
 * ```ts
 * const swagger = new SwaggerBuilder(app, {
 *   title: "My API",
 *   description: "Express decaf service",
 *   version: "1.0.0",
 * });
 *
 * swagger
 *   .addSchema("User", { type: "object", properties: { id: { type: "string" } } })
 *   .addPath("/users", { get: { responses: { "200": { description: "OK" } } } })
 *   .addSecurityScheme("bearer", { type: "http", scheme: "bearer" });
 *
 * swagger.setupSwagger(); // serves /api/api-json, /api/api-yaml and the UI
 * ```
 *
 * @category OpenAPI
 */
export class SwaggerBuilder {
  /**
   * The OpenAPI document under construction, seeded with `openapi: "3.0.0"`,
   * the `info` block and empty `paths`/`components` collections.
   * @protected
   */
  protected document: Record<string, any>;

  /**
   * Creates a builder bound to an Express application.
   * @param {Application} app - Express application on which the endpoints and UI will be mounted by {@link SwaggerBuilder.setupSwagger}.
   * @param {SwaggerSetupOptions} options - Document and mounting configuration (see {@link SwaggerSetupOptions}).
   */
  constructor(
    protected readonly app: Application,
    protected readonly options: SwaggerSetupOptions
  ) {
    this.document = {
      openapi: "3.0.0",
      info: {
        title: options.title,
        description: options.description,
        version: options.version,
      },
      paths: {},
      components: { schemas: {}, securitySchemes: {} },
    };
  }

  /**
   * Adds (or merges into) an OpenAPI path item under the given path.
   * @param {string} path - The OpenAPI path key, e.g. `"/users"`.
   * @param {OpenApiPathItem} item - Path-item operations and parameters merged over any existing entry.
   * @return {SwaggerBuilder} The builder itself, for fluent chaining.
   */
  addPath(path: string, item: OpenApiPathItem): this {
    this.document.paths[path] = {
      ...(this.document.paths[path] || {}),
      ...item,
    };
    return this;
  }

  /**
   * Registers a reusable component schema under `components.schemas`.
   * @param {string} name - Component name used by `$ref` references, e.g. `"#/components/schemas/User"`.
   * @param {SchemaObject | ReferenceObject} schema - The JSON-schema-like object to register.
   * @return {SwaggerBuilder} The builder itself, for fluent chaining.
   */
  addSchema(
    name: string,
    schema: SchemaObject | ReferenceObject
  ): this {
    this.document.components.schemas[name] = schema;
    return this;
  }

  /**
   * Registers a security scheme under `components.securitySchemes`.
   * @param {string} name - Scheme name referenced by operations' `security` requirements.
   * @param {SecuritySchemeObject} scheme - The OpenAPI security-scheme definition (e.g. `http` bearer, `apiKey`).
   * @return {SwaggerBuilder} The builder itself, for fluent chaining.
   */
  addSecurityScheme(
    name: string,
    scheme: SecuritySchemeObject
  ): this {
    this.document.components.securitySchemes[name] = scheme;
    return this;
  }

  /**
   * Returns the assembled OpenAPI document.
   * @return {Record<string, any>} The OpenAPI 3.0 document, including `info`, `paths` and `components`.
   */
  build(): Record<string, any> {
    return this.document;
  }

  /**
   * Mounts the OpenAPI JSON/YAML endpoints and, when available, the Swagger UI.
   *
   * Routes are derived from `options.path` (default {@link OPENAPI_DEFAULT_PATH})
   * and {@link OPENAPI_JSON_PATH}/{@link OPENAPI_YAML_PATH} unless explicit
   * `openApiJsonPath`/`openApiYamlPath` are given. The YAML route answers 501
   * when the optional `yaml` package is missing, and the Swagger UI is skipped
   * with a warning when `swagger-ui-express` is not installed.
   * @return {void} Mounts the routes on the bound application as a side effect.
   */
  setupSwagger(): void {
    const log = Logging.for(SwaggerBuilder.name);
    const path = (this.options.path ?? OPENAPI_DEFAULT_PATH).replace(
      /^\/+|\/+$/g,
      ""
    );
    const jsonPath = (
      this.options.openApiJsonPath ?? `/${path}/${OPENAPI_JSON_PATH}`
    ).replace(/^\/+/, "");
    const yamlPath = (
      this.options.openApiYamlPath ?? `/${path}/${OPENAPI_YAML_PATH}`
    ).replace(/^\/+/, "");

    this.app.get(`/${jsonPath}`, (_req: Request, res: Response) => {
      res.json(this.document);
    });

    this.app.get(`/${yamlPath}`, async (_req: Request, res: Response) => {
      try {
        const yaml = await import("yaml");
        res
          .type("text/yaml")
          .send(yaml.stringify(this.document));
      } catch {
        res.status(501).json({ error: "yaml package not installed" });
      }
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const swaggerUi = require(SWAGGER_UI_PACKAGE);
      this.app.use(
        `/${path}`,
        swaggerUi.serve,
        swaggerUi.setup(this.document, {
          swaggerOptions: {
            persistAuthorization:
              this.options.persistAuthorization ?? true,
          },
          customSiteTitle: this.options.title,
        })
      );
    } catch {
      log.warn(
        "swagger-ui-express not installed. Skipping Swagger UI (JSON/YAML still served)."
      );
    }
  }
}
