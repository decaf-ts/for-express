import { Adapter } from "@decaf-ts/core";
// @ts-expect-error ram
import { RamAdapter, RamFlavour } from "@decaf-ts/core/ram";
import { InternalError } from "@decaf-ts/db-decorators";
import { RamTransformer } from "@decaf-ts/for-http/server";

import { DecafModule, runMigrations } from "../../src/module";

RamAdapter.decoration();
Adapter.setCurrent(RamFlavour);

describe("module", () => {
  it("resolves runMigrations immediately without doing work", async () => {
    await expect(runMigrations()).resolves.toBeUndefined();
  });

  describe("DecafModule.forRoot fail-closed bootstrap (SAA-109 F1)", () => {
    it("throws an InternalError when autoControllers is enabled without an authHandler", async () => {
      await expect(
        DecafModule.forRoot({
          conf: [[RamAdapter, {}, new RamTransformer()]],
          autoControllers: true,
        } as any)
      ).rejects.toThrow(InternalError);
      await expect(
        DecafModule.forRoot({
          conf: [[RamAdapter, {}, new RamTransformer()]],
          autoControllers: true,
        } as any)
      ).rejects.toThrow(/no authHandler was provided/);
    });

    it("boots when allowAnonymous: true explicitly opts out of auth", async () => {
      const app = await DecafModule.forRoot({
        conf: [[RamAdapter, {}, new RamTransformer()]],
        autoControllers: true,
        allowAnonymous: true,
      } as any);

      expect(app.router).toBeDefined();
      expect(app.flavours).toContain(RamFlavour);
      await app.shutdown();
    });
  });
});
