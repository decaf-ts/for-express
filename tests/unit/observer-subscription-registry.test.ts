import { ObserverSubscriptionRegistry } from "../../src/events-module/ObserverSubscriptionRegistry";

describe("ObserverSubscriptionRegistry", () => {
  let registry: ObserverSubscriptionRegistry;

  beforeEach(() => {
    registry = new ObserverSubscriptionRegistry();
  });

  describe("upsert", () => {
    it("stores topics and echoes them back, keyed by fingerprint", () => {
      const record = registry.upsert("user:alice", ["ProcessStep.*"]);
      expect(record.fingerprint).toBe("user:alice");
      expect(record.topics).toEqual(["ProcessStep.*"]);
      expect(registry.topicsFor("user:alice")).toEqual(["ProcessStep.*"]);
      expect(registry.get("user:alice")).toBe(record);
    });

    it("deduplicates, drops empty topics and keeps the catch-all", () => {
      registry.upsert("user:alice", [" ProcessStep.* ", "", "  ", "ProcessStep.*", "*"]);
      expect(registry.topicsFor("user:alice")).toEqual(["ProcessStep.*", "*"]);
    });

    it("replaces the topics of an existing fingerprint", () => {
      registry.upsert("user:alice", ["ProcessStep.*"]);
      registry.upsert("user:alice", ["Fake.*"]);
      expect(registry.topicsFor("user:alice")).toEqual(["Fake.*"]);
    });
  });

  describe("matches", () => {
    it("is false for an unknown fingerprint or no topics", () => {
      expect(registry.matches("unknown", "ProcessStep.create")).toBe(false);
      registry.upsert("user:alice", []);
      expect(registry.matches("user:alice", "ProcessStep.create")).toBe(false);
    });

    it("is keyed by fingerprint: same topics stay isolated", () => {
      registry.upsert("user:alice", ["ProcessStep.*"]);
      registry.upsert("user:bob", ["Fake.*"]);
      expect(registry.matches("user:alice", "ProcessStep.create")).toBe(true);
      expect(registry.matches("user:alice", "Fake.create")).toBe(false);
      expect(registry.matches("user:bob", "Fake.create")).toBe(true);
      expect(registry.matches("user:bob", "ProcessStep.create")).toBe(false);
    });

    it("supports <model>.<action>.<id> and the catch-all", () => {
      registry.upsert("user:alice", ["ProcessStep.create.7"]);
      expect(registry.matches("user:alice", "ProcessStep.create.7")).toBe(true);
      expect(registry.matches("user:alice", "ProcessStep.create.8")).toBe(false);

      registry.upsert("user:alice", ["*"]);
      expect(registry.matches("user:alice", "Anything.at.all")).toBe(true);
    });
  });

  describe("remove", () => {
    it("drops the record and its topics", () => {
      registry.upsert("user:alice", ["ProcessStep.*"]);
      expect(registry.remove("user:alice")).toBe(true);
      expect(registry.get("user:alice")).toBeUndefined();
      expect(registry.topicsFor("user:alice")).toEqual([]);
      expect(registry.remove("user:alice")).toBe(false);
    });
  });

  describe("connection claims", () => {
    it("lets a newer claim take over and evict the previous stream", () => {
      const evicted: string[] = [];
      const first = registry.claimConnection("user:alice", () => evicted.push("first"));
      const second = registry.claimConnection("user:alice", () => evicted.push("second"));
      expect(evicted).toEqual(["first"]);
      expect(first!.isCurrent()).toBe(false);
      expect(second!.isCurrent()).toBe(true);
      expect(registry.hasConnection("user:alice")).toBe(true);
    });

    it("only lets the current claim release the fingerprint", () => {
      const first = registry.claimConnection("user:alice");
      const second = registry.claimConnection("user:alice");
      expect(first!.release()).toBe(false);
      expect(registry.hasConnection("user:alice")).toBe(true);
      expect(second!.release()).toBe(true);
      expect(registry.hasConnection("user:alice")).toBe(false);
    });

    it("refuses an empty fingerprint", () => {
      expect(registry.claimConnection("")).toBeUndefined();
    });
  });

  describe("idle-record pruning", () => {
    it("prunes records idle for more than 10 minutes, keeping connected ones", () => {
      jest.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });
      try {
        registry.upsert("user:alice", ["ProcessStep.*"]);
        registry.upsert("user:bob", ["Fake.*"]);
        registry.claimConnection("user:bob");

        jest.setSystemTime(new Date("2026-01-01T00:11:00Z"));
        // A fresh upsert triggers pruning of the stale, unconnected record.
        registry.upsert("user:carol", ["ProcessStep.*"]);

        expect(registry.get("user:alice")).toBeUndefined();
        expect(registry.get("user:bob")).toBeDefined();
        expect(registry.get("user:carol")).toBeDefined();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
