import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import { setImmediate as tick } from "node:timers/promises";
import Lien from "../lib/index.js";
import { withServer, request } from "./helpers.js";

const { Hooks } = Lien;
const __dirname = import.meta.dirname;
const start = (hooks, data) => hooks.run(data);

/**
 * Waits for two executions before passing both to the release callback.
 *
 * @private
 * @param {function(Array<{data: *, next: Function}>): void} release Releases the waiting hooks.
 * @returns {import("../lib/hooks.js").HookCallback} The callback-style barrier hook.
 */
function barrier (release) {
    const waiting = [];
    return (data, next) => {
        waiting.push({ data, next });
        if (waiting.length === 2) {
            release(waiting);
        }
    };
}
test("legacy numeric/string modes preserve execution order and unordered batches", async () => {
    const events = [];
    const hook = name => (data, next) => {
        events.push(`${name}:start`);
        setImmediate(() => {
            events.push(`${name}:end`);
            next();
        });
    };
    const hooks = new Hooks().add(hook("ordered-1")).add(hook("unordered-1"), Hooks.UNORDERED).add(hook("unordered-2"), "UNORDERED").add(hook("parallel-1"), Hooks.PARALLEL).add(hook("ordered-2"), "ORDERED").add(hook("parallel-2"), "PARALLEL");
    await start(hooks, {});
    assert.deepStrictEqual(events, ["parallel-1:start", "parallel-1:end", "parallel-2:start", "parallel-2:end", "ordered-1:start", "ordered-1:end", "unordered-1:start", "unordered-2:start", "unordered-1:end", "unordered-2:end", "ordered-2:start", "ordered-2:end"]);
});
test("a prelude entry separates adjacent unordered groups", async () => {
    const events = [];
    const hooks = new Hooks().add((data, next) => {
        events.push("first");
        setImmediate(next);
    }, 2).add(() => {
        events.push("prelude");
    }, 1).add(() => {
        events.push("second");
    }, 2);
    await start(hooks, {});
    assert.deepStrictEqual(events, ["prelude", "first", "second"]);
});
test("pipeline snapshots isolate active runs from later registrations", async () => {
    let release;
    const hooks = new Hooks().add((data, next) => {
        release = next;
    });
    const data = {};
    const running = start(hooks, data);
    await tick();
    hooks.add(value => {
        value.later = true;
    });
    release();
    assert.strictEqual(await running, data);
    assert.strictEqual(data.later, undefined);
    const second = start(hooks, data);
    await tick();
    release();
    await second;
    assert.strictEqual(data.later, true);
});
test("reused and nested pipelines keep data local and emit end per execution", async () => {
    const ended = [];
    const child = new Hooks().add(barrier(waiting => waiting.forEach(item => item.next())));
    const hooks = new Hooks().add([child, data => {
        data.seen = data.id;
    }]);
    hooks.on("end", (err, data) => {
        assert.strictEqual(err, null);
        ended.push(data.id);
    });
    const [a, b] = await Promise.all([start(hooks, {
        id: "A"
    }), start(hooks, {
        id: "B"
    })]);
    assert.strictEqual(a.seen, "A");
    assert.strictEqual(b.seen, "B");
    assert.deepStrictEqual(ended.sort(), ["A", "B"]);
    const empty = new Hooks();
    const first = await new Promise(resolve => empty.start((err, data) => resolve(data)));
    const second = await new Promise(resolve => empty.start((err, data) => resolve(data)));
    assert.notStrictEqual(first, second);
});
test("synchronous, callback, and promise hooks finish once and ignore replacement values", async () => {
    let calls = 0;
    const hooks = new Hooks().add(data => {
        data.sync = true;
        return {
            replacement: true
        };
    }).add((data, next) => {
        next();
        next(new Error("late callback"));
        return Promise.reject(new Error("late rejection"));
    }).add(async data => {
        await tick();
        data.promise = true;
    }).add(() => {
        ++calls;
    });
    const data = {};
    await start(hooks, data);
    await tick();
    assert.deepStrictEqual(data, {
        sync: true,
        promise: true
    });
    assert.strictEqual(calls, 1);
});
test("invalid execution modes, external stateful objects, and pipeline cycles are rejected", async () => {
    const a = new Hooks(),
        b = new Hooks().add(a);
    assert.throws(() => a.add(b), /cycles/);
    assert.throws(() => a.add(() => {}, "unknown"), /mode/);
    assert.throws(() => a.add(() => {}, 9), /mode/);
    assert.throws(() => a.add({
        start () {}
    }), /Lien.Hooks/);
});
test("falsy thrown values and promise rejection reasons still fail hooks", async () => {
    for (const hook of [() => {
            throw null;
        }, () => Promise.reject()]) {
        let failure;
        try {
            await start(new Hooks().add(hook), {});
        } catch (err) {
            failure = err;
        }
        assert(failure instanceof Error);
    }
});
test("registration overloads, methods, arrays, wildcards, use, and response mutations remain compatible", async () => {
    await withServer(server => {
        server.before("*", lien => {
            lien.trace = ["global"];
        });
        server.hook("before", ["/api/:id", "/other/:id"], "get", lien => {
            lien.trace.push("specific");
        });
        server.use("/api/", (lien, next) => {
            lien.trace.push("use");
            next();
        });
        server.before("/api/:id", lien => {
            lien.trace.push("prelude");
        }, "PARALLEL");
        server.after("/api/:id", "get", async response => {
            await tick();
            response.status = 201;
            response.headers["x-hook"] = "yes";
            response.contentType = "json";
            response.content = {
                trace: response.lien.trace,
                id: response.lien.params.id
            };
        });
        server.get("/api/:id", lien => lien.end("original"));
        server.post("/api/:id", lien => lien.end(lien.trace));
        server.get("/other/:id", lien => lien.end(lien.trace));
    }, async (server, url, errors) => {
        const result = await request(`${url}/api/one`);
        assert.strictEqual(result.status, 201);
        assert.strictEqual(result.headers["x-hook"], "yes");
        assert(result.headers["content-type"].includes("application/json"));
        assert.deepStrictEqual(JSON.parse(result.body), {
            trace: ["global", "prelude", "specific", "use"],
            id: "one"
        });
        assert.deepStrictEqual(JSON.parse((await request(`${url}/api/one`, "POST")).body), ["global", "use", "prelude"]);
        assert.deepStrictEqual(JSON.parse((await request(`${url}/other/two`)).body), ["global", "specific"]);
        assert.strictEqual(errors.length, 0);
    });
});
test("use hooks run once for their base path and include subpaths", async () => {
    await withServer(server => {
        server.use("/scope", lien => {
            lien.hits = (lien.hits ?? 0) + 1;
        });
        server.get("/scope", lien => lien.end(String(lien.hits)));
        server.get("/scope/child", lien => lien.end(String(lien.hits)));
    }, async (server, url) => {
        assert.equal((await request(`${url}/scope`)).body, "1");
        assert.equal((await request(`${url}/scope/child`)).body, "1");
    });
});
test("lookup pipelines remain mutable; custom hook pipelines can be inserted and started", async () => {
    await withServer(server => {
        assert.strictEqual(server.getHooks("before", "/missing", "get"), null);
        server.before("/item/:id", "get", lien => {
            lien.value = "first";
        });
        const strict = server.getHooksStrict("before", "/item/:id", "get");
        assert.strictEqual(strict, server.getHooksStrict("before", "/item/:id", "get"));
        strict.add(lien => {
            lien.value += ":second";
        });
        server.getHooks("before", "/item/1", "get").add(lien => {
            lien.value += ":third";
        });
        server.get("/item/:id", lien => lien.end(lien.value));
    }, async (server, url) => {
        assert.strictEqual((await request(`${url}/item/1`)).body, "first:second:third");
        const custom = new Hooks().add(data => {
            data.custom = true;
        });
        assert.strictEqual(server.insertHook("custom:example", "*", "get", custom), custom);
        const data = await start(server.getHooks("custom:example", "/anything", "get"), {});
        assert.strictEqual(data.custom, true);
        assert.throws(() => server.insertHook("before", "*", "get", {
            start () {}
        }), /Lien.Hooks/);
    });
});
for (const type of ["before", "after"]) {
    test(`${type} hooks isolate deterministically overlapping requests`, async () => {
        await withServer(server => {
            server.hook(type, "/race/:id", "get", barrier(waiting => waiting.forEach(item => item.next())));
            server.hook(type, "/race/:id", "get", data => {
                if (type === "before") {
                    data.owner = data.params.id;
                } else {
                    data.content += `:${data.lien.params.id}`;
                }
            });
            server.get("/race/:id", lien => lien.end(type === "before" ? lien.owner : lien.params.id));
        }, async (server, url, errors) => {
            const [a, b] = await Promise.all([request(`${url}/race/A`), request(`${url}/race/B`)]);
            assert.strictEqual(a.body, type === "before" ? "A" : "A:A");
            assert.strictEqual(b.body, type === "before" ? "B" : "B:B");
            assert.strictEqual(errors.length, 0);
        });
    });
    test(`${type} hook errors stay within the failing concurrent request`, async () => {
        const failure = new Error("private error detail");
        await withServer(server => {
            server.hook(type, "/race/:id", "get", barrier(waiting => waiting.forEach(({ data, next }) => {
                const lien = type === "before" ? data : data.lien;
                next(lien.params.id === "A" ? failure : null);
            })));
            server.get("/race/:id", lien => lien.end(lien.params.id));
        }, async (server, url, errors) => {
            const [a, b] = await Promise.all([request(`${url}/race/A`), request(`${url}/race/B`)]);
            assert.strictEqual(a.status, 500);
            assert(!a.body.includes(failure.message));
            assert.strictEqual(b.status, 200);
            assert.strictEqual(b.body, "B");
            assert.deepStrictEqual(errors, [failure]);
        });
    });
    for (const kind of ["throw", "callback throw", "callback error", "promise rejection"]) {
        test(`${type} hooks forward ${kind} once without re-entering error hooks`, async () => {
            const failure = new Error("private error detail");
            let calls = 0,
                later = 0;
            const fail = {
                "throw": () => {
                    ++calls;
                    throw failure;
                },
                "callback throw": (data, next) => {
                    ++calls;
                    throw failure;
                },
                "callback error": (data, next) => {
                    ++calls;
                    setImmediate(() => next(failure));
                },
                "promise rejection": async () => {
                    ++calls;
                    await tick();
                    throw failure;
                }
            } [kind];
            await withServer(server => {
                server.hook(type, "/failure", "get", fail);
                server.hook(type, "/failure", "get", () => {
                    ++later;
                });
                server.get("/failure", lien => lien.end("unreachable success"));
            }, async (server, url, errors) => {
                const result = await request(`${url}/failure`);
                assert.strictEqual(result.status, 500);
                assert(!result.body.includes(failure.message));
                assert.strictEqual(calls, 1);
                assert.strictEqual(later, 0);
                assert.deepStrictEqual(errors, [failure]);
            });
        });
    }
    test(`${type} hooks stop after a client disconnects`, async () => {
        let entered;
        const pendingHook = new Promise(resolve => {
            entered = resolve;
        });
        let later = 0;
        await withServer(server => {
            server.hook(type, "/abort", "get", (data, next) => {
                const res = type === "before" ? data.res : data.lien.res;
                entered({
                    next,
                    closed: new Promise(resolve => res.once("close", resolve))
                });
            });
            server.hook(type, "/abort", "get", () => {
                ++later;
            });
            server.get("/abort", lien => lien.end("original"));
        }, async (server, url, errors) => {
            const req = http.get(`${url}/abort`);
            req.on("error", () => {});
            const pending = await pendingHook;
            req.destroy();
            await pending.closed;
            pending.next();
            await tick();
            assert.strictEqual(later, 0);
            assert.strictEqual(errors.length, 0);
        });
    });
}
for (const callbackStyle of [false, true]) {
    test(`before hooks ending the response stop the chain (${callbackStyle ? "callback" : "sync"})`, async () => {
        let later = 0;
        await withServer(server => {
            server.before("/stop", "get", callbackStyle ? (lien, next) => {
                setImmediate(() => lien.end("stopped"));
            } : lien => lien.end("stopped"));
            server.before("/stop", "get", () => {
                ++later;
            });
            server.get("/stop", lien => {
                ++later;
                lien.end("wrong");
            });
        }, async (server, url) => {
            assert.strictEqual((await request(`${url}/stop`)).body, "stopped");
            await tick();
            assert.strictEqual(later, 0);
        });
    });
}
test("lien.next delegates once and cancels the remaining before hooks", async () => {
    let later = 0,
        fallback = 0;
    await withServer(server => {
        server.before("/delegate", "get", (lien, next) => {
            lien.next();
            next();
            lien.next();
        });
        server.before("/delegate", "get", () => {
            ++later;
        });
        server.get("/delegate", lien => {
            ++later;
            lien.end("wrong");
        });
        server.add("/delegate", "get", lien => {
            ++fallback;
            lien.end("fallback");
        });
    }, async (server, url) => {
        assert.strictEqual((await request(`${url}/delegate`)).body, "fallback");
        await tick();
        assert.strictEqual(later, 0);
        assert.strictEqual(fallback, 1);
    });
});
test("response helpers and raw responses stop subsequent before hooks", async () => {
    let later = 0;
    const handlers = {
        file: lien => lien.file("index.html", `${__dirname}/public`),
        render: lien => lien.render("main", {
            page: "Hook"
        }),
        download: lien => lien.download(`${__dirname}/public/index.html`),
        json: lien => lien.json({
            stopped: true
        }),
        jsonp: lien => lien.jsonp({
            stopped: true
        }),
        redirect: lien => lien.redirect("/destination"),
        raw: lien => lien.res.end("raw")
    };
    await withServer(server => {
        Object.keys(handlers).forEach(name => {
            const path = `/stop/${name}`;
            server.before(path, "get", handlers[name]);
            server.before(path, "get", () => {
                ++later;
            });
            server.get(path, lien => {
                ++later;
                lien.end("wrong");
            });
        });
    }, async (server, url, errors) => {
        for (const name of Object.keys(handlers)) {
            const result = await request(`${url}/stop/${name}`);
            assert.strictEqual(result.status, name === "redirect" ? 302 : 200);
            assert(!result.body.includes("wrong"));
        }
        await tick();
        assert.strictEqual(later, 0);
        assert.strictEqual(errors.length, 0);
    }, {
        views: {
            path: `${__dirname}/views`,
            name: "ajs"
        }
    });
});
test("after hooks can delegate without sending the pending response", async () => {
    let later = 0;
    await withServer(server => {
        server.after("/delegate", "get", response => response.lien.next());
        server.after("/delegate", "get", () => {
            ++later;
        });
        server.get("/delegate", lien => lien.end("wrong"));
        server.add("/delegate", "get", lien => lien.json({
            fallback: true
        }));
    }, async (server, url, errors) => {
        assert.deepStrictEqual(JSON.parse((await request(`${url}/delegate`)).body), {
            fallback: true
        });
        await tick();
        assert.strictEqual(later, 0);
        assert.strictEqual(errors.length, 0);
    });
});
test("duplicate end calls do not start concurrent after-hook responses", async () => {
    let calls = 0;
    await withServer(server => {
        server.after("/once", "get", async () => {
            ++calls;
            await tick();
        });
        server.get("/once", lien => {
            lien.end("first");
            lien.end("second");
        });
    }, async (server, url) => {
        assert.strictEqual((await request(`${url}/once`)).body, "first");
        assert.strictEqual(calls, 1);
    });
});
test("exceptions from response helpers in before hooks reach error handling", async () => {
    const circular = {};
    circular.self = circular;
    await withServer(server => {
        server.before("/json-error", lien => lien.json(circular));
        server.get("/json-error", lien => lien.end("wrong"));
        server.before("/file-error", (lien, next) => lien.file("file", {}));
        server.get("/file-error", lien => lien.end("wrong"));
    }, async (server, url, errors) => {
        assert.strictEqual((await request(`${url}/json-error`)).status, 500);
        assert.strictEqual((await request(`${url}/file-error`)).status, 500);
        assert.strictEqual(errors.length, 2);
    });
});
test("errors sending an after-hook response use error handling", async () => {
    await withServer(server => {
        server.after("/invalid-status", response => {
            response.status = 9999;
        });
        server.get("/invalid-status", lien => lien.end("wrong"));
    }, async (server, url, errors) => {
        assert.strictEqual((await request(`${url}/invalid-status`)).status, 500);
        assert.strictEqual(errors.length, 1);
    });
});
test("transformers:false disables both before and after execution", async () => {
    let calls = 0;
    await withServer(server => {
        const warn = console.warn;
        try {
            console.warn = () => {};
            server.before("/disabled", () => {
                ++calls;
            });
            server.after("/disabled", () => {
                ++calls;
            });
        } finally {
            console.warn = warn;
        }
        server.get("/disabled", lien => lien.end("unchanged"));
    }, async (server, url) => {
        assert.strictEqual((await request(`${url}/disabled`)).body, "unchanged");
        assert.strictEqual(calls, 0);
    }, {
        transformers: false
    });
});
test("route middleware remains Express middleware; promise route failures use error handling", async () => {
    const failure = new Error("route failure");
    await withServer(server => {
        server.before("/route", lien => {
            lien.value = lien.req.value;
        });
        server.addPage("/route", {
            method: "get",
            before: (req, res, next) => {
                req.value = "middleware";
                next();
            }
        }, lien => lien.end(lien.value));
        server.before("/reject", () => {});
        server.get("/reject", async () => {
            await tick();
            throw failure;
        });
        server.before("/throw", () => {});
        server.get("/throw", () => {
            throw failure;
        });
    }, async (server, url, errors) => {
        assert.strictEqual((await request(`${url}/route`)).body, "middleware");
        assert.strictEqual((await request(`${url}/reject`)).status, 500);
        assert.strictEqual((await request(`${url}/throw`)).status, 500);
        assert.deepStrictEqual(errors, [failure, failure]);
    });
});
test("string routes still serve files after before hooks and forward setup errors", async () => {
    let calls = 0;
    await withServer(server => {
        server.before("/asset/:id", () => {
            ++calls;
        });
        server.get("/asset/:id", "test.html");
        server.before("/invalid/:id", () => {
            ++calls;
        });
        server.get("/invalid/:id", "test.html");
    }, async (server, url, errors) => {
        assert.strictEqual((await request(`${url}/asset/1`)).body, "test\n");
        server.options.public = [];
        assert.strictEqual((await request(`${url}/invalid/1`)).status, 500);
        assert.strictEqual(calls, 2);
        assert.strictEqual(errors.length, 1);
    }, {
        public: `${__dirname}/public`
    });
});

test("start() keeps callback completion, error, and cancellation behavior", async () => {
    const data = { value: 1 };
    const pipeline = new Hooks().add(async value => {
        await tick();
        value.value += 1;
    });

    await new Promise((resolve, reject) => {
        pipeline.start(data, (err, result) => {
            if (err) { return reject(err); }
            assert.strictEqual(result, data);
            assert.strictEqual(result.value, 2);
            resolve();
        });
    });

    const failure = new Error("failed hook");
    const failing = new Hooks().add(async () => { throw failure; });
    await new Promise(resolve => {
        failing.start(data, (err, result) => {
            assert.strictEqual(err, failure);
            assert.strictEqual(result, data);
            resolve();
        });
    });

    let calls = 0;
    const pending = new Hooks().add((value, next) => {});
    await new Promise(resolve => {
        const cancel = pending.start(data, (err, result) => {
            assert.strictEqual(err, null);
            assert.strictEqual(result, data);
            ++calls;
            resolve();
        });
        cancel();
        cancel();
    });
    assert.strictEqual(calls, 1);
});
