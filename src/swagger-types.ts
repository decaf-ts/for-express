/**
 * @module for-express/swagger-types
 * @summary OpenAPI/Swagger schema object typings shared by the Express integration.
 * @description Minimal typings for the OpenAPI objects that appear when
 * describing decaf models and controller routes (security schemes, schemas,
 * references, enum metadata). These types mirror the Nest integration's
 * `swagger-types` so model decorators and generated route metadata can be
 * described uniformly, without pulling in a full Swagger dependency.
 */

/**
 * @interface SecuritySchemeObject
 * @description Partial OpenAPI Security Scheme Object describing how an API is
 * secured (`apiKey`, `http`, `oauth2` or `openIdConnect`), including vendor
 * extensions such as `x-tokenName`.
 * @summary OpenAPI security scheme definition used by the Express auth metadata.
 * @property {("apiKey" | "http" | "oauth2" | "openIdConnect")} type - The security scheme type.
 * @property {string} [description] - Human-readable description of the scheme.
 * @property {string} [name] - Header/query/cookie name for `apiKey` schemes.
 * @property {string} [in] - Location (`query`, `header`, `cookie`) of the `apiKey`.
 * @property {string} [scheme] - HTTP authorization scheme (e.g. `bearer`) for `http` schemes.
 * @property {string} [bearerFormat] - Format hint (e.g. `JWT`) for `bearer` schemes.
 * @property {Record<string, unknown>} [flows] - OAuth2 flow definitions.
 * @property {string} [openIdConnectUrl] - OpenID Connect discovery URL for `openIdConnect` schemes.
 * @property {string} ["x-tokenName"] - Vendor extension: name of the token to extract from the response.
 * @property {unknown} [x-${string}] - Arbitrary `x-` prefixed vendor extension.
 * @category OpenAPI
 */
export interface SecuritySchemeObject {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect";
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, unknown>;
  openIdConnectUrl?: string;
  "x-tokenName"?: string;
  [extension: `x-${string}`]: unknown;
}

/**
 * @interface SchemaObject
 * @description Partial OpenAPI Schema Object describing a model or property:
 * JSON-Schema style metadata (type, format, enum, pattern, numeric and string
 * constraints) plus serialization hints (`readOnly`, `writeOnly`, `nullable`,
 * `deprecated`) and nested `properties`.
 * @summary OpenAPI schema definition used to describe decaf models and their properties.
 * @property {boolean} [nullable] - Whether the value may be `null`.
 * @property {boolean} [deprecated] - Whether the schema is deprecated.
 * @property {boolean} [readOnly] - Whether the property is read-only.
 * @property {boolean} [writeOnly] - Whether the property is write-only.
 * @property {unknown} [default] - Default value of the schema.
 * @property {string} [description] - Human-readable description.
 * @property {string} [type] - OpenAPI primitive type (`string`, `number`, `object`, ...).
 * @property {unknown[]} [enum] - Allowed values.
 * @property {string} [pattern] - Regular expression constraint for string values.
 * @property {string[]} [required] - Names of the required properties.
 * @property {Record<string, SchemaObjectMetadata>} [properties] - Nested property schemas.
 * @property {unknown} [additionalProperties] - Schema (or flag) for undeclared properties.
 * @property {unknown} [items] - Schema of array items.
 * @property {string} [format] - OpenAPI format modifier (e.g. `date-time`).
 * @property {number} [maximum] - Inclusive upper bound for numeric values.
 * @property {number} [minimum] - Inclusive lower bound for numeric values.
 * @property {number} [maxLength] - Maximum string length.
 * @property {number} [minLength] - Minimum string length.
 * @category OpenAPI
 */
export interface SchemaObject {
  nullable?: boolean;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  default?: unknown;
  description?: string;
  type?: string;
  enum?: unknown[];
  pattern?: string;
  required?: string[];
  properties?: Record<string, SchemaObjectMetadata>;
  additionalProperties?: unknown;
  items?: unknown;
  format?: string;
  maximum?: number;
  minimum?: number;
  maxLength?: number;
  minLength?: number;
}

/**
 * @interface ReferenceObject
 * @description OpenAPI Reference Object pointing at another schema component.
 * @summary Minimal `$ref` wrapper used when a schema references another component.
 * @property {string} $ref - JSON pointer to the referenced schema (e.g. `#/components/schemas/User`).
 * @category OpenAPI
 */
export interface ReferenceObject {
  $ref: string;
}

/**
 * @typedef EnumAllowedTypes
 * @description Accepted shapes for enum definitions: an explicit array of
 * values, a record keyed by enum member name, or a factory returning either
 * shape (resolved lazily when the schema is built).
 * @summary Allowed value shapes for `enum` metadata in schema objects.
 * @category OpenAPI
 */
type EnumValueFactory = () => any[] | Record<string, any>;

export type EnumAllowedTypes =
  | any[]
  | Record<string, any>
  | EnumValueFactory;

/**
 * @typedef EnumSchemaAttributes
 * @description Subset of {@link SchemaObject} attributes that can be attached
 * to a dedicated named enum schema (`default`, `description`, `deprecated`,
 * `readOnly`, `writeOnly`, `nullable`).
 * @summary Schema attributes allowed alongside a named enum definition.
 * @category OpenAPI
 */
export type EnumSchemaAttributes = Pick<
  SchemaObject,
  | "default"
  | "description"
  | "deprecated"
  | "readOnly"
  | "writeOnly"
  | "nullable"
>;

type SchemaObjectCommonMetadata = Omit<
  SchemaObject,
  "type" | "required" | "properties" | "enum" | "pattern"
> & {
  isArray?: boolean;
  name?: string;
  pattern?: string | RegExp;
  enum?: EnumAllowedTypes;
  [key: string]: any;
};

/**
 * @typedef SchemaObjectMetadata
 * @description Discriminated union describing the metadata attached to a
 * property by model decorators. Loosens the base {@link SchemaObject} by
 * allowing constructor/class references as `type`, RegExp `pattern` and
 * additional keys, then narrows into four variants: a primitive/typed property,
 * a named enum reference, an object with declared `properties`, and an object
 * with `additionalProperties`.
 * @summary Property-level schema metadata accepted by the decaf model decorators in the Express flavour.
 * @category OpenAPI
 */
export type SchemaObjectMetadata =
  | SchemaObjectCommonMetadata & {
      type?:
        | Constructor
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        | Function
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        | [Function]
        | "array"
        | "string"
        | "number"
        | "boolean"
        | "integer"
        | "file"
        | "null";
      required?: boolean;
    }
  | SchemaObjectCommonMetadata & {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      type?: Constructor | Function | [Function] | Record<string, any>;
      required?: boolean;
      enumName: string;
      enumSchema?: EnumSchemaAttributes;
    }
  | SchemaObjectCommonMetadata & {
      type: "object";
      properties: Record<string, SchemaObjectMetadata>;
      required?: string[];
      selfRequired?: boolean;
    }
  | SchemaObjectCommonMetadata & {
      type: "object";
      properties?: Record<string, SchemaObjectMetadata>;
      additionalProperties: SchemaObject | ReferenceObject | boolean;
      required?: string[];
      selfRequired?: boolean;
    };

/**
 * @typedef SwaggerEnumType
 * @description Value shapes accepted as enum payloads in swagger metadata:
 * arrays of strings/numbers/booleans, or a numeric-keyed record mapping enum
 * ordinals to labels.
 * @summary Enum payload shapes used by swagger-aware decorators.
 * @category OpenAPI
 */
export type SwaggerEnumType =
  | string[]
  | number[]
  | boolean[]
  | (string | number | boolean)[]
  | Record<number, string>;

/**
 * @typedef Constructor
 * @description Constructor signature used by the swagger typings when a schema
 * `type` refers to a class (e.g. `String`, `Number` or a decaf `Model`
 * constructor). Internal to this module.
 * @summary Minimal constructor type for swagger schema `type` references.
 * @category OpenAPI
 */
type Constructor = new (...args: any[]) => any;
