import { AuthHandler } from "@decaf-ts/for-http/server";
import { DecafRoleAuthHandler } from "../../src/auth/DecafAuthHandler";
import { AuthInterceptor } from "../../src/auth/AuthInterceptor";
import { DecafHandlerExecutor } from "../../src/request/DecafHandlerExecutor";
import { buildApp } from "./fakes/app";
import { genStr } from "./fakes/utils";
import { Product as ProductAdmin } from "./fakes/models/ProductAdmin";
import { FakeHandler } from "./fakes/fake.handler";

jest.setTimeout(60000);

describe("request pipeline execution order", () => {
  let app: any;
  let decaf: any;

  beforeAll(async () => {
    const built = await buildApp({
      authHandler: new DecafRoleAuthHandler(),
      handlers: [FakeHandler],
    });
    app = built.app;
    decaf = built.decaf;
  });

  afterAll(async () => {
    await decaf?.shutdown?.();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("runs the request handler executor before AuthInterceptor and AuthHandler", async () => {
    const order: string[] = [];

    const originalExec = DecafHandlerExecutor.prototype.exec;
    const originalIntercept = AuthInterceptor.prototype.intercept;
    const originalAuthorize = AuthHandler.prototype.authorize;

    jest
      .spyOn(DecafHandlerExecutor.prototype, "exec")
      .mockImplementation(function (this: any, ...args: any[]) {
        order.push("handler-executor");
        return originalExec.apply(this, args as any);
      });

    jest
      .spyOn(AuthInterceptor.prototype, "intercept")
      .mockImplementation(function (this: any, ...args: any[]) {
        order.push("auth-interceptor");
        return originalIntercept.apply(this, args as any);
      });

    jest
      .spyOn(AuthHandler.prototype, "authorize")
      .mockImplementation(function (this: any, ...args: any[]) {
        order.push("auth-handler");
        return originalAuthorize.apply(this, args as any);
      });

    const productCode = genStr(14);
    const batchNumber = `BATCH${genStr(3)}`;
    const res = await (await import("supertest")).default(app)
      .post("/product")
      .set("Authorization", "Bearer admin")
      .send({ productCode, batchNumber, name: "order-test" });

    expect(res.status).toBe(201);

    const executorIndex = order.indexOf("handler-executor");
    const interceptorIndex = order.indexOf("auth-interceptor");
    const authorizeIndex = order.indexOf("auth-handler");

    expect(executorIndex).toBeGreaterThanOrEqual(0);
    expect(interceptorIndex).toBeGreaterThanOrEqual(0);
    expect(authorizeIndex).toBeGreaterThanOrEqual(0);
    expect(executorIndex).toBeLessThan(interceptorIndex);
    expect(interceptorIndex).toBeLessThan(authorizeIndex);
  });

  it("exposes the model class used by the route", () => {
    expect(ProductAdmin.name).toBe("Product");
  });
});
