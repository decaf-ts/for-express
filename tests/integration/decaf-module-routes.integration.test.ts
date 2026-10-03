import request from "supertest";
import { Model } from "@decaf-ts/decorator-validation";
import { buildApp } from "../e2e/fakes/app";
import { genStr } from "../e2e/fakes/utils";
import { Product } from "../e2e/fakes/models/Product";
import { DecafRequestContext } from "../../src";

describe("DecafModule.forRoot route generation", () => {
  let app: any;
  let decaf: any;

  beforeAll(async () => {
    const built = await buildApp({ controllerExposure: { Fake: false } });
    app = built.app;
    decaf = built.decaf;
  });

  afterAll(async () => {
    await decaf?.shutdown?.();
  });

  it("boots the adapter and exposes the app bundle", () => {
    expect(decaf.adapters).toHaveLength(1);
    expect(decaf.flavours).toContain("ram");
    expect(decaf.router).toBeDefined();
    expect(typeof decaf.shutdown).toBe("function");
  });

  it("resolves a request context from a request", () => {
    const req: any = { headers: {}, method: "GET", url: "/" };
    const context = decaf.contextFor(req, undefined);
    expect(context).toBeInstanceOf(DecafRequestContext);
    expect(decaf.contextFor(req, undefined)).toBe(context);
  });

  it("generates CRUD, bulk, statement and query routes for the model", async () => {
    const { getModuleFor } = await import("../../src");
    const built = getModuleFor("ram").forRoot("ram", {
      contextFor: decaf.contextFor,
    });

    expect(built.models.map((m: any) => m.name)).toContain("Product");
    expect(Model.tableName(Product)).toBe("product");

    const signatures = built.routes.map(
      (r: any) => `${r.method} /${r.path}`
    );
    expect(signatures).toEqual(
      expect.arrayContaining([
        "POST /",
        "GET /:productCode/:batchNumber",
        "PUT /:productCode/:batchNumber",
        "DELETE /:productCode/:batchNumber",
        "POST /bulk",
        "GET /bulk",
        "PUT /bulk",
        "DELETE /bulk",
        "GET /statement/:method/*args",
        "GET /listBy/:key",
        "GET /paginateBy/:key/:page",
        "GET /find/:value",
        "GET /page/:value",
        "GET /findOneBy/:key/:value",
        "GET /findBy/:key/:value",
        "GET /countOf/:field",
      ])
    );
  });

  it("does not mount model routes when autoControllers is false", async () => {
    const payload = {
      productCode: genStr(14),
      batchNumber: `BATCH${genStr(3)}`,
      name: "AutoControllers flag product",
      country: "PT",
      expiryDate: 123456,
    };

    // Same request succeeds when the auto-generated model routes are mounted...
    const enabled = await request(app).post("/product").send(payload);
    expect(enabled.status).toBe(201);

    // ...and is unrouted (404) when `autoControllers` is disabled.
    const { app: disabledApp } = await buildApp({
      autoControllers: false,
      controllerExposure: { Fake: false },
    });
    const disabled = await request(disabledApp).post("/product").send(payload);
    expect(disabled.status).toBe(404);
  });
});
