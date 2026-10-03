/**
 * @module for-express/events-module
 * @summary Public barrel of the observer events module.
 * @description Aggregates everything the Express observer events module
 * exposes: the dependency-key {@link module:for-express/events-module/constant symbols},
 * the fingerprint/topic helpers of `./utils`, the
 * {@link ObserverSubscriptionRegistry} backing subscription mode, and the
 * {@link EventsRouter} that streams observer events as Server-Sent Events.
 * This is the surface consumed by the package bootstrap to wire SSE endpoints
 * onto the Express application.
 */

export * from "./constant";
export * from "./utils";
export * from "./ObserverSubscriptionRegistry";
export * from "./EventsRouter";
