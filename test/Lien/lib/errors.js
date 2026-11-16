/**
 * Selects HTML, JSON, or plain text for a built-in error response.
 *
 * @private
 * @param {import("./lien.js").default} lien The request object.
 * @param {string} message The public error message.
 * @param {number} status The HTTP status.
 * @returns {Promise<void>|undefined} The response operation, if it can still be sent.
 */
function sendError (lien, message, status) {
    if (lien.accepts("html")) {
        return lien.end(message, status);
    }

    if (lien.accepts("json")) {
        return lien.apiError(message, status);
    }
    return lien.end(message, status, "txt");
}

/**
 * Appends not-found, CSRF, and error middleware to the server.
 * Client errors retain their status. Internal errors use a generic public message.
 *
 * @param {import("./server.js").default} server The server to configure.
 * @param {import("./server.js").ErrorPages} [options={}] Custom handlers or public filenames.
 * @returns {void}
 * @private
 */
export function configureErrorPages (server, options = {}) {
    const pages = {
        notFound: lien => sendError(lien, "404 — Not found.", 404),
        serverError: (lien, error) => {
            const status = error.status ?? error.statusCode;
            const code = Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;
            return sendError(lien, code === 500 ? "500 — Internal Server Error" : `${code} — Invalid request.`, code);
        },
        badCsrf: lien => sendError(lien, "What‽ Your browser did something unexpected.", 422),
        ...options
    };
    server.app.use((req, res, next) => server._handleRoute(req, res, pages.notFound, [], next));
    server.app.use((error, req, res, next) => {
        if (res.headersSent) {
            return next(error);
        }
        if (error.code === "ENOENT" || error.status === 404 || error.statusCode === 404) {
            return server._handleRoute(req, res, pages.notFound, [error], next);
        }
        if (error.code === "EBADCSRFTOKEN") {
            return server._handleRoute(req, res, pages.badCsrf, [error], next);
        }
        server.emit("serverError", error, req, res);
        if (server.options.logErrors) {
            console.error(error.stack);
        }
        return server._handleRoute(req, res, pages.serverError, [error], next);
    });
}
