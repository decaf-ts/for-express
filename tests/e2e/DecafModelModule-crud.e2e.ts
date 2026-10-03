import request from "supertest";
import { Model } from "@decaf-ts/decorator-validation";
import { buildApp } from "./fakes/app";
import { genStr } from "./fakes/utils";
import { Product } from "./fakes/models/Product";

jest.setTimeout(60000);

describe("DecafModelModule CRUD over Express", () => {
  let app: any;
  let decaf: any;

  beforeAll(async () => {
    expect(Model.tableName(Product)).toBe("product");
    const built = await buildApp({
      controllerExposure: { Fake: false },
    });
    app = built.app;
    decaf = built.decaf;
  });

  afterAll(async () => {
    await decaf?.shutdown?.();
  });

  const productCode = genStr(14);
  const batchNumber = `BATCH${genStr(3)}`;
  const payload = {
    productCode,
    batchNumber,
    name: "Other Product ABC",
    country: "PT",
    expiryDate: 123456,
  };

  it("creates a model instance", async () => {
    const res = await request(app).post("/product").send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toBeDefined();
  });

  it("reads a model instance", async () => {
    const res = await request(app).get(
      `/product/${productCode}/${batchNumber}`
    );
    expect(res.status).toBe(200);
    expect(res.body.productCode).toBe(productCode);
  });

  it("updates a model instance", async () => {
    const res = await request(app)
      .put(`/product/${productCode}/${batchNumber}`)
      .send({ ...payload, name: "updated name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("updated name");
  });

  it("deletes a model instance", async () => {
    const res = await request(app).delete(
      `/product/${productCode}/${batchNumber}`
    );
    expect([200, 204]).toContain(res.status);
    const read = await request(app).get(
      `/product/${productCode}/${batchNumber}`
    );
    expect(read.status).toBe(404);
  });
});
