/**
 * @module for-express/decaf-model/decorators/decorators
 * @summary Re-export barrel for auth-related model decorators.
 * @description Currently re-exports the {@link Auth} class decorator from the
 * package's auth module so model/controller decorators can be imported from a
 * single decorators entry point, mirroring the Nest integration's decorators
 * barrel.
 */

export { Auth } from "../../auth/decorators";
