import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import Lien, { Hooks, LienObj } from "lien";
import { withServer, request } from "./helpers.js";

const publicPath = `${import.meta.dirname}/public`;
const views = {
    path: `${import.meta.dirname}/views`,
    name: "ajs"
};

test("ESM default/named exports and CommonJS constructor API agree", () => {
    assert.equal(createRequire(import.meta.url)("lien"), Lien);
    assert.equal(Lien.Hooks, Hooks);
    assert.equal(Lien.LienObj, LienObj);
});
test("fixed routes, dynamic routes, static mounts, and templates", async () => {
    await withServer(server => {
        server.get("/", lien => lien.end("Hello World"));
        server.get("/post/:id", lien => lien.end(`Post id: ${lien.params.id}`));
        server.get("/test", "index.html");
        server.get("/templates/foo", lien => lien.render("main", {
            page: "Home"
        }));
    }, async (server, url, errors) => {
        assert.equal((await request(`${url}/`)).body, "Hello World");
        assert.equal((await request(`${url}/post/12`)).body, "Post id: 12");
        assert.equal((await request(`${url}/test`)).body, await readFile(`${publicPath}/index.html`, "utf8"));
        assert.equal((await request(`${url}/foo/`)).body, "html foo\n");
        assert.equal((await request(`${url}/test.html`)).body, "test\n");
        assert.equal((await request(`${url}/templates/foo`)).body, "<h1>Page: Home</h1>\n");
        assert.equal((await request(`${url}/missing`)).status, 404);
        assert.equal(errors.length, 0);
    }, {
        public: publicPath,
        views
    });
});
test("request fields include the actual host and assigned port", async () => {
    await withServer(server => {
        server.get("/fields/:id", lien => lien.end({
            href: lien.href,
            path: lien.path,
            full_path: lien.full_path,
            host: lien.host,
            protocol: lien.protocol,
            domain: lien.domain,
            query: lien.query,
            params: lien.params,
            method: lien.method,
            pathname: lien.pathname
        }));
    }, async (server, url) => {
        const result = await request(`${url}/fields/a%20b?foo=bar&nested[x]=1`);
        assert.deepEqual(JSON.parse(result.body), {
            href: `${url}/fields/a%20b?foo=bar&nested[x]=1`,
            path: "/fields/a%20b",
            full_path: "/fields/a%20b?foo=bar&nested[x]=1",
            host: "127.0.0.1",
            protocol: "http",
            domain: url,
            query: {
                foo: "bar",
                nested: {
                    x: "1"
                }
            },
            params: {
                id: "a b"
            },
            method: "get",
            pathname: "/fields/a%20b"
        });
    });
});
test("registering hooks after routes affects later requests", async () => {
    await withServer(server => {
        server.get("/post/:id", lien => lien.end(lien.tag ?? `Post id: ${lien.params.id}`));
    }, async (server, url) => {
        assert.equal((await request(`${url}/post/12`)).body, "Post id: 12");
        server.before("/post/:id", lien => {
            lien.tag = "1";
        });
        assert.equal((await request(`${url}/post/12`)).body, "1");
        server.before("(.*)", lien => {
            lien.tag += "1";
        });
        assert.equal((await request(`${url}/post/12`)).body, "11");
        server.after("/post/:id", async data => {
            data.content = "hi";
        });
        assert.equal((await request(`${url}/post/12`)).body, "hi");
    });
});
test("route delegation and fixed routes overriding static files retain their precedence", async () => {
    await withServer(server => {
        const articles = {
            a: "Hello World!",
            b: "Hello Mars!"
        };
        server.get("/foo/article/:id", lien => {
            if (articles[lien.params.id]) {
                return lien.end(articles[lien.params.id]);
            }
            lien.next();
        });
        server.get("/foo/bar", lien => lien.end("foo bar"));
        server.get("/foo/:dyn", lien => lien.end(`foo:${lien.params.dyn}`));
    }, async (server, url) => {
        assert.equal((await request(`${url}/foo/article/a`)).body, "Hello World!");
        assert.equal((await request(`${url}/foo/article/b`)).body, "Hello Mars!");
        assert.equal((await request(`${url}/foo/article/c`)).status, 404);
        assert.equal((await request(`${url}/foo/`)).body, "html foo\n");
        assert.equal((await request(`${url}/foo/bar`)).body, "foo bar");
        assert.equal((await request(`${url}/foo/baz`)).body, "foo:baz");
        server.get("/foo", lien => lien.end("foo index"));
        assert.equal((await request(`${url}/foo`)).body, "foo index");
        server.get("/:dynamic", lien => lien.end(`dynamic:${lien.params.dynamic}`));
        assert.equal((await request(`${url}/baz`)).body, "dynamic:baz");
        server.before(":foo(.*)", (lien, next) => lien.path.includes(".") ? lien.next() : next());
        assert.equal((await request(`${url}/test.html`)).body, "test\n");
    }, {
        public: publicPath
    });
});
test("legacy optional, repeated, regex, array, wildcard, and HEAD routes work on Express 5", async () => {
    await withServer(server => {
        server.get("/optional/:id?", lien => lien.end(lien.params));
        server.get("/repeat/:parts+", lien => lien.end(lien.params));
        server.get(/^\/regexp\/(\d+)$/, lien => lien.end(lien.params));
        server.addPage(["/one/:id", "/two/:id"], "get", lien => lien.end(lien.params));
        server.get("/wild/:rest(.*)", lien => lien.end(lien.params));
    }, async (server, url) => {
        assert.deepEqual(JSON.parse((await request(`${url}/optional`)).body), {});
        assert.deepEqual(JSON.parse((await request(`${url}/optional/1`)).body), {
            id: "1"
        });
        assert.deepEqual(JSON.parse((await request(`${url}/repeat/a/b`)).body), {
            parts: "a/b"
        });
        assert.deepEqual(JSON.parse((await request(`${url}/regexp/12`)).body), {
            0: "12"
        });
        assert.deepEqual(JSON.parse((await request(`${url}/two/2`)).body), {
            id: "2"
        });
        assert.deepEqual(JSON.parse((await request(`${url}/wild/a/b`)).body), {
            rest: "a/b"
        });
        assert.equal((await request(`${url}/optional/1`, "HEAD")).body, "");
    });
});
test("path-to-regexp 9 routes retain custom legacy constraints and accept optional groups", async () => {
    await withServer(server => {
        server.before("/digits/:id(\\d+)/:name", lien => {
            lien.label = "matched:";
        });
        server.get("/digits/:id(\\d+)/:name", lien => lien.end(`${lien.label}${lien.params.id}:${lien.params.name}`));
        server.get("/choice/:id((?:ab|cd)\\d+)", lien => lien.end(lien.params.id));
        server.get("/modern{/:id}", lien => lien.end(lien.params));
        server.addPage([/^\/raw\/(\d+)$/, "/named/:id"], "get", lien => lien.end(lien.params));
    }, async (server, url) => {
        assert.equal((await request(`${url}/digits/12/alice`)).body, "matched:12:alice");
        assert.equal((await request(`${url}/digits/no/alice`)).status, 404);
        assert.equal((await request(`${url}/choice/ab3`)).body, "ab3");
        assert.equal((await request(`${url}/choice/ef3`)).status, 404);
        assert.deepEqual(JSON.parse((await request(`${url}/modern`)).body), {});
        assert.deepEqual(JSON.parse((await request(`${url}/modern/7`)).body), { id: "7" });
        assert.deepEqual(JSON.parse((await request(`${url}/raw/4`)).body), { 0: "4" });
        assert.deepEqual(JSON.parse((await request(`${url}/named/5`)).body), { id: "5" });
    });
});
test("legacy catch-all routes retain their numeric capture", async () => {
    await withServer(server => {
        server.get("*", lien => lien.end(lien.params));
    }, async (server, url) => {
        assert.deepEqual(JSON.parse((await request(`${url}/anything`)).body), { 0: "/anything" });
    });
});
test("custom error pages, content negotiation, and middleware after delegation", async () => {
    await withServer(server => {
        server.addPage("/delegate", {
            method: "get",
            after: (req, res) => res.end("after middleware")
        }, lien => lien.next());
        server.get("/failure", async () => {
            throw new Error("internal detail");
        });
    }, async (server, url, errors) => {
        assert.equal((await request(`${url}/delegate`)).body, "after middleware");
        const json = await request(`${url}/failure`);
        assert.equal(json.status, 500);
        assert.deepEqual(JSON.parse(json.body), {
            message: "500 — Internal Server Error"
        });
        assert.equal((await request(`${url}/failure`, "GET", {
            headers: {
                accept: "text/html"
            }
        })).body, "500 — Internal Server Error");
        assert.equal(errors.length, 2);
    });
    await withServer(() => {}, async (server, url) => {
        const result = await request(`${url}/missing`);
        assert.equal(result.status, 404);
        assert.equal(result.body, "custom missing");
    }, {
        errorPages: {
            notFound: lien => lien.end("custom missing", 404)
        }
    });
});
test("startup errors reject ready and reach load/error listeners; close is awaitable", async () => {
    await withServer(() => {}, async owner => {
        const server = new Lien({
            host: "127.0.0.1",
            port: owner.options.port,
            logErrors: false
        });
        const loaded = [],
            failures = [];
        server.on("load", error => loaded.push(error));
        server.on("error", error => failures.push(error));
        await assert.rejects(server.ready, {
            code: "EADDRINUSE"
        });
        await server.close();
        assert.equal(loaded[0].code, "EADDRINUSE");
        assert.equal(failures[0], loaded[0]);
    });
    const server = new Lien({
        port: 0
    });
    await server.ready;
    await server.close();
    await server.close();
    assert.equal(server.server.listening, false);
});
