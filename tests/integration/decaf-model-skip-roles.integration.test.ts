import request from "supertest";
import { BaseModel, column, createdBy, pk, roles, table } from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import { model, ModelArg } from "@decaf-ts/decorator-validation";
// @ts-expect-error ram
import { RamFlavour } from "@decaf-ts/core/ram";

import { controllerConfig } from "../../src/decaf-model/decorators/controller-config";
import { DecafRoleAuthHandler } from "../../src/auth/DecafAuthHandler";
import { buildApp } from "../e2e/fakes/app";
import { genStr } from "../e2e/fakes/utils";

jest.setTimeout(60000);

// SAA-109 F8: the auth config that reaches the AuthInterceptor must carry
// `model: undefined` when `skipModelRoles` is set, so model-level roles are
// skipped while route-level roles still apply. for-express carries this through
// the `@controllerConfig({ auth: { skipModelRoles: true } })` / `AuthConfig`
// path (the decorator/reflection equivalent of for-nest's `@SkipModelRoles()`).
@uses(RamFlavour)
@table("skip_roles_product")
@model()
@roles(["admin"])
@controllerConfig({ auth: { skipModelRoles: true } })
export class SkipRolesProduct extends BaseModel {
  @pk({ type: "String", generated: false })
  id!: string;

  @column()
  name!: string;

  @column()
  @createdBy()
  createdBy!: string;

  constructor(args?: ModelArg<SkipRolesProduct>) {
    super(args);
  }
}

@uses(RamFlavour)
@table("control_roles_product")
@model()
@roles(["admin"])
export class ControlRolesProduct extends BaseModel {
  @pk({ type: "String", generated: false })
  id!: string;

  @column()
  name!: string;

  @column()
  @createdBy()
  createdBy!: string;

  constructor(args?: ModelArg<ControlRolesProduct>) {
    super(args);
  }
}

function payload() {
  return { id: `skip-${genStr(10)}`, name: "skip roles product" };
}

describe("DecafModelModule skipModelRoles wiring (SAA-109 F8)", () => {
  it("passes model: undefined to the auth handler when skipModelRoles is set", async () => {
    const handler = new DecafRoleAuthHandler();
    const authorize = jest.spyOn(handler, "authorize");

    const { app, decaf } = await buildApp({
      authHandler: handler,
      controllerExposure: { ControlRolesProduct: false },
    });

    try {
      const res = await request(app)
        .post("/skip-roles-product")
        .set("Authorization", "Bearer user")
        .send(payload());

      expect(res.status).toBe(201);
      expect(authorize).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        undefined,
        undefined,
        undefined,
        expect.anything()
      );
    } finally {
      await decaf.shutdown();
    }
  });

  it("keeps the model name when skipModelRoles is not set", async () => {
    const handler = new DecafRoleAuthHandler();
    const authorize = jest.spyOn(handler, "authorize");

    const { app, decaf } = await buildApp({
      authHandler: handler,
      controllerExposure: { SkipRolesProduct: false },
    });

    try {
      const res = await request(app)
        .post("/control-roles-product")
        .set("Authorization", "Bearer user")
        .send(payload());

      expect(res.status).toBe(401);
      expect(authorize).toHaveBeenCalledWith(
        expect.anything(),
        "ControlRolesProduct",
        undefined,
        undefined,
        undefined,
        expect.anything()
      );
    } finally {
      await decaf.shutdown();
    }
  });
});
