import type { Application } from "express";

import {
  OPENAPI_DEFAULT_PATH,
  OPENAPI_JSON_PATH,
  OPENAPI_YAML_PATH,
  SwaggerBuilder,
  type SwaggerSetupOptions,
} from "../../src/factory/openapi";

const app = {} as Application;

const baseOptions: SwaggerSetupOptions = {
  title: "Test API",
  description: "Test API description",
  version: "1.2.3",
};

describe("SwaggerBuilder document assembly", () => {
  it("initializes a minimal OpenAPI 3.0 document from the setup options", () => {
    const document = new SwaggerBuilder(app, baseOptions).build();

    expect(document.openapi).toBe("3.0.0");
    expect(document.info).toEqual({
      title: "Test API",
      description: "Test API description",
      version: "1.2.3",
    });
    expect(document.paths).toEqual({});
    expect(document.components).toEqual({
      schemas: {},
      securitySchemes: {},
    });
  });

  it("adds a path item and returns the builder for chaining", () => {
    const builder = new SwaggerBuilder(app, baseOptions);

    const returned = builder.addPath("/products", {
      get: { summary: "List products" },
    });

    expect(returned).toBe(builder);
    expect(builder.build().paths["/products"]).toEqual({
      get: { summary: "List products" },
    });
  });

  it("merges multiple operations added to the same path", () => {
    const document = new SwaggerBuilder(app, baseOptions)
      .addPath("/products", { get: { summary: "List products" } })
      .addPath("/products", { post: { summary: "Create product" } })
      .build();

    expect(document.paths["/products"]).toEqual({
      get: { summary: "List products" },
      post: { summary: "Create product" },
    });
  });

  it("adds component schemas and returns the builder for chaining", () => {
    const schema = {
      type: "object",
      properties: { id: { type: "string" } },
    };
    const builder = new SwaggerBuilder(app, baseOptions);

    const returned = builder.addSchema("Product", schema);

    expect(returned).toBe(builder);
    expect(builder.build().components.schemas.Product).toBe(schema);
  });

  it("adds security schemes and returns the builder for chaining", () => {
    const scheme = { type: "http", scheme: "bearer" as const };
    const builder = new SwaggerBuilder(app, baseOptions);

    const returned = builder.addSecurityScheme("bearer", scheme);

    expect(returned).toBe(builder);
    expect(builder.build().components.securitySchemes.bearer).toBe(scheme);
  });

  it("accumulates paths, schemas and security schemes through a fluent chain", () => {
    const document = new SwaggerBuilder(app, baseOptions)
      .addPath("/products", { get: { summary: "List products" } })
      .addSchema("Product", { type: "object" })
      .addSecurityScheme("apiKey", {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
      })
      .build();

    expect(Object.keys(document.paths)).toEqual(["/products"]);
    expect(Object.keys(document.components.schemas)).toEqual(["Product"]);
    expect(Object.keys(document.components.securitySchemes)).toEqual(["apiKey"]);
  });

  it("exposes the documented default OpenAPI path constants", () => {
    expect(OPENAPI_DEFAULT_PATH).toBe("api");
    expect(OPENAPI_JSON_PATH).toBe("api-json");
    expect(OPENAPI_YAML_PATH).toBe("api-yaml");
  });
});
