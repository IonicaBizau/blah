import path from "node:path";
import { realpath } from "node:fs/promises";
import { promisify } from "node:util";
import toBuffer from "./to-buffer.js";
import { asError, getData, mergeData } from "./utils.js";

/**
 * @typedef {object} ResponseData
 * @property {*} content The response body, mutated in place by after hooks.
 * @property {number} status The HTTP status.
 * @property {string} [contentType] The content type, inferred from content when omitted.
 * @property {Object<string, *>} headers Additional response headers.
 * @property {LienObj} lien The request producing the response.
 */

/**
 * Marks requests whose error responses must bypass after hooks.
 * @private
 * @type {symbol}
 */
export const hookError = Symbol("lien hook error");

/**
 * LienObj
 * Request and response helpers.
 *
 * @property {object} req The Express request.
 * @property {object} res The Express response.
 * @property {import("./server.js").default} server The Lien server.
 * @property {string} path The request path with its trailing slash removed, except for root.
 * @property {string} pathname The mounted request pathname.
 * @property {string} full_path The original URL, including its query string.
 * @property {string} host The request hostname.
 * @property {string} protocol The request protocol.
 * @property {string} domain The origin, including the Host header's port.
 * @property {string} href The origin and original URL.
 * @property {string} method The lowercase HTTP method.
 * @property {Object<string, *>} params The decoded route parameters.
 * @property {Object<string, *>} query The parsed query parameters.
 * @property {*} data The parsed request body.
 * @property {Object<string, *>} cookies The parsed cookies.
 * @property {object|undefined} session The current session, when enabled.
 * @property {Function} accepts Express content negotiation, bound to the request.
 */
export default class LienObj {

    /**
     * Creates the request object passed to route handlers and before hooks.
     *
     * @param {object} req The Express request.
     * @param {object} res The Express response.
     * @param {Function} next The next Express middleware.
     * @param {import("./server.js").default} server The Lien server.
     */
    constructor (req, res, next, server) {
        this.req = req;
        this.res = res;
        this.server = server;
        /**
         * The next Express middleware for this request.
         *
         * @private
         * @type {Function}
         */
        this._next = next;
        /**
         * Whether this request has already delegated to Express.
         *
         * @private
         * @type {boolean}
         */
        this._nextCalled = false;
        /**
         * Whether a response helper has claimed the response.
         *
         * @private
         * @type {boolean}
         */
        this._ending = false;
        this.path = req.path.replace(/\/$/, "") || "/";
        this.accepts = req.accepts.bind(req);
        this.host = req.hostname;
        this.params = req.params;
        this.query = req.query;
        this.pathname = req.baseUrl + req.path;
        this.full_path = req.originalUrl;
        this.method = req.method.toLowerCase();
        this.cookies = req.cookies ?? {};
        this.data = req.body;
        this.session = req.session;
        this.protocol = req.protocol;
        this.domain = `${req.protocol}://${req.get("host")}`;
        this.href = `${this.domain}${req.originalUrl}`;
    }

    /**
     * Returns a CSRF token, or an empty string when CSRF is disabled.
     *
     * @returns {string}
     */
    get csrfToken () {
        return this.req.csrfToken?.() ?? "";
    }

    /**
     * Returns the hidden CSRF input, or an empty string when CSRF is disabled.
     *
     * @returns {string}
     */
    get csrfInput () {
        return this.req.csrfToken ? `<input type="hidden" name="_csrf" value="${this.csrfToken}">` : "";
    }

    /**
     * Delegates to Express once and cancels remaining hook execution.
     *
     * @param {Error|string} [error] An error or an Express routing directive.
     * @param {*} [data] Additional data passed to the next middleware.
     * @returns {LienObj} This request object.
     */
    next (error, data) {
        if (this._nextCalled) {
            return this;
        }
        this._nextCalled = true;
        this._beforeHooks?.abort();
        this._afterHooks?.abort();
        this._next(error, data);
        return this;
    }

    /**
     * Forwards a hook failure and prevents error responses from repeating after hooks.
     *
     * @private
     * @param {*} error The failure reason.
     * @returns {void}
     */
    _hookError (error) {
        this.req[hookError] = true;
        this.next(asError(error));
    }

    /**
     * Claims the response so another helper cannot send it again.
     *
     * @private
     * @returns {boolean} Whether this response may be sent.
     */
    _beginResponse () {
        if (this._ending || this._nextCalled || this.res.headersSent || this.res.destroyed) {
            return false;
        }
        this._ending = true;
        return true;
    }

    /**
     * Runs matching hooks and removes cancellation listeners when execution ends.
     *
     * @private
     * @param {"before"|"after"} type The hook stage.
     * @param {LienObj|ResponseData} data The request or pending response.
     * @returns {Promise<void>}
     * @throws {Error} If a hook fails.
     */
    async _runHooks (type, data) {
        if (!this.server.options.transformers || this.req[hookError]) {
            return;
        }
        const hooks = this.server.getHooks(type, this.path, this.method);
        if (!hooks) {
            return;
        }
        const controller = new AbortController();
        const field = type === "before" ? "_beforeHooks" : "_afterHooks";
        this[field] = controller;
        const onClose = () => controller.abort();
        this.res.once("close", onClose);
        try {
            await hooks.run(data, {
                signal: controller.signal,
                isStopped: () => this._nextCalled || this.res.headersSent || this.res.destroyed || type === "before" && this._ending
            });
        } finally {
            this[field] = null;
            this.res.removeListener("close", onClose);
        }
    }

    /**
     * Redirects the client, optionally merging query parameters and preserving the fragment.
     *
     * @param {string} newUrl The redirect target.
     * @param {boolean|Object<string, *>} [query] True copies the request query; an object overrides its values.
     * @returns {LienObj} This request object.
     */
    redirect (newUrl, query) {
        if (!this._beginResponse()) {
            return this;
        }
        if (query) {
            const hashIndex = newUrl.indexOf("#");
            const hash = hashIndex < 0 ? "" : newUrl.slice(hashIndex);
            const target = hashIndex < 0 ? newUrl : newUrl.slice(0, hashIndex);
            const queryIndex = target.indexOf("?");
            const base = queryIndex < 0 ? target : target.slice(0, queryIndex);
            const params = new URLSearchParams(queryIndex < 0 ? "" : target.slice(queryIndex + 1));
            const extra = {
                ...this.query,
                ...(query === true ? {} : query)
            };
            for (const [key, value] of Object.entries(extra)) {
                params.delete(key);
                for (const item of Array.isArray(value) ? value : [value]) {
                    params.append(key, item ?? "");
                }
            }
            const encoded = params.toString();
            newUrl = `${base}${encoded ? `?${encoded}` : ""}${hash}`;
        }
        this.res.redirect(newUrl);
        return this;
    }

    /**
     * Renders a template and sends it without after hooks. Failures are forwarded to Express.
     *
     * @param {string} template The template name.
     * @param {object} [data] Template locals.
     * @returns {Promise<void>} Resolves after rendering and initiating the response.
     */
    async render (template, data) {
        if (!this._beginResponse()) {
            return;
        }
        try {
            const html = await promisify(this.res.render.bind(this.res))(template, data);
            if (!this.res.destroyed && !this._nextCalled) {
                this.res.send(html);
            }
        } catch (error) {
            this.next(asError(error));
        }
    }

    /**
     * Checks whether sessions are available and warns when they are disabled.
     *
     * @private
     * @returns {boolean}
     */
    _checkSessionSupport () {
        if (this.session) {
            return true;
        }
        console.warn("You're trying to use a session feature, but you didn't enable the session support.");
        return false;
    }

    /**
     * Initializes or updates application data in the current session.
     *
     * @param {object} data The session data to merge.
     * @returns {LienObj|undefined} This request object, or undefined when sessions are disabled.
     */
    startSession (data) {
        return this.setSessionData(data);
    }

    /**
     * Merges session data recursively without accepting prototype keys.
     *
     * @param {object} data New values; undefined entries leave existing values unchanged.
     * @returns {LienObj|undefined} This request object, or undefined when sessions are disabled.
     */
    setSessionData (data) {
        if (!this._checkSessionSupport()) {
            return;
        }
        this.session._sessionData = mergeData(this.session._sessionData, data);
        return this;
    }

    /**
     * Returns application session data or a nested field, preserving falsy values.
     *
     * @param {string} [field] A dot-separated field path.
     * @returns {*} The data, null for a missing field, or undefined when unavailable.
     */
    getSessionData (field) {
        if (!this._checkSessionSupport()) {
            return;
        }
        return field ? getData(this.session._sessionData, field) : this.session._sessionData;
    }

    /**
     * Removes the current session from its store.
     *
     * @returns {Promise<void>} Resolves after destruction, or immediately when sessions are disabled.
     * @throws {Error} If the store cannot destroy the session.
     */
    async destroySession () {
        if (!this._checkSessionSupport()) {
            return;
        }
        await promisify(this.session.destroy.bind(this.session))();
    }

    /**
     * Reads request headers or sets/removes response headers.
     * With no arguments, returns all request headers. A headers object sets multiple response headers.
     *
     * @param {string|Object<string, *>} [name] The header name or headers to set.
     * @param {string|Array<string>|number|null} [value] The response value; null removes the header.
     * @returns {LienObj|object|string|undefined} The request value, this object after setting, or undefined after removal.
     */
    header (name, value) {
        if (!name && !value) {
            return this.req.headers;
        }
        if (value === null) {
            return this.res.removeHeader(name);
        }
        if (value === undefined && typeof name === "string") {
            return this.req.get(name);
        }
        if (typeof name === "object") {
            this.res.set(name);
        } else {
            this.res.set(name, value);
        }
        return this;
    }

    /**
     * Sends a JSON response containing the message field, including after hooks.
     *
     * @param {*} message The message value.
     * @param {number} [status=200] The HTTP status.
     * @returns {Promise<void>|undefined} The response promise, or undefined if already responding.
     */
    apiMsg (message, status = 200) {
        return this.end({ message }, status);
    }

    /**
     * Sends an API error message, using an Error object's message when supplied.
     *
     * @param {string|Error} message The error message.
     * @param {number} [status=422] The HTTP status.
     * @returns {Promise<void>|undefined} The response promise, or undefined if already responding.
     */
    apiError (message, status = 422) {
        return this.apiMsg(message?.message ?? message, status);
    }

    /**
     * Runs after hooks, serializes content, and ends the response.
     * Also accepts end(content, status, headers) and end(status, headers).
     * A numeric first argument is a status, and an omitted status preserves res.statusCode.
     *
     * @param {*} [content] The response body or numeric status.
     * @param {number|Object<string, *>} [status] The status, or headers after a numeric first argument.
     * @param {string|Object<string, *>} [contentType] The content type or headers.
     * @param {Object<string, *>} [headers] Additional response headers.
     * @returns {Promise<void>|undefined} Resolves after hook processing; failures go to Express.
     */
    end (content, status, contentType, headers) {
        if (!this._beginResponse()) {
            return;
        }
        if (typeof contentType === "object") {
            headers = contentType;
            contentType = undefined;
        }
        if (typeof content === "number") {
            if (status && typeof status === "object") {
                headers = status;
            }
            status = content;
            content = "";
        }
        return this._finishResponse({
            content,
            status: status ?? this.res.statusCode,
            contentType: contentType ?? this.res.get("Content-Type"),
            headers: headers ?? {},
            lien: this
        });
    }

    /**
     * Processes after hooks and forwards hook or serialization failures to Express.
     *
     * @private
     * @param {ResponseData} data The pending response.
     * @returns {Promise<void>}
     */
    async _finishResponse (data) {
        try {
            if (data.content instanceof Error) {
                throw data.content;
            }
            await this._runHooks("after", data);
            if (!this._nextCalled && !this.res.destroyed && !this.res.writableEnded) {
                this._sendResponse(data);
            }
        } catch (error) {
            this._hookError(error);
        }
    }

    /**
     * Serializes and sends the prepared response without running hooks.
     *
     * @private
     * @param {ResponseData} data The prepared response.
     * @returns {void}
     * @throws {Error} If serialization or sending fails.
     */
    _sendResponse (data) {
        if (this.res.headersSent) {
            return;
        }
        const { buffer, contentType } = toBuffer(data.content);
        this.res.status(data.status);
        this.header(data.headers);
        this.res.type(data.contentType || contentType);
        this.res.end(buffer);
    }

    /**
     * Reads, sets, or clears a cookie. Clear operations preserve the supplied options.
     *
     * @param {string} name The cookie name.
     * @param {*} [value] The value to set; null clears the cookie.
     * @param {object} [options] Express cookie options, including path and domain.
     * @returns {*} The stored value when reading, or this request object when setting/clearing.
     */
    cookie (name, value, options) {
        if (value === undefined) {
            return this.cookies[name];
        }
        if (value === null) {
            this.res.clearCookie(name, options);
        } else {
            this.res.cookie(name, value, options);
        }
        return this;
    }

    /**
     * Serves a file inside a root, rejecting traversal and escaping symlinks.
     * Leading slashes are relative to the root. File errors are forwarded to Express.
     *
     * @param {string} filePath The rooted filename.
     * @param {string} [customRoot] The root directory; defaults to the first public directory.
     * @returns {Promise<void>} Resolves after serving or forwarding the error.
     */
    async file (filePath, customRoot = this.server.options.public[0]?.[1]) {
        if (!this._beginResponse()) {
            return;
        }
        try {
            if (typeof filePath !== "string" || typeof customRoot !== "string") {
                throw new TypeError("file() requires a filename and a configured public root.");
            }
            const root = await realpath(customRoot);
            const target = path.resolve(root, filePath.replace(/^[/\\]+/, ""));
            ensureContained(root, target);
            const filename = await realpath(target);
            ensureContained(root, filename);
            if (!this.res.destroyed && !this._nextCalled) {
                await promisify(this.res.sendFile.bind(this.res))(filename);
            }
        } catch (error) {
            this.next(asError(error));
        }
    }
}

/**
 * Verifies that a resolved filename stays within the configured root.
 *
 * @private
 * @param {string} root The absolute root.
 * @param {string} filename The absolute filename.
 * @returns {void}
 * @throws {Error} With status 403 if the filename escapes the root.
 */
function ensureContained (root, filename) {
    const relative = path.relative(root, filename);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        const error = new Error("File is outside the configured root.");
        error.status = 403;
        throw error;
    }
}

/**
 * Cancellation controller for the current before-hook execution.
 * @name LienObj#_beforeHooks
 * @type {AbortController|null|undefined}
 * @private
 */

/**
 * Cancellation controller for the current after-hook execution.
 * @name LienObj#_afterHooks
 * @type {AbortController|null|undefined}
 * @private
 */

/**
 * Express helpers that claim the response before sending it.
 *
 * @private
 * @type {Set<string>}
 */
const terminalMethods = new Set(["download", "json", "jsonp"]);
for (const method of ["append", "attachment", "download", "json", "jsonp", "links", "vary", "status"]) {
    /**
     * Calls the corresponding Express response helper and preserves chaining.
     * Includes append(), attachment(), download(), json(), jsonp(), links(), vary(), and status().
     *
     * @this {LienObj}
     * @param {...*} args Arguments accepted by the Express helper.
     * @returns {LienObj} This request object.
     */
    LienObj.prototype[method] = function (...args) {
        if (terminalMethods.has(method) && !this._beginResponse()) {
            return this;
        }
        this.res[method](...args);
        return this;
    };
}
