import { Logging } from "@decaf-ts/logging";
import { contextualizeRequestContext } from "../../src/request/contextualize";

describe("contextualizeRequestContext", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function fakeRequestContext() {
    const store: Record<string, any> = {};
    return {
      store,
      getOrUndefined: (key: string) => store[key],
      accumulate: (record: Record<string, any>) =>
        Object.assign(store, record),
    };
  }

  it("binds ip metadata once and preserves existing logger enrichment", () => {
    const forCalls: any[] = [];
    const baseLogger = {
      for: jest.fn((meta: any) => {
        forCalls.push(meta);
        return baseLogger;
      }),
      error: jest.fn(),
      debug: jest.fn(),
    };
    jest.spyOn(Logging, "get").mockReturnValue(baseLogger as any);

    const requestContext = fakeRequestContext();
    const req = {
      method: "GET",
      url: "/secure",
      headers: { "x-forwarded-for": "10.0.0.1, 127.0.0.1" },
    };

    expect(contextualizeRequestContext(requestContext as any, req)).toBe(true);
    expect(forCalls).toEqual([{ ip: "10.0.0.1" }]);
    expect(requestContext.store.operation).toBe("GET /secure");
    expect(requestContext.store.timestamp).toBeInstanceOf(Date);
    expect(requestContext.store.logger).toBe(baseLogger);

    // Idempotent: a second call does not re-bind metadata.
    expect(contextualizeRequestContext(requestContext as any, req)).toBe(false);
    expect(forCalls).toHaveLength(1);
  });
});
