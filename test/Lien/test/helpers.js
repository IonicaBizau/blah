import http from "node:http";
import { readFile } from "node:fs/promises";
import Lien from "../lib/index.js";

/**
 * Runs a test against an isolated server and always closes its connections.
 *
 * @private
 * @param {function(Lien): *} setup Registers routes and other test setup.
 * @param {function(Lien, string, Array<Error>): *} check Checks the server, URL, and captured request errors.
 * @param {import("../lib/server.js").LienOptions} [options] Server options.
 * @returns {Promise<void>}
 */
export async function withServer (setup, check, options) {
    const server = new Lien({
        host: "127.0.0.1",
        port: 0,
        logErrors: false,
        ...options
    });
    const errors = [],
        sockets = new Set();
    server.on("serverError", error => errors.push(error));
    server.server.on("connection", socket => {
        sockets.add(socket);
        socket.once("close", () => sockets.delete(socket));
    });
    // Test view engine.
    if (options?.views) {
        server.app.engine(options.views.name, (filename, data, callback) => {
            readFile(filename, "utf8").then(source => callback(null, source.replace(/<%=\s*page\s*%>/g, data.page)), callback);
        });
    }
    try {
        await setup(server);
        await server.ready;
        const url = `http://127.0.0.1:${server.server.address().port}`;
        await check(server, url, errors);
    } finally {
        sockets.forEach(socket => socket.destroy());
        await server.close();
    }
}

/**
 * Sends a test request with a timeout and collects the response body.
 *
 * @private
 * @param {string} url The request URL.
 * @param {string} [method="GET"] The HTTP method.
 * @param {object} [options={}] HTTP request options, plus an optional body.
 * @returns {Promise<{status: number, headers: object, body: string}>} The collected response.
 */
export async function request (url, method = "GET", options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, {
            method,
            agent: false,
            ...options,
            headers: {
                accept: "application/json",
                ...options.headers
            }
        }, res => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", chunk => body += chunk);
            res.on("error", reject);
            res.on("end", () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body
            }));
        });
        req.on("error", reject);
        req.setTimeout(2000, () => req.destroy(new Error("Test request timed out")));
        req.end(options.body);
    });
}
