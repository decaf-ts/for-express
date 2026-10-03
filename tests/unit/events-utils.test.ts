import {
  eventTopicFor,
  fingerprintLabel,
  fingerprintOf,
  fingerprintOfUser,
  nameOf,
  normalizeEventResponse,
  resolveRequesterFingerprint,
  sanitizeTopics,
} from "../../src/events-module/utils";

describe("events-module utils", () => {
  describe("nameOf", () => {
    it("returns the string as-is", () => {
      expect(nameOf("Fake")).toBe("Fake");
    });

    it("returns the constructor name", () => {
      class MyModel {}
      expect(nameOf(MyModel)).toBe("MyModel");
    });

    it("returns the instance constructor name", () => {
      class MyModel {}
      expect(nameOf(new MyModel())).toBe("MyModel");
    });

    it("returns an empty string for undefined", () => {
      expect(nameOf(undefined)).toBe("");
    });
  });

  describe("eventTopicFor", () => {
    it("builds <model>.<action>.<id> for a scalar id", () => {
      class ProcessStep {}
      expect(eventTopicFor(ProcessStep, "create", 7)).toBe("ProcessStep.create.7");
    });

    it("omits the id when none is supplied", () => {
      class ProcessStep {}
      expect(eventTopicFor(ProcessStep, "create")).toBe("ProcessStep.create");
    });

    it("derives the model name from a constructor", () => {
      class ProcessStep {}
      expect(eventTopicFor(ProcessStep, "update", 1)).toBe(
        "ProcessStep.update.1"
      );
    });

    it("omits an array id and returns empty for an unknown model", () => {
      class ProcessStep {}
      expect(eventTopicFor(ProcessStep, "delete", [1, 2])).toBe(
        "ProcessStep.delete"
      );
      expect(eventTopicFor(undefined, "create", 1)).toBe("");
    });
  });

  describe("normalizeEventResponse", () => {
    it("unpacks the observer args and serializes the payload", () => {
      class ProcessStep {}
      const payload = [{ serialize: () => ({ id: 1 }) }, { serialize: () => ({ id: 2 }) }];
      expect(normalizeEventResponse([ProcessStep, "create", "1", payload])).toEqual([
        "ProcessStep",
        "create",
        "1",
        [{ id: 1 }, { id: 2 }],
      ]);
    });

    it("stringifies payload items without a serialize method", () => {
      class ProcessStep {}
      expect(normalizeEventResponse([ProcessStep, "create", "1", ["raw"]])).toEqual([
        "ProcessStep",
        "create",
        "1",
        ["raw"],
      ]);
    });

    it("handles a single payload object", () => {
      class ProcessStep {}
      expect(
        normalizeEventResponse([ProcessStep, "create", "1", { serialize: () => ({ id: 1 }) }])
      ).toEqual(["ProcessStep", "create", "1", { id: 1 }]);
    });
  });

  describe("fingerprints", () => {
    it("fingerprintOf encodes the kind and parts", () => {
      expect(fingerprintOf("user", "alice", "tab")).toBe("user:alice:tab");
    });

    it("fingerprintOfUser resolves string and object identities", () => {
      expect(fingerprintOfUser("alice")).toBe("alice");
      expect(fingerprintOfUser({ id: "bob" })).toBe("bob");
      expect(fingerprintOfUser({ uuid: "carol" })).toBe("carol");
      expect(fingerprintOfUser({})).toBeUndefined();
      expect(fingerprintOfUser(undefined)).toBeUndefined();
    });

    it("fingerprintLabel truncates long fingerprints", () => {
      expect(fingerprintLabel("")).toBe("<none>");
      expect(fingerprintLabel("short")).toBe("short");
      expect(fingerprintLabel("1234567890")).toBe("12345678...");
    });
  });

  describe("sanitizeTopics", () => {
    it("trims, dedupes, drops empty and keeps the catch-all", () => {
      expect(sanitizeTopics([" ProcessStep.* ", "", "  ", "ProcessStep.*", "*"])).toEqual([
        "ProcessStep.*",
        "*",
      ]);
    });

    it("drops overly long or overly deep topics", () => {
      const long = "x".repeat(600);
      const deep = Array.from({ length: 10 }, () => "a").join(".");
      expect(sanitizeTopics([long, deep, "ok"])).toEqual(["ok"]);
    });
  });

  describe("resolveRequesterFingerprint", () => {
    const ctx = (user?: unknown, cid?: string) => ({
      getOrUndefined: (key: string) => (key === "user" ? user : undefined),
      headers: cid ? { "x-correlation-id": cid } : {},
    });

    it("scopes a user with a correlation id per client", () => {
      const a = resolveRequesterFingerprint(ctx("alice", "tabA"), "conn-1");
      const b = resolveRequesterFingerprint(ctx("alice", "tabB"), "conn-2");
      expect(a.kind).toBe("userClient");
      expect(a.value).toBe("user:alice:tabA");
      expect(b.value).toBe("user:alice:tabB");
      expect(a.value).not.toBe(b.value);
    });

    it("falls back to the user alone", () => {
      const fp = resolveRequesterFingerprint(ctx("alice"), "conn-1");
      expect(fp).toEqual({ value: "user:alice", kind: "user" });
    });

    it("falls back to the correlation id", () => {
      const fp = resolveRequesterFingerprint(ctx(undefined, "tabA"), "conn-1");
      expect(fp).toEqual({ value: "cid:tabA", kind: "correlationId" });
    });

    it("falls back to the connection id", () => {
      const fp = resolveRequesterFingerprint(ctx(), "conn-1");
      expect(fp).toEqual({ value: "conn:conn-1", kind: "connection" });
    });
  });
});
