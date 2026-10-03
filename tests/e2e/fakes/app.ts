import express, { type Express } from "express";
import { Adapter } from "@decaf-ts/core";
// @ts-expect-error ram
import { RamAdapter, RamFlavour } from "@decaf-ts/core/ram";
import { RamTransformer } from "@decaf-ts/for-http/server";

import {
  DecafErrorFilter,
  DecafModule,
  type DecafModuleOptions,
  type ExpressDecafApp,
} from "../../../src";

RamAdapter.decoration();
Adapter.setCurrent(RamFlavour);

export type BuiltApp = {
  app: Express;
  decaf: ExpressDecafApp;
};

/**
 * Builds a real Express app wired with a for-express `DecafModule`.
 *
 * Mirrors the for-nest `getApp`/`createTestingModule` helpers: the app is a
 * plain Express application with the decaf router mounted and the decaf error
 * filter registered as the terminal error handler.
 */
export async function buildApp(
  options: Partial<DecafModuleOptions> = {}
): Promise<BuiltApp> {
  const decaf = await DecafModule.forRoot({
    conf: [[RamAdapter, {}, new RamTransformer()]],
    autoControllers: true,
    autoServices: false,
    allowAnonymous: true,
    ...options,
  } as DecafModuleOptions);

  const app = express();
  app.use(express.json());
  app.use(decaf.router);
  app.use(new DecafErrorFilter().handler);

  return { app, decaf };
}
