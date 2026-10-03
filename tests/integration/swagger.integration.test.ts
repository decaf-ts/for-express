import express from "express";
import request from "supertest";
import { parse } from "yaml";

import { ExpressBootstraper } from "../../src/factory/ExpressBootstraper";
import { SwaggerBuilder } from "../../src/factory/openapi";

jest.setTimeout(60000);

const baseOptions = {
  title: "My API",
  description: "Express decaf service",
  version: "1.0.0",
};

const expectedDocument = {
  openapi: "3.0.0",
  info: {
    title: "My API",
    description: "Express decaf service",
    version: "1.0.0",
  },
  paths: {},
  components: { schemas: {}, securitySchemes: {} },
};

function newApp() {
  return express();
}

describe("OpenAPI/Swagger served endpoints", () => {
  it("serves the JSON document at the default /api/api-json path", async () => {
    const app = newApp();

    ExpressBootstraper.initialize(app).setupSwagger({ ...baseOptions });

    const res = await request(app).get("/api/api-json");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual(expectedDocument);
  });

  it("serves the same document as YAML at /api/api-yaml", async () => {
    const app = newApp();

    ExpressBootstraper.initialize(app).setupSwagger({ ...baseOptions });

    const res = await request(app).get("/api/api-yaml");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/yaml/);
    expect(parse(res.text)).toEqual(expectedDocument);
  });

  it("honours a custom mount path", async () => {
    const app = newApp();

    ExpressBootstraper.initialize(app).setupSwagger({
      ...baseOptions,
      path: "docs",
    });

    expect((await request(app).get("/docs/api-json")).status).toBe(200);
    expect((await request(app).get("/docs/api-yaml")).status).toBe(200);
    expect((await request(app).get("/api/api-json")).status).toBe(404);
  });

  it("honours custom JSON and YAML endpoint paths", async () => {
    const app = newApp();

    ExpressBootstraper.initialize(app).setupSwagger({
      ...baseOptions,
      path: "docs",
      openApiJsonPath: "/spec/openapi.json",
      openApiYamlPath: "/spec/openapi.yaml",
    });

    expect((await request(app).get("/spec/openapi.json")).status).toBe(200);
    expect((await request(app).get("/spec/openapi.yaml")).status).toBe(200);
    expect((await request(app).get("/docs/api-json")).status).toBe(404);
  });

  it("serves a document assembled through the builder API", async () => {
    const app = newApp();
    const pathItem = { get: { summary: "List products" } };
    const schema = {
      type: "object",
      properties: { id: { type: "string" } },
    };
    const scheme = { type: "http" as const, scheme: "bearer" };

    new SwaggerBuilder(app, { ...baseOptions, path: "api" })
      .addPath("/products", pathItem)
      .addSchema("Product", schema)
      .addSecurityScheme("bearer", scheme)
      .setupSwagger();

    const res = await request(app).get("/api/api-json");

    expect(res.status).toBe(200);
    expect(res.body.paths["/products"]).toEqual(pathItem);
    expect(res.body.components.schemas.Product).toEqual(schema);
    expect(res.body.components.securitySchemes.bearer).toEqual(scheme);
  });
});
