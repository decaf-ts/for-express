import {
  BadRequestError,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "@decaf-ts/db-decorators";
import { AuthorizationError, ForbiddenError } from "@decaf-ts/core";
import { Logging } from "@decaf-ts/logging";
import { DecafErrorFilter } from "../../src/factory/exceptions/DecafErrorFilter";

type Logger = {
  error: jest.Mock;
  action: jest.Mock;
};

function responseMock() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
    headersSent: false,
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

function requestMock(options: {
  logger?: Logger;
  operation?: string;
  decafContext?: boolean;
} = {}) {
  const request: any = { method: "GET", url: "/product/123" };
  if (options.decafContext !== false) {
    request.decafContext = {
      logger: options.logger,
      getOrUndefined: (key: string) =>
        key === "operation" ? options.operation : undefined,
    };
  }
  return request;
}

async function run(
  exception: any,
  request: any = requestMock(),
  filter: DecafErrorFilter = new DecafErrorFilter()
) {
  const res = responseMock();
  await filter.handler(exception, request, res as any, jest.fn());
  return res;
}

describe("DecafErrorFilter", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("logging", () => {
    it("logs through the request-bound context logger, not Logging.get()", async () => {
      const contextLogger: Logger = { error: jest.fn(), action: jest.fn() };
      const globalLogger: Logger = { error: jest.fn(), action: jest.fn() };
      jest.spyOn(Logging, "get").mockReturnValue(globalLogger as any);

      const res = await run(
        new NotFoundError("missing"),
        requestMock({ logger: contextLogger })
      );

      expect(contextLogger.error).toHaveBeenCalledTimes(1);
      expect(contextLogger.error.mock.calls[0][0]).toContain("GET /product/123");
      expect(globalLogger.error).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it("falls back to Logging.get() when no request context exists", async () => {
      const globalLogger: Logger = { error: jest.fn(), action: jest.fn() };
      jest.spyOn(Logging, "get").mockReturnValue(globalLogger as any);

      await run(new InternalError("boom"), requestMock({ decafContext: false }));

      expect(globalLogger.error).toHaveBeenCalledTimes(1);
    });

    it("never throws and still sends a response when logging is broken", async () => {
      const brokenLogger: Logger = {
        error: jest.fn(() => {
          throw new Error("logger down");
        }),
        action: jest.fn(),
      };
      const globalLogger: Logger = {
        error: jest.fn(() => {
          throw new Error("global logger down");
        }),
        action: jest.fn(),
      };
      jest.spyOn(Logging, "get").mockReturnValue(globalLogger as any);

      const res = await run(
        new InternalError("boom"),
        requestMock({ logger: brokenLogger })
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("status mapping", () => {
    it.each([
      [401, AuthorizationError, 401],
      [403, ForbiddenError, 403],
      [400, BadRequestError, 400],
      [409, ConflictError, 409],
      [422, ValidationError, 422],
      [429, Error, 429],
    ])(
      "maps a non-decaf error with status %i to code %i",
      async (status, ErrorType, expected) => {
        const exception = Object.assign(new Error("http error"), { status });
        const res = await run(exception, requestMock({ decafContext: false }));
        expect(res.status).toHaveBeenCalledWith(expected);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ status: expected })
        );
      }
    );

    it("preserves the real status of a recognized but unmapped numeric status", async () => {
      const exception = Object.assign(new Error("teapot"), { status: 418 });
      const res = await run(exception, requestMock({ decafContext: false }));
      expect(res.status).toHaveBeenCalledWith(418);
    });

    it("passes through the code of a decaf BaseError", async () => {
      const res = await run(
        new ConflictError("duplicate"),
        requestMock({ decafContext: false })
      );
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("falls back to 500 for a truly unknown error", async () => {
      const res = await run(new TypeError("bad"), requestMock({ decafContext: false }));
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("does not send a response when headers were already sent", async () => {
      const res = responseMock();
      res.headersSent = true;
      await new DecafErrorFilter().handler(
        new InternalError("late"),
        requestMock(),
        res as any,
        jest.fn()
      );
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("auth action logging", () => {
    it("action-logs an AuthorizationError with the operation from the context", async () => {
      const contextLogger: Logger = { error: jest.fn(), action: jest.fn() };
      await run(
        new AuthorizationError("forbidden"),
        requestMock({ logger: contextLogger, operation: "GET /product/123" })
      );
      expect(contextLogger.action).toHaveBeenCalledWith(
        expect.anything(),
        401,
        expect.objectContaining({ operation: "GET /product/123" })
      );
    });

    it("falls back to '<method> <url>' when no operation is in the context", async () => {
      const contextLogger: Logger = { error: jest.fn(), action: jest.fn() };
      await run(
        new AuthorizationError("forbidden"),
        requestMock({ logger: contextLogger })
      );
      expect(contextLogger.action).toHaveBeenCalledWith(
        expect.anything(),
        401,
        expect.objectContaining({ operation: "GET /product/123" })
      );
    });

    it("does not action-log non-authorization errors", async () => {
      const contextLogger: Logger = { error: jest.fn(), action: jest.fn() };
      await run(
        new ConflictError("nope"),
        requestMock({ logger: contextLogger })
      );
      expect(contextLogger.action).not.toHaveBeenCalled();
    });
  });
});
