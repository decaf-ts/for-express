import { Metadata } from "@decaf-ts/decoration";

import {
  Auth,
  Public,
  RequireRoles,
  RequireNamespaces,
  SkipModelRoles,
  SkipModelNamespaces,
  defineClassMetadata,
  defineMethodMetadata,
} from "../../src/auth/decorators";
import {
  AUTH_META_KEY,
  IS_PUBLIC_KEY,
  REQUIRED_NAMESPACES_KEY,
  REQUIRED_ROLES_KEY,
  SKIP_MODEL_NAMESPACES_KEY,
  SKIP_MODEL_ROLES_KEY,
} from "../../src/auth/constants";
import { Auth as ModelAuth } from "../../src/decaf-model/decorators/decorators";
import { DECAF_EXPOSE, DECAF_CONTROLLER_CONFIG } from "../../src/constants";
import { expose } from "../../src/decaf-model/decorators/expose";
import { controllerConfig } from "../../src/decaf-model/decorators/controller-config";

class Subject {
  name = "";
  run() {
    return 1;
  }
}

describe("auth decorators", () => {
  it("stamps the model resource on a class via @Auth", () => {
    @Auth("Product")
    class Product {}
    expect(Metadata.get(Product as any, AUTH_META_KEY)).toBe("Product");
  });

  it("resolves the resource name from a model constructor", () => {
    @Auth(Subject)
    class FromCtor {}
    expect(Metadata.get(FromCtor as any, AUTH_META_KEY)).toBe("Subject");
  });

  it("leaves the resource undefined when @Auth is called without a model", () => {
    @Auth()
    class Anonymous {}
    expect(Metadata.get(Anonymous as any, AUTH_META_KEY)).toBeUndefined();
  });

  it("stamps the public flag on classes and methods", () => {
    @Public()
    class Open {}
    expect(Metadata.get(Open as any, IS_PUBLIC_KEY)).toBe(true);

    class WithRoute {
      @Public()
      handler() {
        return 1;
      }
    }
    expect(
      Metadata.get((WithRoute.prototype as any).handler, IS_PUBLIC_KEY)
    ).toBe(true);
  });

  it("stamps required roles and namespaces", () => {
    @RequireRoles("admin", "auditor")
    @RequireNamespaces("tenant-a")
    class Secured {}
    expect(Metadata.get(Secured as any, REQUIRED_ROLES_KEY)).toEqual([
      "admin",
      "auditor",
    ]);
    expect(Metadata.get(Secured as any, REQUIRED_NAMESPACES_KEY)).toEqual([
      "tenant-a",
    ]);

    class Route {
      @RequireRoles("editor")
      @RequireNamespaces("tenant-b")
      handler() {
        return 1;
      }
    }
    const fn = (Route.prototype as any).handler;
    expect(Metadata.get(fn, REQUIRED_ROLES_KEY)).toEqual(["editor"]);
    expect(Metadata.get(fn, REQUIRED_NAMESPACES_KEY)).toEqual(["tenant-b"]);
  });

  it("stamps the skip-model flags on classes and methods", () => {
    @SkipModelRoles()
    @SkipModelNamespaces()
    class Skipping {}
    expect(Metadata.get(Skipping as any, SKIP_MODEL_ROLES_KEY)).toBe(true);
    expect(Metadata.get(Skipping as any, SKIP_MODEL_NAMESPACES_KEY)).toBe(true);

    class Route {
      @SkipModelRoles()
      @SkipModelNamespaces()
      handler() {
        return 1;
      }
    }
    const fn = (Route.prototype as any).handler;
    expect(Metadata.get(fn, SKIP_MODEL_ROLES_KEY)).toBe(true);
    expect(Metadata.get(fn, SKIP_MODEL_NAMESPACES_KEY)).toBe(true);
  });

  it("writes class metadata through defineClassMetadata", () => {
    const result = defineClassMetadata("custom:class", { a: 1 })(Subject);
    expect(result).toBe(Subject);
    expect(Metadata.get(Subject as any, "custom:class")).toEqual({ a: 1 });
  });

  it("writes method metadata through defineMethodMetadata", () => {
    const decorator = defineMethodMetadata("custom:method", 42);
    const descriptor = decorator(
      Subject.prototype,
      "run",
      Object.getOwnPropertyDescriptor(Subject.prototype, "run") as any
    );
    expect(descriptor).toBeDefined();
    expect(Metadata.get((Subject.prototype as any).run, "custom:method")).toBe(
      42
    );
  });
});

describe("decaf-model decorators", () => {
  it("re-exports the auth decorator from the decorators barrel", () => {
    expect(ModelAuth).toBe(Auth);
  });

  it("records exposure metadata with explicit flavours", () => {
    @expose("rest", "ram")
    class Restricted {}
    expect(Metadata.get(Restricted as any, DECAF_EXPOSE)).toEqual([
      "rest",
      "ram",
    ]);
  });

  it("records exposure in every flavour when called without arguments", () => {
    @expose()
    class Everywhere {}
    expect(Metadata.get(Everywhere as any, DECAF_EXPOSE)).toBe(true);
  });

  it("records the controller factory config on the model", () => {
    const config = { allowStatementlessQuery: false };
    @controllerConfig(config)
    class Configured {}
    expect(Metadata.get(Configured as any, DECAF_CONTROLLER_CONFIG)).toEqual(
      config
    );
  });
});
