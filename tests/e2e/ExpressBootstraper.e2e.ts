import express from "express";
import request from "supertest";
import { ExpressBootstraper } from "../../src/factory/ExpressBootstraper";

describe("ExpressBootstraper", () => {
  it("registers the decaf error filter by default and starts the app", async () => {
    const app = express();
    const use = jest.spyOn(app, "use");
    const listen = jest.fn((_port: number, _host: any, cb: () => void) => {
      cb();
      return { listening: true } as any;
    });
    (app as any).listen = listen;

    ExpressBootstraper.initialize(app).useGlobalFilters();
    await ExpressBootstraper.start(0, "127.0.0.1", false);

    expect(use).toHaveBeenCalled();
    expect(listen).toHaveBeenCalled();
  });

  it("registers custom middleware and interceptors as plain middleware", () => {
    const app = express();
    const use = jest.spyOn(app, "use");
    const middleware = jest.fn((_req: any, _res: any, next: any) => next());

    ExpressBootstraper.initialize(app)
      .useGlobalMiddleware(middleware)
      .useGlobalInterceptors(middleware);

    expect(use).toHaveBeenCalledWith(middleware);
    expect(use).toHaveBeenCalledTimes(2);
  });

  it("chains bootstrap configuration methods", () => {
    const app = express();
    const result = ExpressBootstraper.initialize(app)
      .enableLogger()
      .enableCors("*")
      .useGlobalFilters();

    expect(result).toBe(ExpressBootstraper);
  });

  describe("enableCors credentials (SAA-109 F5)", () => {
    it("does not send credentials for wildcard origins", async () => {
      const app = express();
      ExpressBootstraper.initialize(app).enableCors("*");

      const res = await request(app)
        .get("/")
        .set("Origin", "https://evil.example");

      // The fix forces `credentials: false` for wildcard origins, so no
      // Access-Control-Allow-Credentials header is emitted (reflected ACAO
      // without credentials is safe).
      expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    });

    it("sends credentials for an explicit origin allow-list", async () => {
      const app = express();
      ExpressBootstraper.initialize(app).enableCors(["https://allowed.example"]);

      const allowed = await request(app)
        .get("/")
        .set("Origin", "https://allowed.example");
      expect(allowed.headers["access-control-allow-origin"]).toBe(
        "https://allowed.example"
      );
      expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

      const denied = await request(app)
        .get("/")
        .set("Origin", "https://evil.example");
      expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });
});
