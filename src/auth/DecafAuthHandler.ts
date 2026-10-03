/**
 * @module for-express/auth/DecafAuthHandler
 * @summary Concrete bearer-role auth handler and its backwards-compatible alias.
 * @description Provides the default Express {@link AuthHandler} implementation: it reads a role
 * string from the `Authorization: Bearer <role>` header and treats it as both the user identifier
 * and the single granted role. Only the platform-specific hooks are overridden — everything else
 * (validation, model roles/namespaces, context binding, action logging) is inherited from the
 * framework-agnostic `AuthHandler` base in `@decaf-ts/for-http/server`.
 *
 * `DecafRoleAuthHandler` is kept as an alias mirroring the Nest integration's public surface.
 */
import type { Request } from "express";
import { AuthorizationError } from "@decaf-ts/core";
import {
  AuthHandler,
  AuthData,
  AuthRequestLike,
} from "@decaf-ts/for-http/server";
import { DecafRequestContext } from "../request/DecafRequestContext";

/**
 * Simple Express auth handler that reads a role string from the
 * `Authorization: Bearer <role>` header.
 *
 * Only overrides {@link AuthHandler.extractFromRequest} to return the bearer
 * token as both the user identifier and the single role. The base class
 * `bindToContext` (`ctx.accumulate(data)`) is sufficient — the transformer
 * is responsible for mapping context fields to adapter-specific keys like `UUID`.
 *
 * @class DecafAuthHandler
 * @description Extracts a role from the `Authorization: Bearer <role>` header and binds it as the request identity.
 * @summary Specializes the generic `AuthHandler` for Express requests and {@link DecafRequestContext} contexts.
 * `parseRequest` pulls the bearer token from the `authorization` header, `extractFromRequest` turns it into
 * `{ user, roles: [role] }` (throwing an `AuthorizationError` when absent), and the base `bindToContext`
 * accumulates that data into the context so role/namespace validation and the flavour transformers can use it.
 * @template Request - The platform execution context handled by this handler (the Express `Request` itself).
 * @template DecafRequestContext - The request context type the handler binds auth data to.
 * @template AuthData - The auth-data shape returned by `extractFromRequest`.
 * @extends {AuthHandler}
 * @see AuthHandler Base class from `@decaf-ts/for-http/server`.
 * @category Auth
 *
 * @example
 * // Registering the default bearer-role handler on the module
 * const module = DecafModelModule.forRoot("db", {
 *   authHandler: new DecafAuthHandler(),
 * });
 */
export class DecafAuthHandler extends AuthHandler<
  Request,
  DecafRequestContext,
  AuthData
> {
  /**
   * Indicates that no request is considered public by default: every request
   * goes through `extractFromRequest` and must carry a bearer role.
   *
   * @param {Request} _req - The Express request (unused in the default implementation).
   * @return {boolean} Always `false`.
   * @override
   * @protected
   */
  protected override isPublicRequest(): boolean {
    return false;
  }

  /**
   * Reads the bearer token from the `authorization` header.
   *
   * @param {any} req - The Express request whose `authorization` header is inspected.
   * @return {string | undefined} The token following the `Bearer ` prefix, or `undefined` when the header is absent.
   * @protected
   */
  protected parseRequest(req: any): string | undefined {
    const header = req.headers.authorization;
    if (typeof header !== "string") return undefined;
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match ? match[1].trim() : undefined;
  }

  /**
   * Returns the request itself as the {@link AuthRequestLike} inspected by
   * `extractFromRequest`. Since the platform context is the Express `Request`,
   * no unwrapping is needed.
   *
   * @param {Request} ctx - The Express request acting as the execution context.
   * @return {AuthRequestLike} The same request, cast to the request-like surface.
   * @override
   * @protected
   */
  protected requestFromContext(ctx: Request): AuthRequestLike {
    return ctx as unknown as AuthRequestLike;
  }

  /**
   * Extracts the auth data from the request's bearer token.
   *
   * @param {any} req - The Express request to inspect.
   * @return {AuthData} The extracted auth data: the role as both `user` and the single entry of `roles`.
   * @throws {AuthorizationError} When no bearer token is present in the `authorization` header.
   * @override
   * @protected
   */
  protected extractFromRequest(req: any): AuthData {
    const userRole = this.parseRequest(req);
    if (!userRole) throw new AuthorizationError("Unauthenticated");
    return { user: userRole, roles: [userRole] };
  }
}

/**
 * Alias for {@link DecafAuthHandler} kept for backward compatibility with the
 * Nest integration's public surface.
 *
 * @class DecafRoleAuthHandler
 * @description Backwards-compatible alias for {@link DecafAuthHandler}.
 * @summary Inherits the entire bearer-role behaviour of {@link DecafAuthHandler}; exists so code
 * written against the Nest integration's export name keeps working with the Express package.
 * @extends {DecafAuthHandler}
 * @category Auth
 */
export class DecafRoleAuthHandler extends DecafAuthHandler {}
