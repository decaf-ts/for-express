import * as root from "../../src";
import * as routeDecorators from "../../src/decorators";
import * as decoration from "../../src/decoration";
import * as requestAuth from "../../src/request/DecafAuthHandler";
import { Auth as ModelAuth } from "../../src/decaf-model/decorators/decorators";

describe("public API barrels", () => {
  it("re-exports the framework route decorators", () => {
    expect(typeof routeDecorators.route).toBe("function");
    expect(typeof routeDecorators.get).toBe("function");
    expect(typeof routeDecorators.post).toBe("function");
    expect(typeof routeDecorators.put).toBe("function");
    expect(typeof routeDecorators.patch).toBe("function");
    expect(typeof routeDecorators.delete).toBe("function");
    expect(typeof routeDecorators.del).toBe("function");
  });

  it("re-exports the express auth decorators", () => {
    expect(typeof routeDecorators.Auth).toBe("function");
    expect(typeof routeDecorators.Public).toBe("function");
    expect(typeof routeDecorators.RequireRoles).toBe("function");
    expect(typeof routeDecorators.RequireNamespaces).toBe("function");
  });

  it("re-exports the decoration keys", () => {
    expect(decoration.DecorationKeys).toBeDefined();
  });

  it("re-exports the auth handler base alias", () => {
    expect(typeof requestAuth.DecafAuthHandlerBase).toBe("function");
  });

  it("exposes the model Auth decorator through its barrel", () => {
    expect(typeof ModelAuth).toBe("function");
  });

  it("exposes the package surface from the root barrel", () => {
    expect(root.DecafModule).toBeDefined();
    expect(root.ExpressBootstraper).toBeDefined();
    expect(root.DecafErrorFilter).toBeDefined();
    expect(root.VERSION).toBeDefined();
  });
});
