# Lien code review

Review date: 2026-11-02

This report records an implementation review of the library, examples, and tests. Findings were checked with local probes against a fresh dependency installation in a temporary directory. The existing test suite passed on Node.js 25.8.1. No implementation or test files were changed during the review.

The highest-priority finding is a reproduced cross-request response leak. The existing tests also do not reliably signal assertion failures through their exit status.

## Findings

### 1. Critical: concurrent requests can receive another request's response

- **Location:** `lib/index.js:766` (`getHooks`) and `lib/index.js:288` (after-hook execution).
- **Problem:** Hooks reuse `Transformer` instances that store mutable request data. Overlapping executions overwrite that data.
- **Reproduction:** Two concurrent requests to `/race/A` and `/race/B` each generated their own response body. An asynchronous after hook held both requests until they overlapped. Both clients received `user-B`.
- **Impact:** One request can receive another request's private response data.
- **Suggested improvement:** Keep hook definitions reusable, but give every execution independent request and response state. Avoid sharing mutable transformer execution state between requests.
- **Future tests:** Deterministically overlap requests using callback barriers. Verify that both before and after hooks preserve each request's data, including when one request fails.

### 2. High: route options silently disable CSRF protection

- **Location:** `lib/index.js:674` (`addPage`).
- **Problem:** The initial middleware list includes CSRF protection, but the object form of the method argument replaces that list with `method.before || []`.
- **Reproduction:** With `csrf: true`, a normal POST route rejected a request without a token with status 422. An equivalent route registered with `{ method: "post", before: [] }` accepted the request and returned 200.
- **Impact:** Adding route-specific middleware can silently remove CSRF validation from a state-changing route.
- **Suggested improvement:** Preserve CSRF middleware when appending route-specific middleware. Make any intentional exemption explicit.
- **Future tests:** Exercise ordinary and object-form route registration with absent, invalid, and valid CSRF tokens.

### 3. High: the file helper allows access outside the public directory

- **Location:** `lib/index.js:368` (`file`).
- **Problem:** `path.resolve(customRoot, filePath)` accepts parent-directory traversal and absolute paths without enforcing containment within the configured root.
- **Reproduction:** A route using `lien.file(lien.query.name)` served a fixture outside the public directory when requested with `name=../secret.txt`.
- **Impact:** Applications passing user-controlled filenames can expose files outside the intended directory. Exploitability depends on how the application supplies the filename.
- **Related behavior:** A leading-slash filename such as `/index.html` resolves from the filesystem root, so examples using that form do not resolve within the public directory.
- **Suggested improvement:** Define the allowed filename contract and enforce a bounded root. Consider Express's rooted file-serving API, and decide explicitly whether symbolic links may lead outside that root.
- **Future tests:** Cover relative files, parent traversal, absolute paths, leading-slash paths, missing files, and explicitly supplied roots.

### 4. High: `use()` authentication does not protect static files

- **Location:** `lib/index.js:559` (router ordering) and `lib/index.js:952` (`use`).
- **Problem:** `use()` registers route hooks. Static files are served separately and do not execute those hooks.
- **Reproduction:** An authentication hook for `/auth` denied `/auth/private` with 403, but `/auth/secret.txt` returned a static fixture with 200.
- **Impact:** Applications treating `use()` as general authentication middleware can unintentionally expose static files. This depends on placing sensitive files under a public mount and expecting the hook to protect them.
- **Suggested improvement:** Clarify the middleware contract and provide a way to enforce checks before static serving. Document any intentional distinction between route hooks and general request middleware.
- **Future tests:** Verify authentication behavior for both registered routes and static files, including nested paths.

### 5. High: session configuration ignores the supplied session secret

- **Location:** `lib/index.js:499` (session initialization), especially line 506.
- **Problem:** `options.session.secret` is unconditionally overwritten with `options.cookieSecret`, whose default is the public string `"lien"`.
- **Reproduction:** Configuring `{ session: { secret: "CUSTOM_SECRET" } }` resulted in the effective session secret being `"lien"`.
- **Impact:** Applications can believe they have configured a private signing secret while actually using a known default. This does not by itself create arbitrary server-side session records, but it undermines the intended cookie-signing protection.
- **Suggested improvement:** Respect the explicitly configured session secret and require a strong configured secret when sessions are enabled.
- **Future tests:** Check explicit session secrets, cookie secrets, precedence rules, and missing-secret behavior.
- **Reference:** [express-session secret documentation](https://github.com/expressjs/session#secret) recommends at least 32 bytes of entropy.

### 6. High: asynchronous route errors and startup errors can terminate the process

- **Location:** `lib/index.js:633` and `lib/index.js:648` (handler invocation), and `lib/index.js:568` (startup).
- **Problem:** Route-handler return values are discarded, so rejected promises are not forwarded to error handling. HTTP server error events are also not forwarded to Lien's documented lifecycle events.
- **Reproduction:** In a child process, an `async` route that threw an error terminated the process. A second child process encountered a port conflict and terminated with an unhandled server `error` event despite listeners on Lien's `load` and `error` events.
- **Impact:** Routine application errors or deployment failures can bypass the expected handling path and crash the process.
- **Suggested improvement:** Capture returned promises and forward rejections to error middleware. Forward server lifecycle errors through a defined public API. Separating construction from listening would also make initialization and testing easier to control.
- **Future tests:** Cover synchronous throws, asynchronous rejections, hook errors, occupied ports, and successful shutdown. Use subprocesses where necessary to verify crash behavior safely.

### 7. Response and error behavior is inconsistent

- **Location:** `lib/index.js:266` (`end`), `lib/index.js:739` (error handling), and `lib/to-buffer.js:44` (error and JSON serialization).
- **Reproduced behavior:**
  - `lien.status(201).end("created")` sends status 200.
  - `lien.end(new Error("INTERNAL_DETAIL"))` sends the full stack trace with status 200.
  - A request with malformed JSON receives status 500 instead of a client-error response.
  - A circular object passed to `end()` becomes an empty response with status 200.
- **Impact:** Callers receive misleading success responses, internal implementation details can be exposed, and client errors are classified as server failures.
- **Suggested improvement:** Define status precedence consistently, preserve explicitly selected statuses, route serialization failures through error handling, and avoid returning internal error details to clients.
- **Future tests:** Cover status chaining, explicit status arguments, error objects, malformed and oversized bodies, and serialization failures.

### 8. The MongoDB session example is incompatible with the declared dependency

- **Location:** `lib/index.js:530` (store initialization), `example/login.js:14`, and `package.json:24`.
- **Problem:** The adapter assumes the old `connect-mongo(session)` factory API, while the declared dependency is `connect-mongo@^5.1.0`. The example also uses the old `url` option.
- **Reproduction:** Constructing the example's session configuration with `connect-mongo@5.1.0` throws `TypeError: Class constructor MongoStore cannot be invoked without 'new'` before a database connection is needed.
- **Impact:** The supplied login example cannot initialize with the declared dependency.
- **Suggested improvement:** Update the store integration and example together for the declared version's API, including `MongoStore.create()` and `mongoUrl`. Preserve older adapters only if that compatibility is intentional and covered.
- **Future tests:** Verify store construction and options independently of a live database, with a separate integration test if actual MongoDB behavior needs coverage.

## Additional improvements

| Area | Observation | Suggested improvement |
| --- | --- | --- |
| Session getters | `getSessionData()` converts stored `false`, `0`, and `""` to `null` through `value || null`. | Distinguish a missing value from a valid falsy value. |
| Cookie deletion | `cookie(name, null, options)` ignores `options` when calling `clearCookie()`. | Forward deletion options so cookies with custom paths or domains can be removed. |
| Redirects | Query parameters are appended using `"?"` even when the target has a query or fragment. A probe produced `/destination?existing=1#section?foo=bar`. | Merge query parameters with URL-aware handling while preserving fragments and supported relative targets. |
| Buffer usage | `lib/to-buffer.js` uses deprecated `new Buffer()` calls. | Use `Buffer.from()` and `Buffer.alloc()` as appropriate. |
| Serialization | The final branches in `to-buffer.js` are unreachable because all preceding paths return. The `buffer` property can also hold strings. | Remove dead code and define a consistent return contract. |
| Server lifecycle | Construction immediately starts listening. | Consider explicit start and close methods to simplify setup, embedding, and cleanup. |
| CI and runtime support | `.travis.yml` lists only Node.js 7, and `package.json` does not define a supported runtime range. | Declare supported runtimes and run CI against them. |
| Dependency reproducibility | `package-lock.json` is ignored. | Consider a committed development lockfile for reproducible CI installs while retaining appropriate library dependency ranges. |
| CSRF maintenance | The upstream `csurf` repository is archived. | Plan a maintained replacement and verify equivalent behavior during migration. |

Reference: [csurf upstream repository and archive notice](https://github.com/expressjs/csurf).

## Test reliability: fix before expanding coverage

The existing suite passed, but its exit status is not trustworthy when assertions fail.

### Confirmed false-success behavior

- **Location:** `test/index.js:279`, plus the installed `tester` runner's failure handling.
- **Reproduction:** A deliberately failing assertion, `t.expect(1).toBe(2)`, was injected into an in-memory copy of the test source. The runner printed the assertion failure, continued through the suite, and exited with status 0.
- **Cause:** The runner logs assertion failures without setting a failing process exit status. The suite finishes with `process.exit()` without an explicit failing code.
- **Impact:** CI can report success despite failed assertions.
- **Required improvement:** Ensure assertion failures result in a nonzero exit status. Close the HTTP server through teardown instead of forcing process termination.

### Other limitations in the current suite

- Tests share a single server and mutate its routes and hooks across cases, making results depend on execution order.
- The server uses fixed port 9000, which can conflict with another process or parallel test run.
- Many request callbacks do not explicitly check transport errors before inspecting the response.
- Coverage concentrates on successful routing, hooks, templates, and static files. It does not cover the security, concurrency, session, startup, or serialization failures above.
- Explicit request and test timeouts would make incomplete callbacks and hung requests easier to diagnose.

## Suggested implementation and testing order

1. **Make test outcomes reliable:** verify nonzero failure exits, add proper server teardown, and avoid forced process termination.
2. **Add regression cases alongside the highest-priority fixes:** concurrent hook isolation, CSRF preservation, file containment, and authentication behavior.
3. **Fix session configuration and error propagation:** test secrets, rejected promises, hook failures, and startup errors.
4. **Define response contracts:** test status precedence, error responses, body parsing, and serialization failures.
5. **Repair the MongoDB example and smaller helpers:** cover adapter construction, falsy session values, cookie deletion, and redirects.
6. **Improve suite structure and CI:** use isolated fixtures, ephemeral ports, explicit timeouts, and guaranteed cleanup; run supported Node.js versions.

## Validation scope

- The baseline suite and focused probes used freshly resolved dependencies installed outside the repository.
- Concurrency, CSRF, file access, static authentication, response behavior, session configuration, and store construction were exercised locally.
- Process-crash behavior was checked in child processes.
- Test failure reporting was checked with an in-memory modification; the repository's test source was not edited.
- These results apply to the reviewed checkout and resolved dependencies. This was not an exhaustive security audit or a compatibility test across all supported environments.
