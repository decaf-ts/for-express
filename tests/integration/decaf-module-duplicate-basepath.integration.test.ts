import { Adapter, column, pk, table } from "@decaf-ts/core";
// @ts-expect-error ram
import { RamAdapter, RamFlavour } from "@decaf-ts/core/ram";
import { RamTransformer } from "@decaf-ts/for-http/server";
import { InternalError } from "@decaf-ts/db-decorators";
import { uses } from "@decaf-ts/decoration";
import { toKebabCase } from "@decaf-ts/logging";
import { Model, model, ModelArg } from "@decaf-ts/decorator-validation";

import { DecafCoreModule, DecafModule } from "../../src";
import { ProcessStep } from "../e2e/fakes/models/ProcessStep";

RamAdapter.decoration();
Adapter.setCurrent(RamFlavour);

// SAA-146 N-2 regression fixture. `ProcessStep` is decorated with
// `@table("process_step")`, whose kebab-cased base path is `process-step`.
// This model deliberately kebab-collides with it via the camelCase
// `@table("processStep")` -> `process-step`. It lives in this dedicated test
// file so the extra globally-registered flavoured model does not leak into other
// jest test files (jest isolates the module registry per test file).
@uses(RamFlavour)
@table("processStep")
@model()
export class StepAlias extends Model {
  @pk({ type: "String", generated: false })
  id!: string;

  @column()
  label!: string;

  constructor(model?: ModelArg<StepAlias>) {
    super(model);
  }
}

jest.setTimeout(60000);

// SAA-146 N-2 regression: `DecafModelModule.forRoot` mounted every exposed
// model's routes under `/${toKebabCase(Model.tableName(model))}` but never
// checked that the resolved base paths were unique. Two models whose table names
// kebab-collapse to the same path silently produced two routers mounted on the
// same prefix, so the first router shadowed the second. `forRoot` now computes
// every exposed model's kebab-cased base path before generating any routes and
// throws a decaf `InternalError` naming both models on a collision.
//
// These assertions deliberately fail if the guard is reverted: the duplicate
// models boot successfully and `forRoot` resolves instead of rejecting.
describe("DecafModule.forRoot duplicate kebab base path guard (SAA-146 N-2)", () => {
  afterAll(async () => {
    await DecafCoreModule.shutdown();
  });

  it("kebab-collapses both distinct table names onto the same base path", () => {
    // Precondition proving the collision is real and not a test artefact.
    expect(Model.tableName(ProcessStep)).toBe("process_step");
    expect(Model.tableName(StepAlias)).toBe("processStep");
    expect(toKebabCase(Model.tableName(ProcessStep))).toBe("process-step");
    expect(toKebabCase(Model.tableName(StepAlias))).toBe("process-step");
  });

  it("rejects DecafModule.forRoot with a specific InternalError naming the collision", async () => {
    let thrown: unknown;
    try {
      await DecafModule.forRoot({
        conf: [[RamAdapter, {}, new RamTransformer()]],
        autoControllers: true,
        autoServices: false,
        allowAnonymous: true,
      } as any);
    } catch (e: unknown) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(InternalError);
    const message = (thrown as Error).message;
    expect(message).toContain("/process-step");
    expect(message).toContain("ProcessStep");
    expect(message).toContain("StepAlias");
  });
});
