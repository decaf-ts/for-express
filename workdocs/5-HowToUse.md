## How to Use

- [Initial Setup](./workdocs/tutorials/For%20Developers.md#_initial-setup_)
- [Installation](./workdocs/tutorials/For%20Developers.md#installation)
- [Scripts](./workdocs/tutorials/For%20Developers.md#scripts)
- [Linting](./workdocs/tutorials/For%20Developers.md#testing)
- [CI/CD](./workdocs/tutorials/For%20Developers.md#continuous-integrationdeployment)
- [Publishing](./workdocs/tutorials/For%20Developers.md#publishing)
- [Structure](./workdocs/tutorials/For%20Developers.md#repository-structure)
- [IDE Integrations](./workdocs/tutorials/For%20Developers.md#ide-integrations)
  - [VSCode(ium)](./workdocs/tutorials/For%20Developers.md#visual-studio-code-vscode)
  - [WebStorm](./workdocs/tutorials/For%20Developers.md#webstorm)
- [Considerations](./workdocs/tutorials/For%20Developers.md#considerations)

---

## Module Configuration

### `DecafModule.forRoot(options)`

The main entry point. Boots persistence, builds the request pipeline, mounts the
auto-generated model routes and (when enabled) the SSE events router, and
returns a mountable Express `Router`.

```ts
import express from "express";
import { DecafModule, ExpressBootstraper } from "@decaf-ts/for-express";

const app = express();
app.use(express.json());

const decaf = await DecafModule.forRoot({
  conf: [
    [MyAdapter, myConfig, new MyTransformer()],
  ],
  autoControllers: true,
  authHandler: new MyAuthHandler(),
  handlers: [ImpersonateHandler],
  observerOptions: { enableObserverEvents: true },
  initialization: async () => { /* e.g. await Service.boot(); */ },
});

app.use(decaf.router);

ExpressBootstraper
  .initialize(app)
  .enableCors("*")
  .useGlobalFilters()
  .start(3000);
```

`DecafModule.forRoot` returns an `ExpressDecafApp`:

| Property | Type | Description |
|---|---|---|
| `router` | `Router` | Router mounting the request pipeline, model routes and SSE events. |
| `adapters` | `Adapter[]` | Adapter instances booted from the persistence configuration. |
| `flavours` | `string[]` | The booted adapter flavours. |
| `contextFor` | `(req, res) => DecafRequestContext` | Resolves (or creates) the request context for a request. |
| `shutdown` | `() => Promise<void>` | Shuts down every booted adapter and the service registry. |

#### `DecafModuleOptions`

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `conf` | `[Constructor<Adapter>, ConfigOf<Adapter>, ...any[], Transformer?][]` | Yes | — | Array of adapter tuples: `[AdapterClass, adapterConfig, ...args, transformer?]`. The trailing transformer (instance or constructor) maps request context fields to adapter-specific keys. If omitted, the adapter's registered `@requestToContextTransformer` is used. |
| `autoControllers` | `boolean` | Yes | — | When `true`, auto-generates CRUD controllers for all models registered to each adapter flavour. |
| `autoServices` | `boolean` | No | `false` | Accepted for parity with the Nest integration. Generated controllers always back onto `ModelService` singletons (warmed for every exposed model); this option currently has no additional effect on Express. |
| `alias` | `string` | No | — | Optional adapter alias for multi-instance scenarios. |
| `controllerExposure` | `Record<string, boolean \| string[]>` | No | — | Per-model exposure overrides. `true` exposes on all flavours; an array of flavour strings restricts exposure; `false` hides the model. When omitted, the `@expose` decorator metadata is used. |
| `controllerConfig` | `Record<string, ModelControllerFactoryConfig>` | No | — | Per-model controller factory config, merged on top of decorator-level `@controllerConfig` and `globalDefaults`. See the `for-http`/`for-nest` docs for the `ModelControllerFactoryConfig` shape (`allowStatementlessQuery`, `allowGroupingQueries`, `allowBulkStatement`, `auth`). |
| `aggregations` | `boolean` | No | `true` | When `false`, disables grouping/aggregation routes globally (`allowGroupingQueries: false`). |
| `observerOptions` | `ObserverEventsOptions` | No | — | SSE observer event configuration. See below. |
| `handlers` | `Constructor<DecafRequestHandler>[]` | No | `[]` | Request handlers executed before controller methods. Each handler implements `handle(context, req, res)`. |
| `initialization` | `() => Promise<void>` | No | — | Called once after persistence boots but before `forRoot` returns. |
| `authHandler` | `AuthHandler` | No* | — | The auth handler used to authenticate/authorize requests. Unlike the Nest integration (which supplies it through DI), on Express it is passed explicitly. *Required when `autoControllers: true` unless `allowAnonymous` is set. |
| `allowAnonymous` | `boolean` | No | `false` | Explicitly opts generated model routes into running without an `authHandler`. When `autoControllers: true` and no `authHandler` is configured, `forRoot` fails closed (throws) unless this is `true`. |

#### `ObserverEventsOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `enableObserverEvents` | `boolean` | `false` | Enables SSE stream events globally. |
| `subscriptionMode` | `boolean` | `false` | Enables explicit subscription registration (`POST /subscribe`, `POST /unsubscribe`) and per-subscriber topic filtering. Broadcast remains the default when omitted. |
| `authenticate` | `boolean` | — | Runs the registered auth handler on the SSE stream and on the subscribe/unsubscribe endpoints. A rejected stream gets the auth handler's HTTP error (e.g. 401). |
| `observerFlavours` | `any[]` | all registered | List of adapter flavours that will emit stream events. |
| `observerApiPath` | `string` | `"/events"` | SSE endpoint path. |

---

## Request pipeline

The mounted router runs, in order:

```
Request → AuthMiddleware (contextualize + authHandler.prime) → handlersMiddleware (DecafHandlerExecutor) → SSE events router (when enabled) → generated routes → DecafErrorFilter
```

The SSE events router is mounted **before** the generated model routes so a
fixed-prefix path such as `/events` cannot be shadowed by a single-segment
parametric model route.

- **`AuthMiddleware`** creates (or reuses) the request-scoped
  [`DecafRequestContext`](#request-context), populates it exactly once per
  request (default adapter flags, headers, overrides, timestamp, operation,
  IP-bound logger from `x-forwarded-for`/`x-real-ip`), and best-effort calls
  `authHandler.prime`.
- **`handlersMiddleware`** runs every registered `DecafRequestHandler` through
  `DecafHandlerExecutor`, giving each the shared request context.
- **`contextFor`** is also exposed on the returned `ExpressDecafApp` for use in
  custom middleware.

### Request context

`DecafRequestContext extends RequestContext<Request>` (from
`@decaf-ts/for-http/server`). It wraps the Express `Request`/`Response` pair so
generated controllers and auth handlers can read headers, accumulate overrides
(`put(record)`) and write pending-task hints back onto the response
(`toResponse(res)` sets the `x-pending-task` header when a task is pending).

---

## Model controllers

When `autoControllers: true`, for every booted flavour the package filters
`Adapter.models(flavour)` by exposure and generates CRUD/bulk/statement/
listBy/paginate/grouping/complex-query routes from the model's persistence
metadata, using `ModelControllerFactory` from `@decaf-ts/for-http/server`.

Exposure is controlled by:

1. `controllerExposure[modelName]` in `DecafModuleOptions` (highest priority);
2. the `@expose(...flavours)` decorator on the model (no arguments = expose on
   all flavours);
3. defaulting to **exposed** when neither is set.

Per-model controller configuration is merged in this priority order (later
wins):

1. `globalDefaults` (from `aggregations: false`);
2. `@controllerConfig(...)` decorator on the model class;
3. `controllerConfig[modelName]` in `DecafModuleOptions`.

Generated routes are mounted under the model's kebab-cased table name
(`/${toKebabCase(Model.tableName(model))}`, mirroring for-nest's per-controller
`@Controller(routePath)`), and route paths are registered with literal segments
before parameterized ones. The `path` on each route descriptor returned by
`DecafModelModule.forRoot` (and on the routes generated by
`FromModelController.create`) is **relative to that base path** (e.g. `""`,
`"bulk"`, `"find/:value"`); the full mounted URL is
`/<kebab-table-name>/<path>`. Responses use `201` for `POST`, `200` otherwise,
`204` when the handler produces no result.

### Decorators

| Decorator | Applies to | Description |
|---|---|---|
| `@expose(...flavours)` | model class | Marks the model as exposed (optionally restricted to flavours). |
| `@controllerConfig(config)` | model class | Attaches a `ModelControllerFactoryConfig` to the model. Overridable per-module. |
| `@route` / `@get` / `@post` / `@put` / `@patch` / `@delete` | methods | Re-exported from `@decaf-ts/for-http/server`. On Express these only record route metadata that the route builder discovers; unlike the Nest integration they do not register the route themselves. |
| `@Auth(model?)` | class/method | Marks the route as authenticated for the given model. |
| `@Public()` | class/method | Skips auth entirely. |
| `@RequireRoles(...roles)` | class/method | Requires the user to hold all listed roles. |
| `@RequireNamespaces(...namespaces)` | class/method | Requires the user to hold all listed namespace scopes. |
| `@SkipModelRoles()` / `@SkipModelNamespaces()` | class/method | Skips model-level role/namespace validation for the route. |

Unlike Nest, Express has no reflection layer: generated routes carry their auth
configuration explicitly into an `AuthInterceptor` instance, and the
`@Auth`/`@Public`/`@RequireRoles`/... decorators exist so custom controllers
written on top of `DecafController`/`DecafModelController` can declare the same
metadata.

### Custom controllers

Extend `DecafController` / `DecafModelController` (both exported) to build your
own Express controllers with the same persistence-resolution behaviour as the
generated ones:

```ts
import { DecafModelController } from "@decaf-ts/for-express";

class MyController extends DecafModelController<MyModel> {
  get class() { return MyModel; }

  async list(req: Request, res: Response) {
    const persistence = this.persistence(); // ModelService / Repo for MyModel
    // ...
  }
}
```

`persistence(ctx?)` resolves `Service.get` → `ModelService.getService` →
`Repository.forModel`, and applies the request-context overrides when a context
is supplied.

---

## Auth configuration

### `AuthHandler`

The `AuthHandler` type is the Express-narrowed alias of the base class from
`@decaf-ts/for-http/server`, specializing the execution context to an Express
`Request` and the request context to `DecafRequestContext`. Concrete handlers
extend it and override `extractFromRequest`:

```ts
import { AuthHandler, AuthorizationError } from "@decaf-ts/for-express";

export class MyAuthHandler extends AuthHandler {
  protected extractFromRequest(req: Request) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new AuthorizationError("Unauthenticated");
    return { user: token, roles: [token] };
  }
}
```

A ready-made `DecafAuthHandler` (alias `DecafRoleAuthHandler`) is included: it
reads a role string from the `Authorization: Bearer <role>` header and returns
it as both the user identifier and the single role.

The flow per request:

1. `AuthMiddleware` contextualizes the request and best-effort `prime`s the
   handler;
2. on non-public generated routes (and on SSE endpoints when
   `observerOptions.authenticate` is set), `AuthInterceptor` calls
   `authHandler.authorize(...)` with the route's model, roles and namespaces,
   then `applyTransformers()` accumulates each flavour's
   `RequestToContextTransformer` output into the context. Without an
   `authHandler` (only possible with `allowAnonymous: true`), the interceptor
   logs the unauthenticated route and skips authorization.

`forRoot` fails closed: when `autoControllers: true` and no `authHandler` is
supplied, it throws unless `allowAnonymous: true` explicitly opts the generated
routes into running unauthenticated. With `allowAnonymous: true`, no
authorization is performed on generated routes — each route logs a
`running UNAUTHENTICATED` warning and continues.

---

## SSE events

When `observerOptions.enableObserverEvents` is set, `DecafModule.forRoot`
mounts an `EventsRouter` under `observerApiPath` (default `/events`):

| Endpoint | Method | Description |
|---|---|---|
| `/events` | GET | SSE stream of all observed events, with a 15s heartbeat. |
| `/events/:model` | GET | SSE stream scoped to a model (raw event payloads). |
| `/events/subscribe` | POST | Subscription mode only: registers topics `{ topics: string[] }` for the requester fingerprint. |
| `/events/unsubscribe` | POST | Subscription mode only: removes the requester fingerprint. |

Each connection resolves a requester fingerprint
(`user:<user>:<x-correlation-id>` when authenticated, `cid:<correlation-id>`
when only the `x-correlation-id` header is present, `conn:<uuid>` otherwise)
and, in subscription mode, filters events through the in-memory
`ObserverSubscriptionRegistry`. A newer stream from the same fingerprint
supersedes the older one (the old connection is closed).

Events are written as `event: <type>` + `data: <json>` frames; payloads are
normalized to `[modelName, operation, id, serializedPayload]`.

---

## Bootstrap helper

`ExpressBootstraper` is the Express equivalent of the Nest `NestBootstraper`:
a fluent, static helper that mutates the bound `express.Application` and
returns itself for chaining.

| Method | Description |
|---|---|
| `initialize(app)` | Binds the application. Required first. |
| `enableLogger(logger?)` | Overrides the helper's logger. |
| `enableCors(origins, allowMethods?)` | Applies the `cors` middleware with an origin allow-list (or `*`). Requests without an `Origin` header are always allowed. Credentialed requests (`credentials: true`) are only enabled for an explicit origin allow-list; a wildcard (`"*"`) disables `credentials` and logs a warning, since browsers reject credentialed wildcard CORS responses. `allowMethods` defaults to `["GET", "POST", "PUT", "DELETE"]`. Disallowed origins raise a `CorsError` (`ForbiddenError`). Skipped with a warning when `cors` is not installed. |
| `useHelmet(options?)` | Applies the `helmet` middleware when installed (skipped otherwise). |
| `useRateLimit(options?)` | Applies `express-rate-limit` (defaults: 100 requests/minute) when installed (skipped otherwise). |
| `setupSwagger(options)` | Serves the OpenAPI JSON/YAML endpoints and (when `swagger-ui-express` is installed) the Swagger UI. See below. |
| `useGlobalMiddleware(...middleware)` | Registers regular Express middleware. |
| `useGlobalInterceptors(...middleware)` | Express has no interceptor concept; interceptors are registered as regular middleware. |
| `useGlobalFilters(...filters)` | Registers the terminal error handler. With no arguments, the built-in `DecafErrorFilter` is used. Must be registered after all routes. |
| `start(port?, host?, log?)` | Starts listening. `port` defaults to `process.env.PORT \|\| 3000`. |

```ts
ExpressBootstraper
  .initialize(app)
  .enableLogger()
  .enableCors(["https://app.example.com"])
  .useHelmet()
  .useRateLimit({ max: 50 })
  .setupSwagger({
    title: "My API",
    description: "My decaf Express API",
    version: "1.0.0",
    path: "api",
  })
  .useGlobalFilters()
  .start(3000, "0.0.0.0");
```

## Error handling

`DecafErrorFilter` is the Express equivalent of the Nest `DecafExceptionFilter`
— a terminal four-argument error handler that maps any thrown error onto the
decaf error contract:

- decaf `BaseError` instances pass through (their `code` is used as the HTTP status);
- `UnsupportedError` is mapped to `InternalError` with status `406`;
- non-decaf errors carrying a `status`/`statusCode` are mapped to the matching
  decaf error (401→`AuthorizationError`, 403→`ForbiddenError`, 400→
  `BadRequestError`, 409→`ConflictError`, 422→`ValidationError`, 404→
  `NotFoundError`, 429→`ToManyRequestsError`) or keep their status;
- anything else becomes an `InternalError` (500).

The response body is `{ status, error, timestamp, path, method }`, with the
error **name** instead of the message in production (`LoggedEnvironment.env ===
"production"`). Errors are logged through the request context logger, and
authorization failures are additionally logged as `FORBIDDEN` actions.

---

## OpenAPI / Swagger

`SwaggerBuilder` assembles an OpenAPI 3.0 document explicitly — Express has no
decorator-driven metadata, so paths, schemas and security schemes are added via
`addPath`/`addSchema`/`addSecurityScheme`. `setupSwagger(options)` on
`ExpressBootstraper` mounts:

- `GET /<path>/api-json` — the OpenAPI JSON document (default `path` is `api`);
- `GET /<path>/api-yaml` — the same document as YAML (requires the `yaml` package, included as a dependency);
- the Swagger UI under `/<path>` when the optional `swagger-ui-express` package is installed (JSON/YAML are still served otherwise).

`SwaggerSetupOptions`: `title`, `description`, `version` (required); `path`,
`persistAuthorization` (default `true`), `assetsPath`, `faviconFilePath`,
`topbarIconFilePath`, `topbarBgColor`, `openApiJsonPath`, `openApiYamlPath`
(optional).

---

## CLI

The package ships a `for-express` binary (also available as `npm run cli`):

```bash
for-express boot [entry]   # Boot the application entrypoint (defaults to ./lib/main)
for-express version        # Print the installed version
for-express help           # Print this help
```

`boot` resolves the entry among `./lib/main.cjs`, `./lib/main.js`,
`./src/main.ts`, `./lib/app.cjs`, `./lib/app.js`, `./src/app.ts` (or uses the
explicit argument) and spawns it as a child process — so a Docker image can
keep the CLI as the single entrypoint.

---

## Overrides

The package installs two side-effect patches on import (`./overrides`, marked
side-effectful in `package.json` — tree-shakers must not drop them):

- `Adapter.transformerFor(adapter|alias)` / `Adapter.flavoursToTransform()` —
  the transformer registry lookups used by the auth interceptor and the
  persistence boot;
- `Context.prototype.toResponse(res)` — writes the `x-pending-task` header when
  a pending task is attached to the context.

## Coding Principles

- group similar functionality in folders (analog to namespaces but without any namespace declaration)
- one class per file;
- one interface per file (unless interface is just used as a type);
- group types as other interfaces in a types.ts file per folder;
- group constants or enums in a constants.ts file per folder;
- group decorators in a decorators.ts file per folder;
- always import from the specific file, never from a folder or index file (exceptions for dependencies on other packages);
- prefer the usage of established design patters where applicable:
  - Singleton (can be an anti-pattern. use with care);
  - factory;
  - observer;
  - strategy;
  - builder;
  - etc;
