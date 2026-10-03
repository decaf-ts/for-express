### Description

[![Banner](./workdocs/assets/Banner.png)](https://decaf-ts.github.io/for-express/)

## Express integration for decaf-ts

`@decaf-ts/for-express` binds the framework-agnostic server primitives of
[`@decaf-ts/for-http/server`](https://github.com/decaf-ts/for-http) onto the
[Express](https://expressjs.com/) runtime: request contextualization and
handlers, auth, auto-generated model routes, SSE observer events, error
mapping, OpenAPI/Swagger helpers, a fluent bootstrap helper and a small CLI.

The Nest integration ([`@decaf-ts/for-nest`](https://github.com/decaf-ts/for-nest))
is the reference implementation; this package mirrors its public surface while
replacing Nest's DI/module system with explicit Express middleware and routers.
