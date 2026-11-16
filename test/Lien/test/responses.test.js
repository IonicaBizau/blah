import assert from "node:assert/strict";
import test from "node:test";
import { withServer, request } from "./helpers.js";
import toBuffer from "../lib/to-buffer.js";
test("response helpers preserve statuses, explicit overrides, and header overloads", async () => {
    await withServer(server => {
        server.get("/created", lien => lien.status(201).end("created"));
        server.get("/override", lien => lien.status(201).end("accepted", 202));
        server.get("/headers", lien => lien.end("headers", 203, {
            "x-example": "yes"
        }));
        server.get("/empty", lien => lien.end(204, {
            "x-empty": "yes"
        }));
        server.get("/message", lien => lien.apiMsg("hello"));
        server.get("/error", lien => lien.apiError("no"));
    }, async (server, url) => {
        assert.equal((await request(`${url}/created`)).status, 201);
        assert.equal((await request(`${url}/override`)).status, 202);
        const headers = await request(`${url}/headers`);
        assert.equal(headers.status, 203);
        assert.equal(headers.headers["x-example"], "yes");
        const empty = await request(`${url}/empty`);
        assert.equal(empty.status, 204);
        assert.equal(empty.headers["x-empty"], "yes");
        assert.equal(empty.body, "");
        assert.deepEqual(JSON.parse((await request(`${url}/message`)).body), {
            message: "hello"
        });
        assert.equal((await request(`${url}/error`)).status, 422);
    });
});
test("serialization consistently produces buffers and surfaces unsupported values", () => {
    for (const [value, expected, type] of [
            [undefined, "", "html"],
            ["hello", "hello", "html"],
            ["<?xml version=\"1.0\"?>", "<?xml version=\"1.0\"?>", "xml"],
            [Buffer.from("bytes"), "bytes", "html"],
            [{
                ok: true
            }, "{\"ok\":true}", "json"],
            [false, "false", "json"],
            [null, "null", "json"]
        ]) {
        const result = toBuffer(value);
        assert(Buffer.isBuffer(result.buffer));
        assert.equal(result.buffer.toString(), expected);
        assert.equal(result.contentType, type);
    }
    const circular = {};
    circular.self = circular;
    assert.throws(() => toBuffer(circular));
    assert.throws(() => toBuffer(Symbol("unsupported")));
});
test("error objects and serialization failures produce safe error responses", async () => {
    await withServer(server => {
        server.get("/error", lien => lien.end(new Error("private detail")));
        server.get("/circular", lien => {
            const data = {};
            data.self = data;
            return lien.end(data);
        });
    }, async (server, url, errors) => {
        for (const name of ["error", "circular"]) {
            const result = await request(`${url}/${name}`);
            assert.equal(result.status, 500);
            assert.deepEqual(JSON.parse(result.body), {
                message: "500 — Internal Server Error"
            });
        }
        assert.equal(errors.length, 2);
    });
});
test("built-in body parsers handle JSON, forms, malformed input, and limits", async () => {
    await withServer(server => server.post("/body", lien => lien.end(lien.data)), async (server, url) => {
        const json = await request(`${url}/body`, "POST", {
            headers: {
                "content-type": "application/json"
            },
            body: "{\"value\":1}"
        });
        assert.deepEqual(JSON.parse(json.body), {
            value: 1
        });
        const form = await request(`${url}/body`, "POST", {
            headers: {
                "content-type": "application/x-www-form-urlencoded"
            },
            body: "nested[x]=1&list=a&list=b"
        });
        assert.deepEqual(JSON.parse(form.body), {
            nested: {
                x: "1"
            },
            list: ["a", "b"]
        });
        assert.equal((await request(`${url}/body`, "POST", {
            headers: {
                "content-type": "application/json"
            },
            body: "{"
        })).status, 400);
    });
    await withServer(server => server.post("/body", lien => lien.end("wrong")), async (server, url) => {
        assert.equal((await request(`${url}/body`, "POST", {
            headers: {
                "content-type": "application/json"
            },
            body: "{\"too\":\"large\"}"
        })).status, 413);
    }, {
        bodyParserJson: {
            limit: "4b"
        }
    });
    await withServer(server => server.post("/body", lien => lien.end({
        data: lien.data ?? null
    })), async (server, url) => {
        assert.deepEqual(JSON.parse((await request(`${url}/body`, "POST", {
            headers: {
                "content-type": "application/json"
            },
            body: "{\"ignored\":true}"
        })).body), {
            data: null
        });
    }, {
        bodyParserJson: false,
        bodyParserUrlEncoded: false
    });
});
test("headers and cookies preserve options when set, read, and removed", async () => {
    await withServer(server => {
        server.get("/headers", lien => {
            assert.equal(lien.header("x-request"), "request");
            assert.equal(lien.header()["x-request"], "request");
            lien.header({
                "x-response": "response"
            }).header("x-remove", "gone");
            lien.header("x-remove", null);
            lien.cookie("custom", "value", {
                path: "/custom",
                httpOnly: true
            });
            lien.cookie("gone", null, {
                path: "/custom",
                sameSite: "lax"
            });
            return lien.end(lien.cookie("incoming"));
        });
    }, async (server, url) => {
        const result = await request(`${url}/headers`, "GET", {
            headers: {
                "x-request": "request",
                cookie: "incoming=hello"
            }
        });
        assert.equal(result.body, "hello");
        assert.equal(result.headers["x-response"], "response");
        assert.equal(result.headers["x-remove"], undefined);
        assert(result.headers["set-cookie"].some(value => value.includes("custom=value; Path=/custom; HttpOnly")));
        assert(result.headers["set-cookie"].some(value => value.includes("gone=; Path=/custom;") && value.includes("SameSite=Lax")));
    });
});
test("redirects merge queries and preserve fragments and relative targets", async () => {
    await withServer(server => {
        server.get("/redirect", lien => lien.redirect("/destination?existing=1#section", {
            foo: "override",
            list: ["a", "b"]
        }));
        server.get("/relative", lien => lien.redirect("destination#section", true));
    }, async (server, url) => {
        assert.equal((await request(`${url}/redirect?foo=bar`)).headers.location, "/destination?existing=1&foo=override&list=a&list=b#section");
        assert.equal((await request(`${url}/relative?foo=bar`)).headers.location, "destination?foo=bar#section");
    });
});
