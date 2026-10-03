/**
 * @module for-express/decoration
 * @summary Express flavour decoration extensions, applied at import time.
 * @description Registers the Express-specific extensions onto the framework
 * decoration registry as a side effect of importing this module (see
 * `src/index.ts`). The Nest integration extends the decaf validation/column
 * decorators with Swagger `@ApiProperty` metadata; Express has no Swagger
 * reflection layer, so only the framework-agnostic `@auth` model decorator is
 * registered here.
 */
import { Decoration, DecorationKeys } from "@decaf-ts/decoration";
import { PersistenceKeys } from "@decaf-ts/core";

import { Auth } from "./auth/decorators";

/**
 * Extends the {@link PersistenceKeys.AUTH | @auth} decoration registry with the
 * Express {@link Auth} model decorator so models decorated with `@auth` carry
 * role/namespace requirements into the generated Express controllers. Runs at
 * import time as a side effect.
 * @category Decoration
 */
Decoration.for(PersistenceKeys.AUTH).extend({ decorator: Auth }).apply();

/**
 * Re-exports the decoration keys from `@decaf-ts/decoration` so consumers can
 * reference Express flavour decoration keys (including
 * {@link PersistenceKeys.AUTH | PersistenceKeys.AUTH}) from this package.
 * @category Decoration
 */
export { DecorationKeys };
