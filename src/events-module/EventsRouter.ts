/**
 * @module for-express/events-module/EventsRouter
 * @summary Express SSE router exposing Decaf observer events over Server-Sent Events.
 * @description Provides the HTTP entry point for Decaf's observer events in an
 * Express application: it attaches an {@link Observer} to every listening
 * adapter and streams model refreshes to connected clients as SSE, either in
 * broadcast mode or (when enabled) filtered per subscriber through the
 * {@link ObserverSubscriptionRegistry}. It is the Express counterpart of the
 * Nest `EventsController` from `@decaf-ts/for-nest`, built directly on
 * Express routing primitives instead of a DI container.
 */

import { Router, type Request, type RequestHandler, type Response } from "express";
import { Adapter, Observer, ObserverFilter, UUID } from "@decaf-ts/core";
import type { Constructor } from "@decaf-ts/decoration";
import { Logging } from "@decaf-ts/logging";

import { DecafRequestContext } from "../request/DecafRequestContext";
import type { ObserverEventsOptions } from "../types";
import {
  eventTopicFor,
  fingerprintLabel,
  normalizeEventResponse,
  resolveRequesterFingerprint,
} from "./utils";
import { ObserverSubscriptionRegistry } from "./ObserverSubscriptionRegistry";

/**
 * Interval (in milliseconds) between SSE `heartbeat` events written on the
 * broadcast stream to keep intermediaries from closing idle connections.
 * @const HEARTBEAT_INTERVAL_MS
 * @category Events
 */
const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * @typedef {Object} EventsRouterOptions
 * @description Options accepted by {@link EventsRouter}.
 * @property {string[]} flavours - Adapter flavours to observe events on.
 * @property {ObserverEventsOptions} [options] - Observer events configuration.
 * @property {ObserverSubscriptionRegistry} registry - Shared topic-subscription registry.
 * @property {function(Request, Response): DecafRequestContext} contextFor - Resolves (or creates) the request context for an SSE connection.
 * @property {RequestHandler} [authMiddleware] - Optional auth middleware applied when `options.authenticate` is set.
 * @category Events
 */
export type EventsRouterOptions = {
  /** Adapter flavours to observe events on. */
  flavours: string[];
  /** Observer events configuration. */
  options?: ObserverEventsOptions;
  /** Shared topic-subscription registry. */
  registry: ObserverSubscriptionRegistry;
  /** Resolves (or creates) the request context for an SSE connection. */
  contextFor: (req: Request, res: Response) => DecafRequestContext;
  /** Optional auth middleware applied when `options.authenticate` is set. */
  authMiddleware?: RequestHandler;
};

/**
 * @class EventsRouter
 * @description Express SSE router exposing Decaf observer events.
 * @summary This is the Express equivalent of the Nest `EventsController`: the
 * constructor wires `GET /` (broadcast stream with `heartbeat` events every
 * {@link HEARTBEAT_INTERVAL_MS}), `GET /:model` (raw refreshes scoped to one
 * model) and, when `options.subscriptionMode` is set, `POST /subscribe` and
 * `POST /unsubscribe`. A request context is resolved per connection through
 * `config.contextFor` and cached on the request, from which the requester
 * fingerprint is derived with {@link resolveRequesterFingerprint}. The router
 * registers an {@link Observer} on every listening adapter and writes each
 * refresh to the response as a Server-Sent Event. In subscription mode a
 * per-connection {@link ObserverFilter} drops refreshes whose
 * {@link eventTopicFor topic} does not match the requester's topics held in the
 * {@link ObserverSubscriptionRegistry}; a stream superseded by a newer stream
 * of the same fingerprint is evicted, and when the client disconnects the
 * observer is detached and (in subscription mode) its registry record is
 * removed. When `options.authenticate` is set, the configured
 * `authMiddleware` guards the stream and subscribe endpoints, and a rejected
 * request gets the auth handler's HTTP error (e.g. 401).
 * @category Events
 *
 * @example
 * ```ts
 * // Broadcast stream (includes periodic `heartbeat` events):
 * const es = new EventSource("https://host/events");
 * es.onmessage = (ev) => console.log(JSON.parse(ev.data));
 *
 * // Subscription mode: register the client's topics first, then stream with
 * // the same user/correlation identity so the router derives the matching
 * // fingerprint and filters the stream accordingly:
 * await fetch("https://host/events/subscribe", {
 *   method: "POST",
 *   credentials: "include",
 *   headers: { "content-type": "application/json" },
 *   body: JSON.stringify({ topics: ["User", "Post.update.*"] }),
 * });
 * const es2 = new EventSource("https://host/events", { withCredentials: true });
 * ```
 */
export class EventsRouter {
  readonly router: Router;

  /**
   * Builds the Express {@link Router} for observer events, registering the SSE
   * stream endpoints plus the subscribe/unsubscribe endpoints when
   * subscription mode is enabled.
   * @param {EventsRouterOptions} config - Router configuration: flavours, observer options, the shared registry, the context resolver and optional auth middleware.
   * @return {void}
   */
  constructor(protected readonly config: EventsRouterOptions) {
    this.router = Router();
    const { options = {}, authMiddleware } = config;
    const guards: RequestHandler[] =
      options.authenticate && authMiddleware ? [authMiddleware] : [];

    this.router.get("/", ...guards, (req, res) =>
      this.stream(req, res, { heartbeat: true })
    );
    this.router.get("/:model", ...guards, (req, res) =>
      this.stream(req, res, { scope: String(req.params.model), raw: true })
    );

    if (options.subscriptionMode) {
      this.router.post("/subscribe", ...guards, (req, res) =>
        this.subscribe(req, res)
      );
      this.router.post("/unsubscribe", ...guards, (req, res) =>
        this.unsubscribe(req, res)
      );
    }
  }

  /**
   * Returns the request context for an SSE connection, creating it through
   * `config.contextFor` and caching it on the request (`decafContext`) so
   * subsequent lookups for the same request reuse the same context.
   * @private
   * @param {Request} req - The incoming HTTP request.
   * @param {Response} res - The outgoing response.
   * @return {DecafRequestContext} The request context for this connection.
   */
  private contextFor(req: Request, res: Response): DecafRequestContext {
    return (
      (req as any).decafContext ??
      ((req as any).decafContext = this.config.contextFor(req, res))
    );
  }

  /**
   * Derives the requester fingerprint from the request context (authenticated
   * user identity and `x-correlation-id` header), falling back to a
   * random-UUID-bound connection fingerprint when neither is present. See
   * {@link resolveRequesterFingerprint}.
   * @private
   * @param {DecafRequestContext} context - The request context for the connection.
   * @return {string} The requester fingerprint.
   */
  private resolveFingerprint(context: DecafRequestContext): string {
    const { value } = resolveRequesterFingerprint(
      {
        getOrUndefined: (key: string) =>
          context.getOrUndefined(key as any),
        headers: context.headers,
      },
      `${UUID.instance.generate()}`
    );
    return value;
  }

  /**
   * Handles `POST /subscribe`: records (or replaces) the requester's topics in
   * the {@link ObserverSubscriptionRegistry} under its fingerprint.
   * @private
   * @param {Request} req - The incoming request; its body should carry a `topics` string array (anything else is treated as an empty list).
   * @param {Response} res - The outgoing response.
   * @return {void} Responds with the fingerprint label and the sanitized active topics, or `{ enabled: false }` when subscription mode is disabled.
   */
  private subscribe(req: Request, res: Response): void {
    const options = this.config.options ?? {};
    if (!options.subscriptionMode) {
      res.json({ enabled: false });
      return;
    }
    const context = this.contextFor(req, res);
    const topics = Array.isArray((req as any).body?.topics)
      ? (req as any).body.topics
      : [];
    const fingerprint = this.resolveFingerprint(context);
    const record = this.config.registry.upsert(fingerprint, topics);
    res.json({
      fingerprint: fingerprintLabel(record.fingerprint),
      topics: this.config.registry.topicsFor(record.fingerprint),
    });
  }

  /**
   * Handles `POST /unsubscribe`: removes the requester's subscription record
   * from the {@link ObserverSubscriptionRegistry}.
   * @private
   * @param {Request} req - The incoming request.
   * @param {Response} res - The outgoing response.
   * @return {void} Responds with whether a record was removed and the fingerprint label, or `{ enabled: false }` when subscription mode is disabled.
   */
  private unsubscribe(req: Request, res: Response): void {
    const options = this.config.options ?? {};
    if (!options.subscriptionMode) {
      res.json({ enabled: false });
      return;
    }
    const context = this.contextFor(req, res);
    const fingerprint = this.resolveFingerprint(context);
    res.json({
      unsubscribed: this.config.registry.remove(fingerprint),
      fingerprint: fingerprintLabel(fingerprint),
    });
  }

  /**
   * Writes the SSE stream for a connection: sets the `text/event-stream`
   * headers, registers a fresh {@link Observer} on every listening adapter,
   * filters refreshes in subscription mode via the
   * {@link ObserverSubscriptionRegistry}, emits periodic `heartbeat` events
   * when enabled, and cleans up on disconnect (detaching the observers,
   * stopping the heartbeat timer and releasing the connection claim so the
   * registry record expires).
   * @private
   * @param {Request} req - The incoming HTTP request.
   * @param {Response} res - The outgoing response.
   * @param {{scope: string, raw: boolean, heartbeat: boolean}} [streamOptions] - `scope` restricts topics to one model (and its sub-topics), `raw` writes the refresh arguments unnormalized, `heartbeat` enables periodic `heartbeat` events.
   * @return {void}
   */
  private stream(
    req: Request,
    res: Response,
    streamOptions: { scope?: string; raw?: boolean; heartbeat?: boolean } = {}
  ): void {
    const { scope, raw, heartbeat } = streamOptions;
    const options = this.config.options ?? {};
    const logger = Logging.for(EventsRouter.name);
    const subscriptionMode = Boolean(options.subscriptionMode);
    const context = this.contextFor(req, res);
    const fingerprint = this.resolveFingerprint(context);

    const adapters: Adapter<any, any, any, any>[] = this.config.flavours.map(
      (flavour) => (Adapter as any).get(flavour)
    );

    const observerId =
      `B-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    (res as any).flushHeaders?.();

    logger.info(
      `Creating SSE observer: ${observerId} for client ${context.uuid} (fingerprint ${fingerprintLabel(fingerprint)})`
    );

    let closed = false;
    const write = (event: { type?: string; data: unknown }) => {
      if (closed || res.writableEnded) return;
      res.write(`event: ${event.type ?? "message"}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    };

    const claim = subscriptionMode
      ? this.config.registry.claimConnection(fingerprint, () => {
          logger.info(
            `SSE observer ${observerId} superseded by a newer stream of the same client (fingerprint ${fingerprintLabel(fingerprint)})`
          );
          cleanup();
          res.end();
        })
      : undefined;

    const observer = new (class implements Observer {
      observerId = observerId;
      refresh(...args: any[]): Promise<void> {
        return Promise.resolve().then(() => {
          if (raw) {
            write({ data: args });
            return;
          }
          write({ type: "message", data: normalizeEventResponse(args) });
        });
      }
    })();

    const registry = this.config.registry;
    const filter: ObserverFilter | undefined = subscriptionMode
      ? ((model: string | Constructor, event: any, id: any) => {
          const topic = eventTopicFor(model, event, id);
          if (!topic) return false;
          if (scope && topic !== scope && !topic.startsWith(`${scope}.`))
            return false;
          return registry.matches(fingerprint, topic);
        }) as unknown as ObserverFilter
      : undefined;

    for (const adapter of adapters) {
      try {
        adapter.observe(observer, filter);
      } catch (e: any) {
        logger.error(e);
      }
    }

    const heartbeatTimer = heartbeat
      ? setInterval(() => {
          write({ type: "heartbeat", data: { ts: new Date().toISOString() } });
        }, HEARTBEAT_INTERVAL_MS)
      : undefined;

    function cleanup() {
      if (closed) return;
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      for (const adapter of adapters) {
        try {
          adapter.unObserve(observer);
        } catch (e: any) {
          logger.error(e);
        }
      }
      if (claim?.release()) registry.remove(fingerprint);
    }

    req.on("close", cleanup);
    res.on("close", cleanup);
  }
}
