## Documentation

You can see below the API reference of this module.

### Hooks <sup><small><kbd>type</kbd></small></sup>

The constructor for reusable hook pipelines.

### LienObj <sup><small><kbd>type</kbd></small></sup>

The request object constructor, also available as a named export.

### RoutePattern <sup><small><kbd>typedef</kbd></small></sup>

A route or hook pattern, or an array of patterns.

### `RouteHandler(lien, args)` <sup><small><kbd>callback</kbd></small></sup>

#### Params

- **LienObj** `lien`: The current request.
- **...\*** `args`: Additional arguments supplied by error handlers.

#### Return
- **\*** A return value or promise. Response helpers send the actual response.

### RouteOutput <sup><small><kbd>typedef</kbd></small></sup>

A route handler or a filename relative to the public root.

### `Middleware(req, res, next)` <sup><small><kbd>callback</kbd></small></sup>

#### Params

- **object** `req`: The Express request.
- **object** `res`: The Express response.
- **Function** `next`: The next Express middleware.

#### Return
- **\*** A middleware return value or promise.

### RouteOptions <sup><small><kbd>typedef</kbd></small></sup>

#### Properties
- **string** `method`: The lowercase HTTP method or all.
- **Middleware|Array\<Middleware>** `[before]`: Express middleware before the Lien handler.
- **Middleware|Array\<Middleware>** `[after]`: Express middleware reached when the handler delegates.

### ErrorPages <sup><small><kbd>typedef</kbd></small></sup>

#### Properties
- **RouteOutput** `[notFound]`: Handles missing routes and files.
- **RouteOutput** `[serverError]`: Handles other failures; functions also receive the error.
- **RouteOutput** `[badCsrf]`: Handles invalid CSRF tokens.

### SessionOptions <sup><small><kbd>typedef</kbd></small></sup>

#### Properties
- **string|Array\<string>** `[secret]`: Signing secret; takes precedence over cookieSecret.
- **boolean** `[resave=false]`: Whether to save unchanged sessions.
- **boolean** `[saveUninitialized=true]`: Whether to save new, unchanged sessions.
- **object** `[cookie]`: Session cookie options.
- **string|Function|object** `[store]`: A module name, factory, provider, class, or store instance.
- **object** `[storeOptions]`: Options for a store created by Lien.

### ViewOptions <sup><small><kbd>typedef</kbd></small></sup>

#### Properties
- **string** `path`: The views directory.
- **string** `name`: The registered or installed view engine name.

### SslOptions <sup><small><kbd>typedef</kbd></small></sup>

#### Properties
- **string** `[key]`: Private key filename, required unless _key is supplied.
- **string** `[cert]`: Certificate filename, required unless _cert is supplied.
- **string|Buffer** `[_key]`: Private key contents.
- **string|Buffer** `[_cert]`: Certificate contents.

### LienOptions <sup><small><kbd>typedef</kbd></small></sup>

#### Properties
- **string** `[host]`: The listen address.
- **number|string** `[port]`: The port; defaults to process.env.PORT or 3000. Use 0 for an assigned port.
- **string|Array\<Array\<string>>** `[public=[]]`: A directory or pairs of mount URL and directory.
- **ViewOptions** `[views]`: Template settings.
- **boolean|SessionOptions** `[session=false]`: Session configuration.
- **string|Array\<string>** `[cookieSecret]`: Signing secret; defaults to a random 32-byte secret per server.
- **object** `[cookieOptions={}]`: Options passed to cookie-parser.
- **boolean|object|null** `[csrf=null]`: CSRF options; true enables cookie mode.
- **boolean|object** `[bodyParserJson=true]`: Enables express.json() or supplies its options.
- **boolean|object** `[bodyParserUrlEncoded=true]`: Enables express.urlencoded() or supplies its options.
- **boolean** `[cookieParser=true]`: Whether to parse cookies.
- **boolean** `[transformers=true]`: Legacy option controlling before and after hooks.
- **boolean** `[logErrors=true]`: Whether to log request errors.
- **ErrorPages|boolean** `[errorPages={}]`: Custom error pages, or false to omit default handlers.
- **SslOptions** `[ssl]`: HTTPS certificate settings.

### Lien <sup><small><kbd>class</kbd></small></sup>

Creates an HTTP or HTTPS server and starts listening after initialization.

#### Properties
- **Promise\<Lien>** `ready`: Resolves after listening; rejects on startup failure.
- **object** `app`: The Express application.
- **object** `router`: The router for dynamic routes and add().
- **object** `beforeRequest`: The router for routes taking priority over static files.
- **object** `staticRouter`: The router serving public directories.
- **import("node:http").Server|import("node:https").Server** `server`: The underlying server.
- **LienOptions** `options`: The effective configuration, including the bound port.
- **object** `transformers`: Registered hook definitions, grouped by type and method.

### `constructor(options={})` <sup><small><kbd>method</kbd></small></sup>

Creates the server. Routes can be registered before ready resolves.

#### Params

- **LienOptions** `[options={}]`: Server configuration.

### `close()` <sup><small><kbd>method</kbd></small></sup>

Stops listening and closes stores created by Lien. Repeated calls return the same shutdown promise. Supplied store instances remain owned by the caller.

#### Return
- **Promise\<void>** Resolves after shutdown.

### `addStaticPath(url, localPath)` <sup><small><kbd>method</kbd></small></sup>

Mounts a public directory. Static requests do not execute route hooks.

#### Params

- **string** `url`: The mount URL.
- **string** `localPath`: The local directory.

#### Return
- **void**

### `addPage(url, method, output)` <sup><small><kbd>method</kbd></small></sup>

Registers a route. With two arguments, the second is the output and all methods are handled. Object-form before and after options are Express middleware, not Lien hooks.

#### Params

- **RoutePattern** `url`: The route pattern.
- **string|RouteOptions|RouteOutput** `method`: The method, route options, or output.
- **RouteOutput** `[output]`: The handler or public filename.

#### Return
- **void**

### `errorPages(options={})` <sup><small><kbd>method</kbd></small></sup>

Appends not-found and error handlers to the Express application.

#### Params

- **ErrorPages** `[options={}]`: Custom handlers or public filenames.

#### Return
- **void**

### `getHooks(type, url, method)` <sup><small><kbd>method</kbd></small></sup>

Returns the matching hook pipeline, combining URL groups in registration order.

#### Params

- **string** `type`: The hook type, such as before, after, or custom:name.
- **string** `url`: The request path.
- **string** `method`: The lowercase HTTP method.

#### Return
- **Hooks|null** A reusable pipeline, or null when no hooks match.

### `getHooksStrict(type, url, method)` <sup><small><kbd>method</kbd></small></sup>

Returns hooks registered with the same compiled pattern.

#### Params

- **string** `type`: The hook type.
- **RoutePattern** `url`: The registered pattern.
- **string** `method`: The lowercase HTTP method.

#### Return
- **Hooks|null** The matching pipeline, or null.

### `insertHook(type, url, method, pipeline)` <sup><small><kbd>method</kbd></small></sup>

Inserts a native hook pipeline. External Transformer instances are not accepted.

#### Params

- **string** `type`: The hook type, including custom:name.
- **RoutePattern** `url`: The hook pattern.
- **string** `method`: The lowercase HTTP method.
- **Hooks** `pipeline`: The pipeline to insert.

#### Return
- **Hooks** The inserted pipeline.

### `hook(where, url, method, callback, mode=3)` <sup><small><kbd>method</kbd></small></sup>

Registers hooks for a pattern, URL array, or wildcard. Omitting the method applies to all HTTP methods. Returns the server for chaining.

#### Params

- **string** `where`: The hook type: before, after, or custom:name.
- **RoutePattern** `url`: The hook pattern or patterns.
- **string|import("./hooks.js").HookCallback** `method`: The method or callback.
- **import("./hooks.js").HookCallback|import("./hooks.js").HookMode** `[callback]`: The callback, or mode when the method is omitted.
- **import("./hooks.js").HookMode** `[mode=3]`: The execution mode.

#### Return
- **Lien** The server.

### `before(url, method, callback, mode=3)` <sup><small><kbd>method</kbd></small></sup>

Registers hooks receiving lien before the route handler.

#### Params

- **RoutePattern** `url`: The hook pattern or patterns.
- **string|import("./hooks.js").HookCallback** `method`: The method or callback.
- **import("./hooks.js").HookCallback|import("./hooks.js").HookMode** `[callback]`: The callback, or mode when the method is omitted.
- **import("./hooks.js").HookMode** `[mode=3]`: The execution mode.

#### Return
- **void**

### `after(url, method, callback, mode=3)` <sup><small><kbd>method</kbd></small></sup>

Registers hooks receiving response data before end() sends it.

#### Params

- **RoutePattern** `url`: The hook pattern or patterns.
- **string|import("./hooks.js").HookCallback** `method`: The method or callback.
- **import("./hooks.js").HookCallback|import("./hooks.js").HookMode** `[callback]`: The callback, or mode when the method is omitted.
- **import("./hooks.js").HookMode** `[mode=3]`: The execution mode.

#### Return
- **void**

### `use(url, method, callback, mode=3)` <sup><small><kbd>method</kbd></small></sup>

Registers before hooks for a URL and its subpaths. Does not protect static files.

#### Params

- **string** `url`: The base URL.
- **string|import("./hooks.js").HookCallback** `method`: The method or callback.
- **import("./hooks.js").HookCallback|import("./hooks.js").HookMode** `[callback]`: The callback, or mode when the method is omitted.
- **import("./hooks.js").HookMode** `[mode=3]`: The execution mode.

#### Return
- **void**

### `add(url, method, callback)` <sup><small><kbd>method</kbd></small></sup>

Registers a handler without before hooks. end() still executes after hooks.

#### Params

- **RoutePattern** `url`: The route pattern.
- **string|RouteHandler** `method`: The HTTP method or handler; omitted methods mean all.
- **RouteHandler** `[callback]`: The handler when a method is provided.

#### Return
- **void**

### `HookNext(error)` <sup><small><kbd>callback</kbd></small></sup>

#### Params

- **Error** `[error]`: The failure, or no argument to continue.

#### Return
- **void**

### `HookCallback(data, next)` <sup><small><kbd>callback</kbd></small></sup>

#### Params

- **\*** `data`: A Lien request, response data, or custom execution value.
- **HookNext** `[next]`: Completes a callback-style hook; pass an error to fail.

#### Return
- **\*** Async hooks may return a promise. Returned values do not replace data.

### `HookDone(error, data)` <sup><small><kbd>callback</kbd></small></sup>

#### Params

- **Error|null** `error`: The failure, or null on success or cancellation.
- **\*** `data`: The original execution data.

#### Return
- **void**

### HookMode <sup><small><kbd>typedef</kbd></small></sup>

Use 1/PARALLEL, 2/UNORDERED, or 3/ORDERED. Only these values and names are accepted.

### HookRunOptions <sup><small><kbd>typedef</kbd></small></sup>

#### Properties
- **AbortSignal** `[signal]`: Cancels execution without treating cancellation as a hook error.
- **function(): boolean** `[isStopped]`: Stops further hooks when true.

### Hooks <sup><small><kbd>class</kbd></small></sup>

Stores hook definitions. Execution state is local to run().

### `add(hook, mode=3)` <sup><small><kbd>method</kbd></small></sup>

Appends a hook, nested pipeline, or array of hooks. The legacy PARALLEL mode is a serial prelude; consecutive UNORDERED hooks run together.

#### Params

- **HookCallback|Hooks|Array\<HookCallback|Hooks>** `hook`: The definitions to append.
- **HookMode** `[mode=3]`: The execution mode.

#### Return
- **Hooks** This pipeline.

### `run(data={}, options={})` <sup><small><kbd>method</kbd></small></sup>

Executes hooks with independent state, awaiting async and callback hooks. Cancellation stops subsequent hooks and resolves with the same data; running work is not undone.

#### Params

- **T** `[data={}]`: The shared value for this execution; mutate it in place.
- **HookRunOptions** `[options={}]`: Cancellation and stop checks.

#### Return
- **Promise\<T>** The original data value after hooks complete or are canceled.

### `start(data={}, callback, isStopped)` <sup><small><kbd>method</kbd></small></sup>

Executes hooks with the legacy callback interface. start(callback) creates a fresh empty object. Prefer run() when awaiting the result.

#### Params

- **\*|HookDone** `[data={}]`: The execution data, or the completion callback.
- **HookDone** `[callback]`: Receives the error and original data.
- **function(): boolean** `[isStopped]`: Stops subsequent hooks when true.

#### Return
- **function(): void** Cancels this execution; completion is reported once.

### ResponseData <sup><small><kbd>typedef</kbd></small></sup>

#### Properties
- **\*** `content`: The response body, mutated in place by after hooks.
- **number** `status`: The HTTP status.
- **string** `[contentType]`: The content type, inferred from content when omitted.
- **Object\<string, \*>** `headers`: Additional response headers.
- **LienObj** `lien`: The request producing the response.

### LienObj <sup><small><kbd>class</kbd></small></sup>

Request and response helpers.

#### Properties
- **object** `req`: The Express request.
- **object** `res`: The Express response.
- **import("./server.js").default** `server`: The Lien server.
- **string** `path`: The request path with its trailing slash removed, except for root.
- **string** `pathname`: The mounted request pathname.
- **string** `full_path`: The original URL, including its query string.
- **string** `host`: The request hostname.
- **string** `protocol`: The request protocol.
- **string** `domain`: The origin, including the Host header's port.
- **string** `href`: The origin and original URL.
- **string** `method`: The lowercase HTTP method.
- **Object\<string, \*>** `params`: The decoded route parameters.
- **Object\<string, \*>** `query`: The parsed query parameters.
- **\*** `data`: The parsed request body.
- **Object\<string, \*>** `cookies`: The parsed cookies.
- **object|undefined** `session`: The current session, when enabled.
- **Function** `accepts`: Express content negotiation, bound to the request.

### `constructor(req, res, next, server)` <sup><small><kbd>method</kbd></small></sup>

Creates the request object passed to route handlers and before hooks.

#### Params

- **object** `req`: The Express request.
- **object** `res`: The Express response.
- **Function** `next`: The next Express middleware.
- **import("./server.js").default** `server`: The Lien server.

### csrfToken <sup><small><kbd>value</kbd></small></sup>

Returns a CSRF token, or an empty string when CSRF is disabled.

#### Return
- **string**

### csrfInput <sup><small><kbd>value</kbd></small></sup>

Returns the hidden CSRF input, or an empty string when CSRF is disabled.

#### Return
- **string**

### `next(error, data)` <sup><small><kbd>method</kbd></small></sup>

Delegates to Express once and cancels remaining hook execution.

#### Params

- **Error|string** `[error]`: An error or an Express routing directive.
- **\*** `[data]`: Additional data passed to the next middleware.

#### Return
- **LienObj** This request object.

### `redirect(newUrl, query)` <sup><small><kbd>method</kbd></small></sup>

Redirects the client, optionally merging query parameters and preserving the fragment.

#### Params

- **string** `newUrl`: The redirect target.
- **boolean|Object\<string, \*>** `[query]`: True copies the request query; an object overrides its values.

#### Return
- **LienObj** This request object.

### `render(template, data)` <sup><small><kbd>method</kbd></small></sup>

Renders a template and sends it without after hooks. Failures are forwarded to Express.

#### Params

- **string** `template`: The template name.
- **object** `[data]`: Template locals.

#### Return
- **Promise\<void>** Resolves after rendering and initiating the response.

### `startSession(data)` <sup><small><kbd>method</kbd></small></sup>

Initializes or updates application data in the current session.

#### Params

- **object** `data`: The session data to merge.

#### Return
- **LienObj|undefined** This request object, or undefined when sessions are disabled.

### `setSessionData(data)` <sup><small><kbd>method</kbd></small></sup>

Merges session data recursively without accepting prototype keys.

#### Params

- **object** `data`: New values; undefined entries leave existing values unchanged.

#### Return
- **LienObj|undefined** This request object, or undefined when sessions are disabled.

### `getSessionData(field)` <sup><small><kbd>method</kbd></small></sup>

Returns application session data or a nested field, preserving falsy values.

#### Params

- **string** `[field]`: A dot-separated field path.

#### Return
- **\*** The data, null for a missing field, or undefined when unavailable.

### `destroySession()` <sup><small><kbd>method</kbd></small></sup>

Removes the current session from its store.

#### Return
- **Promise\<void>** Resolves after destruction, or immediately when sessions are disabled.

### `header(name, value)` <sup><small><kbd>method</kbd></small></sup>

Reads request headers or sets/removes response headers. With no arguments, returns all request headers. A headers object sets multiple response headers.

#### Params

- **string|Object\<string, \*>** `[name]`: The header name or headers to set.
- **string|Array\<string>|number|null** `[value]`: The response value; null removes the header.

#### Return
- **LienObj|object|string|undefined** The request value, this object after setting, or undefined after removal.

### `apiMsg(message, status=200)` <sup><small><kbd>method</kbd></small></sup>

Sends a JSON response containing the message field, including after hooks.

#### Params

- **\*** `message`: The message value.
- **number** `[status=200]`: The HTTP status.

#### Return
- **Promise\<void>|undefined** The response promise, or undefined if already responding.

### `apiError(message, status=422)` <sup><small><kbd>method</kbd></small></sup>

Sends an API error message, using an Error object's message when supplied.

#### Params

- **string|Error** `message`: The error message.
- **number** `[status=422]`: The HTTP status.

#### Return
- **Promise\<void>|undefined** The response promise, or undefined if already responding.

### `end(content, status, contentType, headers)` <sup><small><kbd>method</kbd></small></sup>

Runs after hooks, serializes content, and ends the response. Also accepts end(content, status, headers) and end(status, headers). A numeric first argument is a status, and an omitted status preserves res.statusCode.

#### Params

- **\*** `[content]`: The response body or numeric status.
- **number|Object\<string, \*>** `[status]`: The status, or headers after a numeric first argument.
- **string|Object\<string, \*>** `[contentType]`: The content type or headers.
- **Object\<string, \*>** `[headers]`: Additional response headers.

#### Return
- **Promise\<void>|undefined** Resolves after hook processing; failures go to Express.

### `cookie(name, value, options)` <sup><small><kbd>method</kbd></small></sup>

Reads, sets, or clears a cookie. Clear operations preserve the supplied options.

#### Params

- **string** `name`: The cookie name.
- **\*** `[value]`: The value to set; null clears the cookie.
- **object** `[options]`: Express cookie options, including path and domain.

#### Return
- **\*** The stored value when reading, or this request object when setting/clearing.

### `file(filePath, customRoot)` <sup><small><kbd>method</kbd></small></sup>

Serves a file inside a root, rejecting traversal and escaping symlinks. Leading slashes are relative to the root. File errors are forwarded to Express.

#### Params

- **string** `filePath`: The rooted filename.
- **string** `[customRoot]`: The root directory; defaults to the first public directory.

#### Return
- **Promise\<void>** Resolves after serving or forwarding the error.

### SerializedContent <sup><small><kbd>typedef</kbd></small></sup>

#### Properties
- **Buffer** `buffer`: The encoded response body.
- **string** `contentType`: The default Express content type.

### `toBuffer(data)` <sup><small><kbd>function</kbd></small></sup>

Serializes response content to a Buffer and selects its default content type. Undefined produces an empty body; other non-string values are serialized as JSON.

#### Params

- **\*** `data`: The response content.

#### Return
- **SerializedContent** The encoded body and content type.

### `countCaptures()` <sup><small><kbd>function</kbd></small></sup>

Counts capture groups while ignoring escaped parentheses and character classes.

