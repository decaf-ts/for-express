import request from "supertest";
import { Model } from "@decaf-ts/decorator-validation";
import { buildApp } from "../e2e/fakes/app";
import { genStr } from "../e2e/fakes/utils";
import { Product } from "../e2e/fakes/models/Product";

jest.setTimeout(60000);

describe("DecafErrorFilter over HTTP", () => {
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
    name: "Filter product",
    country: "PT",
    expiryDate: 1,
  };

  it("maps a not-found read to 404 (for-nest parity)", async () => {
    const res = await request(app).get(
      `/product/${productCode}/${batchNumber}`
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });

  it("maps a duplicate create to 409", async () => {
    const first = await request(app).post("/product").send(payload);
    expect(first.status).toBe(201);
    const duplicate = await request(app).post("/product").send(payload);
    expect(duplicate.status).toBe(409);
  });

  it("maps an invalid create to a 422 validation error", async () => {
    const res = await request(app).post("/product").send({
      productCode: "123",
      batchNumber: "BAD/!!",
      name: "Invalid",
    });
    expect(res.status).toBe(422);
  });
});
