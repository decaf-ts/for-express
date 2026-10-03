import request from "supertest";
import { Model } from "@decaf-ts/decorator-validation";
import { buildApp } from "../e2e/fakes/app";
import { genStr } from "../e2e/fakes/utils";
import { Product } from "../e2e/fakes/models/Product";

jest.setTimeout(60000);

describe("DecafModule.forRoot CRUD", () => {
  let app: any;
  let decaf: any;

  beforeAll(async () => {
    expect(Model.tableName(Product)).toBe("product");
    const built = await buildApp({ controllerExposure: { Fake: false } });
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
    expect(res.body).toMatchObject(payload);
  });

  it("reads a model instance by composed key", async () => {
    const res = await request(app).get(
      `/product/${productCode}/${batchNumber}`
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(payload);
  });

  it("updates a model instance", async () => {
    const res = await request(app)
      .put(`/product/${productCode}/${batchNumber}`)
      .send({ ...payload, name: "updated name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("updated name");
  });

  it("deletes a model instance and makes it unreadable", async () => {
    const del = await request(app).delete(
      `/product/${productCode}/${batchNumber}`
    );
    expect([200, 204]).toContain(del.status);

    const read = await request(app).get(
      `/product/${productCode}/${batchNumber}`
    );
    // for-nest parity: a missing record maps to 404 (NotFoundError)
    expect(read.status).toBe(404);
  });

  it("rejects an invalid create payload with a validation error", async () => {
    const res = await request(app).post("/product").send({
      productCode: "123",
      batchNumber: "BAD/!!",
      name: "Invalid product",
    });
    // ValidationError maps to 422 (Decaf error contract)
    expect(res.status).toBe(422);
  });
});
