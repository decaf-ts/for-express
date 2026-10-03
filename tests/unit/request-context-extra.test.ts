import { DecafRequestContext } from "../../src/request/DecafRequestContext";

describe("DecafRequestContext", () => {
  it("resolves headers from the accumulated context data", () => {
    const headers = { authorization: "Bearer admin" };
    const context = new DecafRequestContext({ headers } as any);
    context.accumulate({ headers });

    expect(context.headers).toEqual(headers);
  });

  it("returns undefined headers when none are present", () => {
    const context = new DecafRequestContext({} as any);
    expect(context.headers).toBeUndefined();
  });

  it("accumulates overrides through put", () => {
    const context = new DecafRequestContext({ headers: {} } as any);
    context.put({ a: 1 });
    context.put({ b: 2 });

    expect(context.get("overrides")).toEqual({ a: 1, b: 2 });
  });

  it("stamps pending tasks onto the response when present", () => {
    const context = new DecafRequestContext({ headers: {} } as any);
    const pending = { id: "task-1" };
    jest.spyOn(context as any, "pending").mockReturnValue(pending);
    const res = { header: jest.fn() };

    expect(context.toResponse(res)).toBe(res);
    expect(res.header).toHaveBeenCalledWith(
      "x-pending-task",
      JSON.stringify(pending)
    );
  });

  it("returns the response untouched when nothing is pending", () => {
    const context = new DecafRequestContext({ headers: {} } as any);
    const res = { header: jest.fn() };

    expect(context.toResponse(res)).toBe(res);
    expect(res.header).not.toHaveBeenCalled();
  });

  it("tolerates a response without a header function", () => {
    const context = new DecafRequestContext({ headers: {} } as any);
    jest.spyOn(context as any, "pending").mockReturnValue({ id: "t" });
    const res = {};

    expect(context.toResponse(res)).toBe(res);
  });
});
