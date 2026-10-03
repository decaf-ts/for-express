import express from "express";

import { ExpressBootstraper } from "../../src/factory/ExpressBootstraper";

// Force the optional peer middlewares to look uninstalled so the bootstrap
// failure paths are exercised. `helmet` is genuinely absent from the workspace;
// `cors` and `express-rate-limit` are installed, so they are mocked to throw
// the same way `require` would when the package is missing.
jest.mock("cors", () => {
  throw new Error("Cannot find module 'cors'");
});
jest.mock("express-rate-limit", () => {
  throw new Error("Cannot find module 'express-rate-limit'");
});

function logger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

describe("ExpressBootstraper missing optional dependencies (SAA-109 F5)", () => {
  it("logs at error level when cors is not installed", () => {
    const app = express();
    const log = logger();

    ExpressBootstraper.initialize(app).enableLogger(log as any).enableCors("*");

    expect(log.error).toHaveBeenCalledWith(
      "cors not installed. Skipping CORS middleware."
    );
  });

  it("logs at error level when express-rate-limit is not installed", () => {
    const app = express();
    const log = logger();

    ExpressBootstraper.initialize(app).enableLogger(log as any).useRateLimit();

    expect(log.error).toHaveBeenCalledWith(
      "express-rate-limit not installed. Skipping rate limiting."
    );
  });
});
