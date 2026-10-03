import request from "supertest";
import { AuthInterceptor } from "../../src/auth/AuthInterceptor";
import { AuthMiddleware } from "../../src/auth/AuthMiddleware";
import { DecafRoleAuthHandler } from "../../src/auth/DecafAuthHandler";
import { DecafRequestContext } from "../../src/request/DecafRequestContext";
import { buildApp } from "../e2e/fakes/app";
import { genStr } from "../e2e/fakes/utils";
import { Product as ProductAdmin } from "../e2e/fakes/models/ProductAdmin";

jest.setTimeout(60000);

describe("Auth middleware and interceptor", () => {
  let app: any;
  let decaf: any;

  beforeAll(async () => {
    const built = await buildApp({ authHandler: new DecafRoleAuthHandler() });
    app = built.app;
    decaf = built.decaf;
  });

  afterAll(async () => {
    await decaf?.shutdown?.();
  });

  const productCode = genStr(14);
  const batchNumber = `BATCH${genStr(3)}`;
  const payload = { productCode, batchNumber, name: "Admin product" };

  it("rejects an unauthenticated write with a 401", async () => {
    const res = await request(app).post("/product").send(payload);
    expect(res.status).toBe(401);
  });

  it("rejects a write by a user without the required role", async () => {
    const res = await request(app)
      .post("/product")
      .set("Authorization", "Bearer user")
      .send(payload);
    // for-http maps missing model roles to AuthorizationError (401)
    expect(res.status).toBe(401);
  });

  it("rejects a non-Bearer Authorization scheme with a 401", async () => {
    // SAA-109 F2: the handler must only accept the `Bearer <token>` scheme;
    // an arbitrary scheme carrying a valid role must not be trusted.
    const res = await request(app)
      .post("/product")
      .set("Authorization", "WhateverToken admin")
      .send(payload);
    expect(res.status).toBe(401);
  });

  it("accepts a write by a user with the required role", async () => {
    const res = await request(app)
      .post("/product")
      .set("Authorization", "Bearer admin")
      .send(payload);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Admin product");
  });

  it("binds the authenticated user through the request transformer", async () => {
    const res = await request(app)
      .get(`/product/${productCode}/${batchNumber}`)
      .set("Authorization", "Bearer admin");
    expect(res.status).toBe(200);
    expect(res.body.createdBy).toBe("admin");
  });

  it("reports the missing model role from the base handler", async () => {
    const handler = new DecafRoleAuthHandler();
    const context = new DecafRequestContext({
      headers: {},
    } as any);
    await expect(
      handler.authorize(
        { headers: { authorization: "Bearer user" } } as any,
        ProductAdmin,
        undefined,
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow("Missing required roles: admin");
  });

  describe("AuthMiddleware", () => {
    it("primes best-effort and always calls next()", async () => {
      const next = jest.fn();
      const handler = new AuthMiddleware(new DecafRoleAuthHandler()).handler;
      const req: any = { headers: {}, method: "GET", url: "/" };
      await handler(req, {} as any, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.decafContext).toBeInstanceOf(DecafRequestContext);
    });

    it("does not throw when the auth handler rejects while priming", async () => {
      const handler = new AuthMiddleware(new DecafRoleAuthHandler()).handler;
      const next = jest.fn();
      await handler({ headers: {} } as any, {} as any, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("AuthInterceptor", () => {
    it("skips authorization for public routes", async () => {
      const context = new DecafRequestContext({ headers: {} } as any);
      const interceptor = new AuthInterceptor(new DecafRoleAuthHandler(), {
        public: true,
      });
      await expect(
        interceptor.intercept(context, { headers: {} } as any)
      ).resolves.toBeUndefined();
    });

    it("does not authorize when no handler is registered", async () => {
      const context = new DecafRequestContext({ headers: {} } as any);
      const interceptor = new AuthInterceptor(undefined, {
        model: ProductAdmin.name,
      });
      await expect(
        interceptor.intercept(context, { headers: {} } as any)
      ).resolves.toBeUndefined();
    });
  });
});
