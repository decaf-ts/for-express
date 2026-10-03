import express from "express";
import request from "supertest";

import { ExpressBootstraper } from "../../src/factory/ExpressBootstraper";

describe("ExpressBootstraper extras", () => {
  it("normalizes and matches array origins case-insensitively", async () => {
    const app = express();
    ExpressBootstraper.initialize(app).enableCors(["  HTTPS://Allowed.Example  "]);
    app.get("/", (_req, res) => res.json({ ok: true }));

    await request(app)
      .get("/")
      .set("Origin", "https://allowed.example")
      .expect(200);
  });

  it("allows requests without an Origin header", async () => {
    const app = express();
    ExpressBootstraper.initialize(app).enableCors(["https://allowed.example"]);
    app.get("/", (_req, res) => res.json({ ok: true }));

    await request(app).get("/").expect(200);
  });

  it("rejects a disallowed origin through the cors origin callback", async () => {
    const app = express();
    ExpressBootstraper.initialize(app).enableCors(["https://allowed.example"]);
    app.get("/", (_req, res) => res.json({ ok: true }));
    app.use((err: any, _req: any, res: any, _next: any) => {
      void _next;
      res.status(500).json({ message: err.message });
    });

    const res = await request(app)
      .get("/")
      .set("Origin", "https://evil.example");

    expect(res.status).toBe(500);
    expect(res.body.message).toContain("not allowed");
  });

  it("skips helmet with a warning when it is not installed", () => {
    const app = express();
    const use = jest.spyOn(app, "use");

    const result = ExpressBootstraper.initialize(app).useHelmet();

    expect(result).toBe(ExpressBootstraper);
    expect(use).not.toHaveBeenCalled();
  });

  it("logs at error level when helmet is not installed (SAA-109 F5)", () => {
    const app = express();
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    ExpressBootstraper.initialize(app).enableLogger(logger as any).useHelmet();

    expect(logger.error).toHaveBeenCalledWith(
      "Helmet not installed. Skipping middleware."
    );
    ExpressBootstraper.enableLogger();
  });

  it("registers rate limiting with custom options", () => {
    const app = express();
    const use = jest.spyOn(app, "use");

    ExpressBootstraper.initialize(app).useRateLimit({ max: 5 });

    expect(use).toHaveBeenCalled();
  });

  it("registers rate limiting with the default options", () => {
    const app = express();
    const use = jest.spyOn(app, "use");

    ExpressBootstraper.initialize(app).useRateLimit();

    expect(use).toHaveBeenCalled();
  });

  it("logs the running URL through the lazy logger when starting", async () => {
    const app = express();
    const listen = jest.fn((_port: number, _host: any, cb: () => void) => {
      cb();
      return { listening: true } as any;
    });
    (app as any).listen = listen;

    ExpressBootstraper.initialize(app);
    await ExpressBootstraper.start(0, "127.0.0.1", true);

    expect(listen).toHaveBeenCalled();
  });
});
