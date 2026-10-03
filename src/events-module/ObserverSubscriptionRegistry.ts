/**
 * @module for-express/events-module/ObserverSubscriptionRegistry
 * @summary In-memory registry of observer topic subscriptions and live SSE connections.
 * @description Tracks which topics each requester (identified by its
 * fingerprint) subscribed to and which of those requesters currently hold an
 * open SSE connection, so {@link EventsRouter} can filter observer refreshes
 * per subscriber and evict superseded streams. Express has no DI container,
 * so the bootstrap factory instantiates this registry once and hands it to the
 * SSE router.
 */

import { matchesTopic } from "@decaf-ts/for-http/hooks/utils";

import { sanitizeTopics } from "./utils";

/**
 * @typedef {Object} ObserverSubscriptionRecord
 * @description A requester's topic subscription entry held by the {@link ObserverSubscriptionRegistry}.
 * @property {string} fingerprint - Requester fingerprint (`user:<user>:<x-correlation-id>`, `user:<user>`, `cid:<correlation-id>` or `conn:<uuid>`).
 * @property {string[]} topics - Sanitized topic patterns the requester subscribed to.
 * @property {Date} updatedAt - Last time the record was created or updated (used for TTL pruning).
 * @category Events
 */
export type ObserverSubscriptionRecord = {
  fingerprint: string;
  topics: string[];
  updatedAt: Date;
};

/**
 * @typedef {Object} ConnectionClaim
 * @description Handle for the currently active SSE connection of a fingerprint.
 * @property {string} fingerprint - Fingerprint owning the connection slot.
 * @property {function(): boolean} isCurrent - Whether this claim is still the active connection for the fingerprint.
 * @property {function(): boolean} release - Releases the connection slot; returns `true` only if this claim was still current.
 * @category Events
 */
export type ConnectionClaim = {
  readonly fingerprint: string;
  isCurrent(): boolean;
  release(): boolean;
};

type ActiveConnection = {
  claim: ConnectionClaim;
  evict?: () => void;
};

/**
 * Time-to-live (in milliseconds) for subscription records that do not hold an
 * open connection; pruned lazily on every {@link ObserverSubscriptionRegistry.upsert}.
 * @const UNCONNECTED_RECORD_TTL_MS
 * @category Events
 */
const UNCONNECTED_RECORD_TTL_MS = 10 * 60 * 1000;

/**
 * @class ObserverSubscriptionRegistry
 * @description Graph-agnostic registry for observer topic subscriptions.
 * @summary Keeps two maps keyed by requester fingerprint: one of
 * {@link ObserverSubscriptionRecord} topic subscriptions and one of live SSE
 * connection claims. Express has no DI container, so the registry is a plain
 * class the bootstrap factory instantiates once and hands to the SSE router.
 * Topic matching delegates to the shared `matchesTopic` helper from
 * `@decaf-ts/for-http` (supports `*` wildcards; `*.*` matches any topic and a
 * bare model name matches all its events). Claiming a connection supersedes
 * the previous connection of the same fingerprint by invoking its eviction
 * callback, and subscription records without an open connection are pruned
 * after {@link UNCONNECTED_RECORD_TTL_MS}.
 * @category Events
 */
export class ObserverSubscriptionRegistry {
  private readonly records = new Map<string, ObserverSubscriptionRecord>();

  private readonly connections = new Map<string, ActiveConnection>();

  /**
   * Creates or replaces the subscription record for a fingerprint with the
   * sanitized topic list, lazily pruning expired unconnected records first.
   * @param {string} fingerprint - Requester fingerprint.
   * @param {string[]} [topics] - Topic patterns to subscribe to; sanitized with {@link sanitizeTopics}.
   * @return {ObserverSubscriptionRecord} The stored record.
   */
  upsert(
    fingerprint: string,
    topics: string[] = []
  ): ObserverSubscriptionRecord {
    this.pruneUnconnected();
    const record: ObserverSubscriptionRecord = {
      fingerprint,
      topics: sanitizeTopics(topics),
      updatedAt: new Date(),
    };
    this.records.set(fingerprint, record);
    return record;
  }

  /**
   * Removes the subscription record for a fingerprint.
   * @param {string} fingerprint - Requester fingerprint.
   * @return {boolean} Whether a record existed and was removed.
   */
  remove(fingerprint: string): boolean {
    return this.records.delete(fingerprint);
  }

  /**
   * Returns the subscription record for a fingerprint, if any.
   * @param {string} fingerprint - Requester fingerprint.
   * @return {ObserverSubscriptionRecord | undefined} The stored record or `undefined` when unknown.
   */
  get(fingerprint: string): ObserverSubscriptionRecord | undefined {
    return this.records.get(fingerprint);
  }

  /**
   * Returns the sanitized topic patterns subscribed by a fingerprint.
   * @param {string} fingerprint - Requester fingerprint.
   * @return {string[]} The subscribed topics, or an empty array when unknown.
   */
  topicsFor(fingerprint: string): string[] {
    return this.records.get(fingerprint)?.topics ?? [];
  }

  /**
   * Checks whether any of the fingerprint's subscribed topic patterns matches
   * the given event topic (via `matchesTopic` from `@decaf-ts/for-http`).
   * @param {string} fingerprint - Requester fingerprint.
   * @param {string} eventTopic - Event topic to test, e.g. `User.create.<id>`.
   * @return {boolean} Whether the fingerprint subscribed to that topic; `false` when the record is unknown or has no topics.
   */
  matches(fingerprint: string, eventTopic: string): boolean {
    const record = this.records.get(fingerprint);
    if (!record || !record.topics.length) return false;
    return record.topics.some((pattern) => matchesTopic(eventTopic, pattern));
  }

  /**
   * Claims the single connection slot for a fingerprint, superseding any
   * previous connection by invoking its `evict` callback (the old stream is
   * expected to clean up and end).
   * @param {string} fingerprint - Requester fingerprint.
   * @param {function(): void} [evict] - Callback invoked on the superseded connection's claim.
   * @return {ConnectionClaim | undefined} The new claim, or `undefined` when the fingerprint is empty.
   */
  claimConnection(
    fingerprint: string,
    evict?: () => void
  ): ConnectionClaim | undefined {
    if (!fingerprint) return undefined;
    const claim: ConnectionClaim = {
      fingerprint,
      isCurrent: () => this.connections.get(fingerprint)?.claim === claim,
      release: () => {
        if (!claim.isCurrent()) return false;
        this.connections.delete(fingerprint);
        return true;
      },
    };
    const previous = this.connections.get(fingerprint);
    this.connections.set(fingerprint, { claim, evict });
    previous?.evict?.();
    return claim;
  }

  /**
   * Checks whether a fingerprint currently holds an open connection slot.
   * @param {string} fingerprint - Requester fingerprint.
   * @return {boolean} Whether a live connection claim exists for the fingerprint.
   */
  hasConnection(fingerprint: string): boolean {
    return this.connections.has(fingerprint);
  }

  /**
   * Drops the connection slot for a fingerprint without invoking its eviction
   * callback (used when the stream ends and releases itself).
   * @param {string} fingerprint - Requester fingerprint.
   * @return {void}
   */
  releaseConnection(fingerprint: string): void {
    this.connections.delete(fingerprint);
  }

  /**
   * Deletes subscription records that have no open connection and were last
   * updated more than {@link UNCONNECTED_RECORD_TTL_MS} ago.
   * @private
   * @param {number} [now=Date.now()] - Current timestamp (injected for testability).
   * @return {void}
   */
  private pruneUnconnected(now = Date.now()): void {
    for (const [fingerprint, record] of this.records) {
      if (this.connections.has(fingerprint)) continue;
      if (now - record.updatedAt.getTime() > UNCONNECTED_RECORD_TTL_MS)
        this.records.delete(fingerprint);
    }
  }
}
