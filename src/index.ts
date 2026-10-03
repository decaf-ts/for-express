/**
 * @module for-express
 * @summary Express integration for decaf-ts, mirroring `@decaf-ts/for-nest` on top of `@decaf-ts/for-http/server`.
 * @description Express integration for decaf-ts.
 *
 * The module wires the framework-agnostic decaf server primitives from
 * `@decaf-ts/for-http/server` into an Express application: request
 * contextualization and handlers, auth, auto-generated model routes, SSE observer
 * events, error mapping and a fluent bootstrap helper.
 *
 * The Nest integration (`@decaf-ts/for-nest`) is the reference implementation;
 * this package mirrors its public surface while replacing Nest's DI/module system
 * with explicit Express middleware and routers.
 */

import { Metadata } from "@decaf-ts/decoration";
import "./decoration";
import "./overrides";

export * from "./decoration"; // on top on purpose
export * from "./decaf-model";
export * from "./auth";
export * from "./factory";
export * from "./overrides";
export * from "./request";
export * from "./constants";
export * from "./controllers";
export * from "./module";
export * from "./core-module";
export * from "./types";
export * from "./decorators";
export * from "./utils";
export * from "./events-module";

/**
 * @const VERSION
 * Represents the current version of the for-express module.
 * The actual version number is replaced during the build process.
 * @type {string}
 * @category Package
 */
export const VERSION = "##VERSION##";

/**
 * @const COMMIT
 * Represents the current commit hash of the module build.
 * The placeholder is replaced during the build process.
 * @type {string}
 * @category Package
 */
export const COMMIT = "##COMMIT##";

/**
 * @const FULL_VERSION
 * Represents the full version string of the module (version plus build
 * metadata). The placeholder is replaced during the build process.
 * @type {string}
 * @category Package
 */
export const FULL_VERSION = "##FULL_VERSION##";

/**
 * @const PACKAGE_NAME
 * Package identifier used to register this library's version metadata with the
 * decaf {@link Metadata} registry at import time.
 * @type {string}
 * @category Package
 */
export const PACKAGE_NAME = "##PACKAGE##";

Metadata.allowReregistration(true);
Metadata.registerLibrary(PACKAGE_NAME, VERSION);
Metadata.allowReregistration(false);
