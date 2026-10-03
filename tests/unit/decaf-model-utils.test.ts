import { ModelService, Repository } from "@decaf-ts/core";
import { BaseError, InternalError } from "@decaf-ts/db-decorators";

import {
  createRouteHandler,
  defineRouteMethod,
  resolvePersistenceMethod,
  routeLogger,
} from "../../src/decaf-model/utils";

describe("decaf-model/utils", () => {
  describe("resolvePersistenceMethod", () => {
    it("invokes a named method on a ModelService", () => {
      const service: any = Object.create(ModelService.prototype);
      service.countOf = jest.fn().mockReturnValue(7);
      expect(resolvePersistenceMethod(service, "countOf", "field")).toBe(7);
      expect(service.countOf).toHaveBeenCalledWith("field");
    });

    it("falls back to statement() when the ModelService method is missing", () => {
      const service: any = Object.create(ModelService.prototype);
      service.statement = jest.fn().mockReturnValue("statement-result");
      expect(resolvePersistenceMethod(service, "unknownMethod", 1, 2)).toBe(
        "statement-result"
      );
      expect(service.statement).toHaveBeenCalledWith("unknownMethod", 1, 2);
    });

    it("invokes a named method on a repository", () => {
      const repository: any = Object.create(Repository.prototype);
      repository.countOf = jest.fn().mockReturnValue(3);
      expect(resolvePersistenceMethod(repository, "countOf", "field")).toBe(3);
      expect(repository.countOf).toHaveBeenCalledWith("field");
    });

    it("throws an InternalError when the repository method is missing", () => {
      const repository: any = Object.create(Repository.prototype);
      expect(() =>
        resolvePersistenceMethod(repository, "missingMethod")
      ).toThrow(InternalError);
      expect(() =>
        resolvePersistenceMethod(repository, "missingMethod")
      ).toThrow(/Persistence method "missingMethod" not found/);
    });
  });

  describe("createRouteHandler", () => {
    function fakeController(persistence: any) {
      const logger = { debug: jest.fn(), error: jest.fn() };
      return {
        log: { for: jest.fn(() => logger) },
        logger,
        ctx: {},
        persistence: jest.fn(() => persistence),
      };
    }

    const pathParams = { valuesInOrder: [1, 2] } as any;
    const queryParams = { direction: "desc", limit: 10, offset: 5 } as any;

    it("forwards path params and query details to the persistence method", async () => {
      const persistence: any = Object.create(Repository.prototype);
      persistence.custom = jest.fn().mockResolvedValue("ok");
      const controller = fakeController(persistence);

      const handler = createRouteHandler("custom");
      await expect(
        handler.call(controller, pathParams, queryParams)
      ).resolves.toBe("ok");
      expect(persistence.custom).toHaveBeenCalledWith(
        1,
        2,
        "desc",
        10,
        5
      );
      expect(controller.logger.debug).toHaveBeenCalled();
    });

    it("rethrows a decaf BaseError unchanged", async () => {
      const failure = new InternalError("already decaf");
      const persistence: any = Object.create(Repository.prototype);
      persistence.custom = jest.fn().mockRejectedValue(failure);
      const controller = fakeController(persistence);

      const handler = createRouteHandler("custom");
      await expect(
        handler.call(controller, pathParams, queryParams)
      ).rejects.toBe(failure);
      expect(controller.logger.error).toHaveBeenCalled();
    });

    it("wraps a plain Error with the custom-query fallback message", async () => {
      const persistence: any = Object.create(Repository.prototype);
      persistence.custom = jest.fn().mockRejectedValue(new Error("boom"));
      const controller = fakeController(persistence);

      const handler = createRouteHandler("custom");
      await expect(
        handler.call(controller, pathParams, queryParams)
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          'Custom query "custom" failed: boom'
        ),
      });
    });

    it("wraps a non-Error thrown value with the fallback message", async () => {
      const persistence: any = Object.create(Repository.prototype);
      persistence.custom = jest.fn().mockRejectedValue("plain failure");
      const controller = fakeController(persistence);

      const handler = createRouteHandler("custom");
      await expect(
        handler.call(controller, pathParams, queryParams)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Custom query "custom" failed'),
      });
    });
  });

  describe("defineRouteMethod", () => {
    it("installs a non-enumerable, non-writable handler on the prototype", () => {
      class Controller {
        marker = true;
      }
      const handler = () => "value";

      const descriptor = defineRouteMethod(
        Controller as any,
        "customRoute",
        handler
      );

      expect(descriptor).toBeDefined();
      expect(descriptor?.enumerable).toBe(false);
      expect(descriptor?.writable).toBe(false);
      expect((Controller.prototype as any).customRoute).toBe(handler);
      expect(descriptor?.value).toBe(handler);
    });

    it("falls back to the constructor itself when there is no prototype", () => {
      const fn = (() => undefined) as unknown as new () => any;
      const handler = () => "arrow";

      const descriptor = defineRouteMethod(fn, "customRoute", handler);

      expect(descriptor).toBeDefined();
      expect(descriptor?.value).toBe(handler);
      expect((fn as any).customRoute).toBe(handler);
    });
  });

  it("creates a scoped logger through routeLogger", () => {
    const logger = routeLogger("custom-scope");
    expect(logger).toBeDefined();
    expect(typeof (logger as any).info).toBe("function");
  });
});

describe("decaf-model/utils error normalization via createRouteHandler", () => {
  it("keeps the decaf BaseError contract for non-decaf failures", async () => {
    const persistence: any = Object.create(Repository.prototype);
    persistence.custom = jest.fn().mockRejectedValue(new Error("boom"));
    const controller: any = {
      log: { for: () => ({ debug: jest.fn(), error: jest.fn() }) },
      ctx: {},
      persistence: () => persistence,
    };

    const handler = createRouteHandler("custom");
    await expect(
      handler.call(controller, { valuesInOrder: [] }, {
        direction: undefined,
        limit: undefined,
        offset: undefined,
      })
    ).rejects.toBeInstanceOf(BaseError);
  });
});
