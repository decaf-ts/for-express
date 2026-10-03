import { ForbiddenError } from "@decaf-ts/core";

import { CorsError } from "../../src/factory/errors/cors";
import { ToManyRequestsError } from "../../src/factory/errors/throttling";

describe("factory errors", () => {
  it("builds a forbidden CorsError carrying the rejection message", () => {
    const error = new CorsError("Origin https://evil.example not allowed");

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toContain("Origin https://evil.example not allowed");
  });

  it("accepts a source Error for the CORS rejection", () => {
    const error = new CorsError(new Error("blocked"));
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toContain("blocked");
  });

  it("builds a throttling error", () => {
    const error = new ToManyRequestsError("too many requests");
    expect(error.message).toContain("too many requests");
  });
});
