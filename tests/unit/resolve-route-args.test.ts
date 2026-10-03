import { resolveRouteArgs } from "../../src/decaf-model/FromModelController";

function req(options: {
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
}): any {
  return {
    params: options.params ?? {},
    query: options.query ?? {},
    body: options.body,
  };
}

describe("resolveRouteArgs", () => {
  it("binds the body for a create route", () => {
    const body = { id: "1" };
    expect(resolveRouteArgs({ method: "POST", path: "" }, req({ body }))).toEqual([
      body,
    ]);
  });

  it("binds the body for bulk create/update routes", () => {
    const body = [{ id: "1" }];
    expect(
      resolveRouteArgs({ method: "POST", path: "bulk" }, req({ body }))
    ).toEqual([body]);
    expect(
      resolveRouteArgs({ method: "PUT", path: "bulk" }, req({ body }))
    ).toEqual([body]);
  });

  it("normalizes bulk ids from a string or array", () => {
    expect(
      resolveRouteArgs({ method: "GET", path: "bulk" }, req({ query: { ids: "a" } }))
    ).toEqual([["a"]]);
    expect(
      resolveRouteArgs(
        { method: "DELETE", path: "bulk" },
        req({ query: { ids: ["a", "b"] } })
      )
    ).toEqual([["a", "b"]]);
    expect(
      resolveRouteArgs({ method: "GET", path: "bulk" }, req({ query: {} }))
    ).toEqual([[]]);
  });

  it("coerces numeric path params and preserves non-numeric ones", () => {
    expect(
      resolveRouteArgs(
        { method: "GET", path: ":productCode/:batchNumber" },
        req({ params: { productCode: "12345678901234", batchNumber: "42" } })
      )
    ).toEqual([12345678901234, 42]);
    expect(
      resolveRouteArgs(
        { method: "GET", path: ":productCode/:batchNumber" },
        req({ params: { productCode: "BATCH/ABC", batchNumber: "7" } })
      )
    ).toEqual(["BATCH/ABC", 7]);
  });

  it("binds statement routes with coerced args and direction", () => {
    expect(
      resolveRouteArgs(
        { method: "GET", path: "statement/:method/*args" },
        req({ params: { method: "listBy", args: ["name", "desc"] } })
      )
    ).toEqual(["listBy", ["name", "desc"], { direction: "desc" }]);
  });

  it("binds listBy with query details", () => {
    expect(
      resolveRouteArgs(
        { method: "GET", path: "listBy/:key" },
        req({ params: { key: "name" }, query: { direction: "desc", limit: "10" } })
      )
    ).toEqual(["name", { direction: "desc", limit: 10 }]);
  });

  it("binds findOneBy with key and value", () => {
    expect(
      resolveRouteArgs(
        { method: "GET", path: "findOneBy/:key/:value" },
        req({ params: { key: "name", value: "abc" } })
      )
    ).toEqual(["name", "abc"]);
  });

  it("binds grouping routes to the field only", () => {
    expect(
      resolveRouteArgs(
        { method: "GET", path: "countOf/:field" },
        req({ params: { field: "name" } })
      )
    ).toEqual(["name"]);
  });

  it("binds query routes with and without details", () => {
    expect(
      resolveRouteArgs(
        { method: "GET", path: "query/:a/:b" },
        req({ params: { a: "1", b: "2" } })
      )
    ).toEqual([1, 2]);
    expect(
      resolveRouteArgs(
        { method: "GET", path: "query/:a" },
        req({ params: { a: "1" }, query: { limit: "5" } })
      )
    ).toEqual([1, { limit: 5 }]);
  });

  it("binds custom POST/PUT routes with body and path values", () => {
    const body = { name: "x" };
    expect(
      resolveRouteArgs({ method: "POST", path: "custom" }, req({ body }))
    ).toEqual([body]);
    expect(
      resolveRouteArgs(
        { method: "POST", path: "custom/:id" },
        req({ params: { id: "7" }, body })
      )
    ).toEqual([body, 7]);
  });

  it("binds custom DELETE routes to path values or details", () => {
    expect(
      resolveRouteArgs(
        { method: "DELETE", path: "custom/:id" },
        req({ params: { id: "7" } })
      )
    ).toEqual([7]);
    expect(
      resolveRouteArgs(
        { method: "DELETE", path: "custom" },
        req({ query: { limit: "3" } })
      )
    ).toEqual([{ limit: 3 }]);
  });
});
