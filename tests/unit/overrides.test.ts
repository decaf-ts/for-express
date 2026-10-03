import { Metadata } from "@decaf-ts/decoration";
import { Context } from "@decaf-ts/core";
import { ModelBuilder } from "@decaf-ts/decorator-validation";

import "../../src/overrides";
import { AUTH_META_KEY } from "../../src/auth/constants";

describe("overrides", () => {
  describe("ModelBuilder extensions", () => {
    it("replays the accumulated class decorators on build", () => {
      const built = ModelBuilder.builder()
        .setName("Overridden")
        .Auth("OverriddenResource")
        .build();

      expect(Metadata.get(built as any, AUTH_META_KEY)).toBe(
        "OverriddenResource"
      );
    });

    it("returns the builder from Auth for chaining", () => {
      const builder = ModelBuilder.builder().setName("Chained");
      expect(builder.Auth("ChainedResource")).toBe(builder);
      expect((builder as any)._classDecorators).toHaveLength(1);
    });

    it("installs the fallback decorateClass when the base builder lacks it", () => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ModelBuilder: FreshBuilder } = require("@decaf-ts/decorator-validation");
        delete (FreshBuilder.prototype as any).decorateClass;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../src/overrides/ModelBuilderExtensions");

        const builder = new FreshBuilder();
        expect(typeof builder.decorateClass).toBe("function");

        const decorator = jest.fn();
        expect(builder.decorateClass(decorator)).toBe(builder);
        expect((builder as any)._classDecorators).toEqual([decorator]);
      });
    });
  });

  describe("Context.toResponse patch", () => {
    it("stamps the pending-task header when tasks are pending", () => {
      const toResponse = (Context as any).prototype.toResponse as (
        this: any,
        res: any
      ) => any;
      const pending = { id: "task-1" };
      const res = { header: jest.fn() };

      const result = toResponse.call({ pending: () => pending }, res);

      expect(res.header).toHaveBeenCalledWith(
        "x-pending-task",
        JSON.stringify(pending)
      );
      expect(result).toBe(res);
    });

    it("returns the response untouched when nothing is pending", () => {
      const toResponse = (Context as any).prototype.toResponse as (
        this: any,
        res: any
      ) => any;
      const res = { header: jest.fn() };

      const result = toResponse.call({ pending: () => undefined }, res);

      expect(res.header).not.toHaveBeenCalled();
      expect(result).toBe(res);
    });
  });
});
