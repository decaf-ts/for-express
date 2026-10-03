/**
 * @module for-express/events-module/constant
 * @summary Symbol keys identifying the observer-events module dependencies.
 * @description Declares the symbols used as provider keys/identifiers for the
 * observer events wiring — the listening adapter flavours and the
 * {@link ObserverEventsOptions} configuration. They mirror the DI tokens of
 * the Nest `@decaf-ts/for-nest` stream module; on Express, where there is no
 * DI container, the bootstrap factory resolves these values directly and hands
 * them to {@link EventsRouter}.
 */

/**
 * Symbol key identifying the list of adapter flavours with a listening
 * {@link Observer} whose events the SSE endpoints stream.
 * @const LISTENING_ADAPTERS_FLAVOURS
 * @category Events
 */
export const LISTENING_ADAPTERS_FLAVOURS = Symbol(
  "LISTENING_ADAPTERS_FLAVOURS"
);

/**
 * Symbol key identifying the {@link ObserverEventsOptions} configuration of
 * the observer events module (subscription mode, authentication, endpoint
 * path, ...).
 * @const OBSERVER_EVENTS_OPTIONS
 * @category Events
 */
export const OBSERVER_EVENTS_OPTIONS = Symbol("OBSERVER_EVENTS_OPTIONS");
