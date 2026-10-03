import { Repository } from "@decaf-ts/core";
import { Model } from "@decaf-ts/decorator-validation";
import { InternalError } from "@decaf-ts/db-decorators";

import { repoForModel } from "../../src/utils";

describe("repoForModel", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the repository registered for a known model", () => {
    const modelCtor = class FakeModel {};
    const repository = { flavour: "ram" };
    jest.spyOn(Model, "get").mockReturnValue(modelCtor as any);
    jest.spyOn(Repository, "forModel").mockReturnValue(repository as any);

    expect(repoForModel("FakeModel")).toBe(repository);
    expect(Model.get).toHaveBeenCalledWith("FakeModel");
    expect(Repository.forModel).toHaveBeenCalledWith(modelCtor);
  });

  it("throws an InternalError when the model is not registered", () => {
    jest.spyOn(Model, "get").mockReturnValue(undefined as any);
    expect(() => repoForModel("Missing")).toThrow(InternalError);
    expect(() => repoForModel("Missing")).toThrow(
      "Failed to find repository for Missing"
    );
  });
});
