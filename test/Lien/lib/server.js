import { EventEmitter } from "node:events";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import csrf from "@dr.pogodin/csurf";
import Hooks from "./hooks.js";
import LienObj from "./lien.js";
import { configureSession } from "./sessions.js";
import { configureErrorPages } from "./errors.js";
import { methods, compileRoute, getHooks, insertHook } from "./hook-registry.js";
import { asError } from "./utils.js";

/**
 * @typedef {string|RegExp|Array<string|RegExp>} RoutePattern
 * A route or hook pattern, or an array of patterns.
 */

/**
 * @callback RouteHandler
 * @param {LienObj} lien The current request.
 * @param {...*} args Additional arguments supplied by error handlers.
 * @returns {*} A return value or promise. Response helpers send the actual response.
 */

/**
 * @typedef {string|RouteHandler} RouteOutput
 * A route handler or a filename relative to the public root.
 */

/**
 * @callback Middleware
 * @param {object} req The Express request.
 * @param {object} res The Express response.
 * @param {Function} next The next Express middleware.
 * @returns {*} A middleware return value or promise.
 */

/**
 * @typedef {object} RouteOptions
 * @property {string} method The lowercase HTTP method or all.
 * @property {Middleware|Array<Middleware>} [before] Express middleware before the Lien handler.
 * @property {Middleware|Array<Middleware>} [after] Express middleware reached when the handler delegates.
 */

/**
 * @typedef {object} ErrorPages
 * @property {RouteOutput} [notFound] Handles missing routes and files.
 * @property {RouteOutput} [serverError] Handles other failures; functions also receive the error.
 * @property {RouteOutput} [badCsrf] Handles invalid CSRF tokens.
 */

/**
 * @typedef {object} SessionOptions
 * @property {string|Array<string>} [secret] Signing secret; takes precedence over cookieSecret.
 * @property {boolean} [resave=false] Whether to save unchanged sessions.
 * @property {boolean} [saveUninitialized=true] Whether to save new, unchanged sessions.
 * @property {object} [cookie] Session cookie options.
 * @property {string|Function|object} [store] A module name, factory, provider, class, or store instance.
 * @property {object} [storeOptions] Options for a store created by Lien.
 */

/**
 * @typedef {object} ViewOptions
 * @property {string} path The views directory.
 * @property {string} name The registered or installed view engine name.
 */

/**
 * @typedef {object} SslOptions
 * @property {string} [key] Private key filename, required unless _key is supplied.
 * @property {string} [cert] Certificate filename, required unless _cert is supplied.
 * @property {string|Buffer} [_key] Private key contents.
 * @property {string|Buffer} [_cert] Certificate contents.
 */

/**
 * @typedef {object} LienOptions
 * @property {string} [host] The listen address.
 * @property {number|string} [port] The port; defaults to process.env.PORT or 3000. Use 0 for an assigned port.
 * @property {string|Array<Array<string>>} [public=[]] A directory or pairs of mount URL and directory.
 * @property {ViewOptions} [views] Template settings.
 * @property {boolean|SessionOptions} [session=false] Session configuration.
 * @property {string|Array<string>} [cookieSecret] Signing secret; defaults to a random 32-byte secret per server.
 * @property {object} [cookieOptions={}] Options passed to cookie-parser.
 * @property {boolean|object|null} [csrf=null] CSRF options; true enables cookie mode.
 * @property {boolean|object} [bodyParserJson=true] Enables express.json() or supplies its options.
 * @property {boolean|object} [bodyParserUrlEncoded=true] Enables express.urlencoded() or supplies its options.
 * @property {boolean} [cookieParser=true] Whether to parse cookies.
 * @property {boolean} [transformers=true] Legacy option controlling before and after hooks.
 * @property {boolean} [logErrors=true] Whether to log request errors.
 * @property {ErrorPages|boolean} [errorPages={}] Custom error pages, or false to omit default handlers.
 * @property {SslOptions} [ssl] HTTPS certificate settings.
 */

/**
 * Lien
 * Creates an HTTP or HTTPS server and starts listening after initialization.
 *
 * @extends EventEmitter
 * @fires Lien#load
 * @fires Lien#error
 * @fires Lien#serverError
 * @property {Promise<Lien>} ready Resolves after listening; rejects on startup failure.
 * @property {object} app The Express application.
 * @property {object} router The router for dynamic routes and add().
 * @property {object} beforeRequest The router for routes taking priority over static files.
 * @property {object} staticRouter The router serving public directories.
 * @property {import("node:http").Server|import("node:https").Server} server The underlying server.
 * @property {LienOptions} options The effective configuration, including the bound port.
 * @property {object} transformers Registered hook definitions, grouped by type and method.
 */
export default class Lien extends EventEmitter {

    /**
     * Creates the server. Routes can be registered before ready resolves.
     *
     * @param {LienOptions} [options={}] Server configuration.
     * @throws {Error} If synchronous setup, such as reading TLS certificates, fails.
     */
    constructor (options = {}) {
        super();

        this.options = {
            public: [],
            session: false,
            errorPages: {},
            logErrors: true,
            csrf: null,
            port: process.env.PORT || 3000,
            cookieSecret: randomBytes(32).toString("hex"),
            cookieOptions: {},
            bodyParserJson: true,
            bodyParserUrlEncoded: true,
            cookieParser: true,
            transformers: true,
            ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined))
        };

        const config = this.options;
        if (!Array.isArray(config.public)) {
            config.public = [
                ["/", config.public]
            ];
        }
        if (config.csrf === true) {
            config.csrf = {
                cookie: true
            };
        }

        this.csrf = config.csrf ? csrf(config.csrf) : null;
        this.express = express;
        this.app = express();
        this.app.disable("x-powered-by");
        this.app.set("query parser", "extended");

        if (config.views) {
            this.app.set("views", config.views.path);
            this.app.set("view engine", config.views.name);
        }

        if (config.bodyParserJson) {
            this.app.use(express.json(config.bodyParserJson === true ? {} : config.bodyParserJson));
        }
        if (config.bodyParserUrlEncoded) {
            this.app.use(express.urlencoded({
                extended: true,
                ...(config.bodyParserUrlEncoded === true ? {} : config.bodyParserUrlEncoded)
            }));
        }
        if (config.cookieParser) {
            this.app.use(cookieParser(config.cookieSecret, config.cookieOptions));
        }

        this.SessionStore = null;
        this.SessionStoreModule = null;
        this.app.use((req, res, next) => this.session ? this.session(req, res, next) : next());

        this.beforeRequest = express.Router();
        this.staticRouter = express.Router();
        this.router = express.Router();
        this.transformers = {
            before: Object.create(null),
            after: Object.create(null)
        };

        this.app.use(this.beforeRequest, this.staticRouter, this.router);
        for (const [url, localPath] of config.public) {
            this.addStaticPath(url, localPath);
        }

        if (config.ssl) {
            const { key, cert, _key, _cert } = config.ssl;
            this.server = createHttpsServer({
                key: _key ?? readFileSync(key),
                cert: _cert ?? readFileSync(cert)
            }, this.app);
        } else {
            this.server = createHttpServer(this.app);
        }

        queueMicrotask(() => {
            if (config.errorPages) {
                this.errorPages(config.errorPages);
            }
        });

        this.ready = this._start();
        this.ready.catch(error => {
            this.emit("load", error);
            if (this.listenerCount("error")) {
                this.emit("error", error);
            }
        });
    }

    /**
     * Initializes sessions, listens, and emits the successful load event.
     *
     * @private
     * @returns {Promise<Lien>} The listening server.
     * @throws {Error} If session initialization or listening fails.
     */
    async _start () {
        await configureSession(this);
        await new Promise((resolve, reject) => {
            const onError = error => {
                this.server.removeListener("listening", onListen);
                reject(error);
            };
            const onListen = () => {
                this.server.removeListener("error", onError);
                resolve();
            };
            this.server.once("error", onError);
            this.server.once("listening", onListen);
            this.server.listen({
                port: this.options.port,
                host: this.options.host
            });
        });
        this.options.port = this.server.address().port;
        this.server.on("error", error => this.emit("serverError", error));
        this.emit("load", null);
        return this;
    }

    /**
     * Stops listening and closes stores created by Lien.
     * Repeated calls return the same shutdown promise. Supplied store instances remain owned by the caller.
     *
     * @returns {Promise<void>} Resolves after shutdown.
     * @throws {Error} If the HTTP server or an owned store cannot be closed.
     */
    close () {
        return this._closing ??= this._shutdown();
    }

    /**
     * Releases server resources, including after a startup failure.
     *
     * @private
     * @returns {Promise<void>} Resolves when cleanup finishes.
     */
    async _shutdown () {
        try {
            await this.ready;
        } catch {
            /* A store may exist even if listening failed. */
        }
        try {
            if (this.server.listening) {
                await new Promise((resolve, reject) => {
                    this.server.close(error => error ? reject(error) : resolve());
                    this.server.closeIdleConnections();
                });
            }
        } finally {
            await this._ownedSessionStore?.close?.();
        }
    }

    /**
     * Mounts a public directory. Static requests do not execute route hooks.
     *
     * @param {string} url The mount URL.
     * @param {string} localPath The local directory.
     * @returns {void}
     */
    addStaticPath (url, localPath) {
        this.staticRouter.use(url, express.static(localPath));
    }

    /**
     * Invokes a handler or serves a file, forwarding failures to Express.
     *
     * @private
     * @param {LienObj} lien The request object.
     * @param {RouteOutput} output The handler or public filename.
     * @param {Array<*>} args Arguments passed to the handler.
     * @returns {Promise<void>}
     */
    async _invokeRoute (lien, output, args) {
        try {
            if (typeof output === "string") {
                await lien.file(output);
            } else {
                await output.apply(this, args);
            }
        } catch (error) {
            lien.next(asError(error, "Route failed."));
        }
    }

    /**
     * Creates a request object and invokes a route without before hooks.
     *
     * @private
     * @param {object} req The Express request.
     * @param {object} res The Express response.
     * @param {RouteOutput} output The handler or public filename.
     * @param {Array<*>} [args=[]] Extra handler arguments after lien.
     * @param {Function} [next] The next Express middleware.
     * @returns {Promise<void>}
     */
    _handleRoute (req, res, output, args = [], next = () => {}) {
        const lien = new LienObj(req, res, next, this);
        return this._invokeRoute(lien, output, [lien, ...args]);
    }

    /**
     * Invokes a route using the object already processed by before hooks.
     *
     * @private
     * @param {LienObj} lien The request object.
     * @param {RouteOutput} output The handler or public filename.
     * @returns {Promise<void>}
     */
    _handleLienRoute (lien, output) {
        return this._invokeRoute(lien, output, [lien]);
    }

    /**
     * Runs before hooks and invokes the route unless the request ended or delegated.
     *
     * @private
     * @param {object} req The Express request.
     * @param {object} res The Express response.
     * @param {RouteOutput} output The handler or public filename.
     * @param {Function} next The next Express middleware.
     * @returns {Promise<void>}
     */
    async _dispatch (req, res, output, next) {
        const lien = new LienObj(req, res, next, this);
        try {
            await lien._runHooks("before", lien);
            if (!lien._ending && !lien._nextCalled && !res.headersSent && !res.destroyed) {
                await this._handleLienRoute(lien, output);
            }
        } catch (error) {
            lien._hookError(error);
        }
    }

    /**
     * Registers a route. With two arguments, the second is the output and all methods are handled.
     * Object-form before and after options are Express middleware, not Lien hooks.
     *
     * @param {RoutePattern} url The route pattern.
     * @param {string|RouteOptions|RouteOutput} method The method, route options, or output.
     * @param {RouteOutput} [output] The handler or public filename.
     * @returns {void}
     */
    addPage (url, method, output) {
        if (output === undefined) {
            output = method;
            method = "all";
        }
        const route = typeof method === "object" ? method : {};
        method = route.method ?? method;
        const router = typeof url === "string" && url.includes(":") ? this.router : this.beforeRequest;
        const { regexp, restoreParams } = compileRoute(url);
        const before = [this.csrf, ...[route.before ?? []].flat()].filter(Boolean);
        const after = [route.after ?? []].flat().filter(Boolean);
        router[method](regexp, restoreParams, ...before, (req, res, next) => this._dispatch(req, res, output, next), ...after);
    }

    /**
     * Appends not-found and error handlers to the Express application.
     *
     * @param {ErrorPages} [options={}] Custom handlers or public filenames.
     * @returns {void}
     */
    errorPages (options) {
        configureErrorPages(this, options);
    }

    /**
     * Returns the matching hook pipeline, combining URL groups in registration order.
     *
     * @param {string} type The hook type, such as before, after, or custom:name.
     * @param {string} url The request path.
     * @param {string} method The lowercase HTTP method.
     * @returns {Hooks|null} A reusable pipeline, or null when no hooks match.
     */
    getHooks (type, url, method) {
        return getHooks(this.transformers, type, url, method);
    }

    /**
     * Returns hooks registered with the same compiled pattern.
     *
     * @param {string} type The hook type.
     * @param {RoutePattern} url The registered pattern.
     * @param {string} method The lowercase HTTP method.
     * @returns {Hooks|null} The matching pipeline, or null.
     */
    getHooksStrict (type, url, method) {
        return getHooks(this.transformers, type, url, method, true);
    }

    /**
     * Inserts a native hook pipeline. External Transformer instances are not accepted.
     *
     * @param {string} type The hook type, including custom:name.
     * @param {RoutePattern} url The hook pattern.
     * @param {string} method The lowercase HTTP method.
     * @param {Hooks} pipeline The pipeline to insert.
     * @returns {Hooks} The inserted pipeline.
     * @throws {TypeError} If pipeline is not an instance of Hooks.
     */
    insertHook (type, url, method, pipeline) {
        return insertHook(this.transformers, type, url, method, pipeline);
    }

    /**
     * Registers hooks for a pattern, URL array, or wildcard.
     * Omitting the method applies to all HTTP methods. Returns the server for chaining.
     *
     * @param {string} where The hook type: before, after, or custom:name.
     * @param {RoutePattern} url The hook pattern or patterns.
     * @param {string|import("./hooks.js").HookCallback} method The method or callback.
     * @param {import("./hooks.js").HookCallback|import("./hooks.js").HookMode} [callback] The callback, or mode when the method is omitted.
     * @param {import("./hooks.js").HookMode} [mode=3] The execution mode.
     * @returns {Lien} The server.
     * @throws {Error} If the hook type, callback, or mode is invalid.
     */
    hook (where, url, method, callback, mode) {
        if (!this.options.transformers) {
            console.warn("Transformers are disabled.");
        }
        if (typeof method === "function") {
            mode = callback ?? mode;
            callback = method;
            method = "all";
        }
        if (method === "all") {
            for (const name of methods) {
                this.hook(where, url, name, callback, mode);
            }
            return this;
        }
        if (Array.isArray(url)) {
            for (const item of url) {
                this.hook(where, item, method, callback, mode);
            }
            return this;
        }
        if (typeof url === "string" && url.startsWith(":")) {
            url = `/${url}`;
        }
        if (!["before", "after", "custom"].includes(where.split(":")[0])) {
            throw new Error("The hook type should be 'before', 'after' or 'custom'.");
        }
        const pipeline = this.getHooksStrict(where, url, method) ?? this.insertHook(where, url, method, new Hooks());
        pipeline.add(callback, mode);
        return this;
    }

    /**
     * Registers hooks receiving lien before the route handler.
     *
     * @param {RoutePattern} url The hook pattern or patterns.
     * @param {string|import("./hooks.js").HookCallback} method The method or callback.
     * @param {import("./hooks.js").HookCallback|import("./hooks.js").HookMode} [callback] The callback, or mode when the method is omitted.
     * @param {import("./hooks.js").HookMode} [mode=3] The execution mode.
     * @returns {void}
     */
    before (url, method, callback, mode) {
        this.hook("before", url, method, callback, mode);
    }

    /**
     * Registers hooks receiving response data before end() sends it.
     *
     * @param {RoutePattern} url The hook pattern or patterns.
     * @param {string|import("./hooks.js").HookCallback} method The method or callback.
     * @param {import("./hooks.js").HookCallback|import("./hooks.js").HookMode} [callback] The callback, or mode when the method is omitted.
     * @param {import("./hooks.js").HookMode} [mode=3] The execution mode.
     * @returns {void}
     */
    after (url, method, callback, mode) {
        this.hook("after", url, method, callback, mode);
    }

    /**
     * Registers before hooks for a URL and its subpaths. Does not protect static files.
     *
     * @param {string} url The base URL.
     * @param {string|import("./hooks.js").HookCallback} method The method or callback.
     * @param {import("./hooks.js").HookCallback|import("./hooks.js").HookMode} [callback] The callback, or mode when the method is omitted.
     * @param {import("./hooks.js").HookMode} [mode=3] The execution mode.
     * @returns {void}
     */
    use (url, method, callback, mode) {
        url = url.replace(/\/$/, "");
        this.before([url, `${url}/(.*)`], method, callback, mode);
    }

    /**
     * Registers a handler without before hooks. end() still executes after hooks.
     *
     * @param {RoutePattern} url The route pattern.
     * @param {string|RouteHandler} method The HTTP method or handler; omitted methods mean all.
     * @param {RouteHandler} [callback] The handler when a method is provided.
     * @returns {void}
     */
    add (url, method, callback) {
        if (typeof method === "function") {
            callback = method;
            method = "all";
        }
        const { regexp, restoreParams } = compileRoute(url);
        this.router[method](regexp, restoreParams, (req, res, next) => this._handleRoute(req, res, callback, [], next));
    }
}
for (const method of ["all", ...methods]) {
    if (method in Lien.prototype) {
        continue;
    }
    /**
     * Registers a route for the named HTTP method, including all().
     *
     * @this {Lien}
     * @param {RoutePattern} url The route pattern.
     * @param {RouteOutput} output The handler or public filename.
     * @returns {void}
     */
    Lien.prototype[method] = function (url, output) {
        this.addPage(url, method, output);
    };
}

/**
 * Promise shared by repeated shutdown calls.
 * @name Lien#_closing
 * @type {Promise<void>|undefined}
 * @private
 */

/**
 * A store created by Lien and released during shutdown.
 * Supplied store instances are owned by their caller.
 * @name Lien#_ownedSessionStore
 * @type {object|undefined}
 * @private
 */

/**
 * Reports that listening succeeded or failed.
 * @event Lien#load
 * @param {Error|null} error The startup failure, or null on success.
 */

/**
 * Reports a startup failure when an error listener is registered.
 * @event Lien#error
 * @param {Error} error The startup failure.
 */

/**
 * Reports a request failure or an error from the listening server.
 * @event Lien#serverError
 * @param {Error} error The failure.
 * @param {object} [req] The Express request, when available.
 * @param {object} [res] The Express response, when available.
 */
