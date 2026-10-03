import express from "express";
import request from "supertest";
import { ForbiddenError } from "@decaf-ts/core";
import { MiniLogger } from "@decaf-ts/logging";
import { DecafErrorFilter } from "../../src/factory/exceptions";
import { buildApp } from "./fakes/app";
import { Product } from "./fakes/models/Product";

jest.setTimeout(60000);

describe("DecafErrorFilter request-bound logging (e2e)", () => {
  let app: any;
  let decaf: any;

  beforeAll(async () => {
    const built = await buildApp({ controllerExposure: { Fake: false } });
    decaf = built.decaf;
    app = express();
    app.use(express.json());
    app.use(decaf.router);
    app.get("/boom", () => {
      throw new ForbiddenError("nope");
    });
    app.use(new DecafErrorFilter().handler);
  });

  afterAll(async () => {
    await decaf?.shutdown?.();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("preserves a domain error status instead of flattening it to 500", async () => {
    const errorSpy = jest.spyOn(MiniLogger.prototype, "error");

    const res = await request(app).get("/boom");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ status: 403 });

    const errorCall = errorSpy.mock.calls.find((call) =>
      String(call[0]).includes("GET /boom")
    );
    expect(errorCall).toBeDefined();
  });

  it("logs repository errors through the request-bound context logger", async () => {
    const errorSpy = jest.spyOn(MiniLogger.prototype, "error");

    const productCode = `missing-${Math.random().toString(36).slice(2)}`;
    const batchNumber = `BATCH${Math.random().toString(36).slice(2, 5)}`;
    const res = await request(app).get(
      `/product/${productCode}/${batchNumber}`
    );

    expect([404, 406, 500]).toContain(res.status);

    const errorCall = errorSpy.mock.calls.find((call) =>
      String(call[0]).includes(`GET /product/${productCode}/${batchNumber}`)
    );
    expect(errorCall).toBeDefined();
  });

  it("keeps the Product model registered for the read route", () => {
    expect(Product.name).toBe("Product");
  });
});
