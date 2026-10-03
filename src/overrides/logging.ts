/**
 * @module for-express/overrides/logging
 * @summary Side-effect import activating the shared server logging setup.
 * @description Contains no declarations of its own: importing `@decaf-ts/for-http/server`
 * pulls in that package's server logging module, which registers the shared log parameter
 * renderers (`ip`, `sessionId`, `sessionType`) in the logging parameter registry and wires
 * the server-side logging behaviour reused by the Express handlers.
 *
 * The import runs because this module is loaded by `for-express/overrides/index` — and
 * therefore by `for-express/index` — so simply importing the package activates these logging
 * hooks. Kept as a separate file so the logging activation stays isolated from the
 * prototype patches in `for-express/overrides/overrides`.
 */
import "@decaf-ts/for-http/server";
