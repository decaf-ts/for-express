/**
 * @module for-express/events-module/utils
 * @summary Helpers for SSE event normalization, topics and requester fingerprints.
 * @description Pure helpers shared by the observer events module: they turn
 * observer refresh payloads into JSON-friendly SSE responses, build
 * `<model>.<action>.<id>` event topics, resolve and label requester
 * fingerprints (used to scope subscriptions), and sanitize client-supplied
 * topic patterns. Used by {@link EventsRouter} and the
 * {@link ObserverSubscriptionRegistry}.
 */

import type { Constructor } from "@decaf-ts/decoration";
import { Logging } from "@decaf-ts/logging";

/**
 * Normalizes an observer refresh payload for SSE delivery.
 * @function normalizeEventResponse
 * @summary Maps the raw observer `refresh` arguments to
 * `[modelName, operation, id, serializedPayload]`: the model is reduced to its
 * name and each payload item is serialized (via `serialize()` when available,
 * otherwise JSON-stringified, with `undefined` for items that fail), so the
 * result is safe to JSON-stringify into the SSE `data` line. The raw arguments
 * are written untouched on `/:model` streams, where no normalization applies.
 * @param {any[]} args - Raw observer refresh arguments: `[modelConstructor, operation, id, payload]`.
 * @return {unknown[]} The normalized `[modelName, operation, id, serializedPayload]` tuple.
 * @category Events
 */
export function normalizeEventResponse(args: any[]): unknown[] {
  const [modelConstr, operation, id, payload] = args;

  const modelName = modelConstr?.name ?? modelConstr;
  const log = Logging.for(normalizeEventResponse);

  const serializedPayload = Array.isArray(payload)
    ? payload.map((e) => {
        try {
          if (typeof e.serialize === "function") return e.serialize();
          log.verbose(
            `Payload item for ${modelName} has no serialize method (${typeof e}); stringifying it`
          );
          return typeof e === "string" ? e : JSON.stringify(e);
        } catch (err: unknown) {
          log.warn(`Failed to serialize payload for ${modelName}: ${err}`);
          return undefined;
        }
      })
    : payload && typeof payload.serialize === "function"
      ? payload.serialize()
      : typeof payload === "string"
        ? payload
        : JSON.stringify(payload);

  log.silly(
    `Normalized event response for model ${modelName}, operation ${operation}, id ${id}`
  );

  return [modelName, operation, id, serializedPayload];
}

/**
 * Resolves the name of a model.
 * @function nameOf
 * @summary Accepts a model name, a constructor or an instance and returns its
 * name: the string itself, the constructor's `name`, or the object's own
 * `name` property (falling back to its constructor's name). Returns an empty
 * string when no name can be resolved.
 * @param {string | Constructor | object | undefined} model - Model name, constructor or instance.
 * @return {string} The resolved model name, or `""` when it cannot be resolved.
 * @category Events
 */
export function nameOf(model: string | Constructor | object | undefined): string {
  if (typeof model === "string") return model;
  if (typeof model === "function" && model?.name) return model.name;
  if (typeof model === "object" && model) {
    const name = (model as any)?.name ?? (model as any)?.constructor?.name;
    return typeof name === "string" ? name : "";
  }
  return "";
}

/**
 * Builds the `<model>.<action>.<id>` webhook topic for an observed event.
 * @function eventTopicFor
 * @summary Joins the resolved model name, the event/operation name and — when
 * a scalar id is given (array ids are ignored) — the stringified id into a
 * dotted topic used by the subscription-mode filter and topic patterns.
 * @param {string | Constructor | object | undefined} model - Model involved in the event.
 * @param {string} event - Event/operation name (e.g. `create`, `update`).
 * @param {any} [id] - Affected record id, appended when present.
 * @return {string} The dotted topic, or `""` when the model name cannot be resolved.
 * @category Events
 */
export function eventTopicFor(
  model: string | Constructor | object | undefined,
  event: string,
  id?: any
): string {
  const modelName = nameOf(model);
  if (!modelName) return "";
  const segments = [modelName, event];
  if (id !== undefined && id !== null) {
    const scalar = Array.isArray(id) ? undefined : id;
    if (scalar !== undefined) segments.push(String(scalar));
  }
  return segments.filter(Boolean).join(".");
}

/**
 * @typedef {Object} RequesterFingerprint
 * @description The resolved requester identity used to scope SSE subscriptions.
 * @summary Combines the authenticated user and/or the `x-correlation-id`
 * header into a colon-separated fingerprint string: `user:<user>:<x-correlation-id>`
 * (`userClient`), `user:<user>` (`user`), `cid:<correlation-id>` (`correlationId`)
 * or `conn:<uuid>` (`connection`, one-off fallback). Each part is
 * URI-encoded by {@link fingerprintOf}.
 * @property {string} value - The fingerprint string (e.g. `user:42:abc123`).
 * @property {"userClient" | "user" | "correlationId" | "connection"} kind - Which inputs the fingerprint was derived from.
 * @category Events
 */
export type RequesterFingerprint = {
  value: string;
  kind: "userClient" | "user" | "correlationId" | "connection";
};

/**
 * Builds a colon-separated fingerprint from its parts, URI-encoding each part.
 * @function fingerprintOf
 * @param {string} kind - Leading segment identifying the fingerprint kind (`user`, `cid`, `conn`, ...).
 * @param {...string} parts - Remaining fingerprint segments, in order.
 * @return {string} The `kind:<part1>:<part2>...` fingerprint string.
 * @category Events
 */
export function fingerprintOf(kind: string, ...parts: string[]): string {
  return [kind, ...parts.map((part) => encodeURIComponent(part))].join(":");
}

/**
 * Extracts a usable user identity string from an authenticated-user value.
 * @function fingerprintOfUser
 * @summary Accepts the context's `user` value: a non-empty string is returned
 * as-is (trimmed); an object is probed for an `id`, `uuid`, `UUID` or `user`
 * string property. Returns `undefined` for nullish or unusable values.
 * @param {unknown} identity - The authenticated user value from the request context.
 * @return {string | undefined} The user identity string, or `undefined` when none is available.
 * @category Events
 */
export function fingerprintOfUser(identity: unknown): string | undefined {
  if (identity === undefined || identity === null) return undefined;
  if (typeof identity === "string") {
    return identity.trim() ? identity : undefined;
  }
  if (typeof identity === "object") {
    const candidate = identity as Record<string, unknown>;
    const value =
      candidate["id"] ??
      candidate["uuid"] ??
      candidate["UUID"] ??
      candidate["user"];
    if (typeof value === "string" && value.trim()) return value;
    return undefined;
  }
  return undefined;
}

/**
 * Shortens a fingerprint for display in logs and responses.
 * @function fingerprintLabel
 * @summary Returns `<none>` for empty fingerprints, the fingerprint itself
 * when it is at most 8 characters long, and otherwise its first 8 characters
 * followed by `...`.
 * @param {string} fingerprint - The fingerprint to label.
 * @return {string} A short, log-safe label for the fingerprint.
 * @category Events
 */
export function fingerprintLabel(fingerprint: string): string {
  if (!fingerprint) return "<none>";
  return fingerprint.length <= 8
    ? fingerprint
    : `${fingerprint.slice(0, 8)}...`;
}

/**
 * Maximum length (in characters) a client-supplied topic may have before it
 * is rejected by {@link sanitizeTopics}.
 * @const MAX_TOPIC_LENGTH
 * @category Events
 */
const MAX_TOPIC_LENGTH = 512;
/**
 * Maximum number of dot-separated segments a client-supplied topic may have
 * before it is rejected by {@link sanitizeTopics}.
 * @const MAX_TOPIC_SEGMENTS
 * @category Events
 */
const MAX_TOPIC_SEGMENTS = 8;

/**
 * Sanitizes client-supplied topic patterns for storage.
 * @function sanitizeTopics
 * @summary Trims each topic and drops empty entries, topics longer than
 * {@link MAX_TOPIC_LENGTH}, topics with more than {@link MAX_TOPIC_SEGMENTS}
 * dot-separated segments and duplicates, preserving first-seen order.
 * @param {Iterable<string>} topics - Raw topic patterns to sanitize.
 * @return {string[]} The sanitized, de-duplicated topic patterns.
 * @category Events
 */
export function sanitizeTopics(topics: Iterable<string>): string[] {
  const seen = new Set<string>();
  const sanitized: string[] = [];
  for (const raw of topics ?? []) {
    const topic = (raw ?? "").trim();
    if (!topic || topic.length > MAX_TOPIC_LENGTH) continue;
    if (topic.split(".").length > MAX_TOPIC_SEGMENTS) continue;
    if (seen.has(topic)) continue;
    seen.add(topic);
    sanitized.push(topic);
  }
  return sanitized;
}

/**
 * Resolves the requester fingerprint from the request context.
 * @function resolveRequesterFingerprint
 * @summary Prefers the authenticated user (from the context's `user` entry,
 * resolved with {@link fingerprintOfUser}); when present it yields a
 * `userClient` fingerprint (`user:<user>:<x-correlation-id>`) if a
 * `x-correlation-id` header is available, otherwise a plain `user` fingerprint.
 * Without a user, a correlation id yields a `cid:<correlation-id>` fingerprint;
 * with neither, the caller-provided fallback UUID yields a one-off
 * `conn:<uuid>` connection fingerprint.
 * @param {{getOrUndefined: function(string): unknown, headers: Record.<string, (string|string[])>}} context - Request context accessor (`user` entry) and request headers.
 * @param {string} fallback - Fallback value (e.g. a freshly generated UUID) used for the connection fingerprint.
 * @return {RequesterFingerprint} The resolved fingerprint value and kind.
 * @category Events
 */
export function resolveRequesterFingerprint(
  context: {
    getOrUndefined?: (key: string) => unknown;
    headers?: Record<string, string | string[] | undefined> | undefined;
  },
  fallback: string
): RequesterFingerprint {
  const rawHeaders = context.headers ?? {};
  const header =
    rawHeaders["x-correlation-id"] ?? rawHeaders["X-Correlation-ID"];
  const correlationId = (Array.isArray(header) ? header[0] : header)?.trim();

  const authenticated = context.getOrUndefined?.("user");
  const userFingerprint = fingerprintOfUser(authenticated);
  if (userFingerprint) {
    return correlationId
      ? {
          value: fingerprintOf("user", userFingerprint, correlationId),
          kind: "userClient",
        }
      : { value: fingerprintOf("user", userFingerprint), kind: "user" };
  }

  if (correlationId) {
    return { value: fingerprintOf("cid", correlationId), kind: "correlationId" };
  }

  return { value: fingerprintOf("conn", fallback), kind: "connection" };
}
