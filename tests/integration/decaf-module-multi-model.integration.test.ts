import request from "supertest";
import { Model } from "@decaf-ts/decorator-validation";
import { buildApp } from "../e2e/fakes/app";
import { genStr } from "../e2e/fakes/utils";
import { Product } from "../e2e/fakes/models/Product";
import { ProcessStep } from "../e2e/fakes/models/ProcessStep";

jest.setTimeout(60000);

// SAA-130 N-1 regression: `FromModelController.create` computed a per-model
// kebab-cased `routePath`, but `DecafModelModule.forRoot` ignored it and
// registered every exposed model's routes on the same flat paths (`POST /`,
// `GET /:pk`, ...). With more than one exposed model only the first registered
// model was reachable; the rest were shadowed. `forRoot` now mounts each model's
// routes on a per-model Router at `/${toKebabCase(Model.tableName(model))}`.
//
// These assertions deliberately fail if `forRoot` reverts to flat registration:
// flat registration routes `POST /` (not `POST /product`/`POST /process-step`) and
// only one model's handlers win.
describe("DecafModule.forRoot multi-model route mounting (SAA-130 N-1)", () => {
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

  it("derives each exposed model's kebab-cased table-name base path", () => {
    expect(Model.tableName(Product)).toBe("product");
    expect(Model.tableName(ProcessStep)).toBe("process_step");
  });

  it("makes both exposed models reachable at their own prefixed paths", async () => {
    const product = await request(app).post("/product").send({
      productCode: genStr(14),
      batchNumber: `BATCH${genStr(3)}`,
      name: "multi-model product",
      country: "PT",
      expiryDate: 123456,
    });
    expect(product.status).toBe(201);

    const stepId = `step-${genStr(10)}`;
    const step = await request(app).post("/process-step").send({
      id: stepId,
      currentStep: 1,
      totalSteps: 2,
      label: "multi-model step",
    });
    expect(step.status).toBe(201);

    const readProduct = await request(app).get(
      `/product/${product.body.productCode}/${product.body.batchNumber}`
    );
    expect(readProduct.status).toBe(200);

    const readStep = await request(app).get(`/process-step/${stepId}`);
    expect(readStep.status).toBe(200);
    expect(readStep.body.id).toBe(stepId);
  });

  it("does not register a flat root route for any exposed model", async () => {
    const flatPost = await request(app).post("/").send({
      productCode: genStr(14),
      batchNumber: `BATCH${genStr(3)}`,
      name: "flat route must be absent",
    });
    expect(flatPost.status).toBe(404);

    const flatGet = await request(app).get(`/${genStr(14)}`);
    expect(flatGet.status).toBe(404);
  });
});
