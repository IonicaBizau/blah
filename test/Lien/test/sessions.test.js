import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import session from "express-session";
import Lien from "../lib/index.js";
import { configurations } from "./fixtures/session-store.js";
import { withServer, request } from "./helpers.js";

const cookies = response => response.headers["set-cookie"].map(value => value.split(";")[0]).join("; ");
test("sessions respect their own secret, retain falsy values, merge data, and destroy asynchronously", async () => {
    const secret = "a private session signing secret with enough entropy";
    await withServer(server => {
        server.post("/set", lien => {
            lien.startSession({
                flag: false,
                count: 0,
                empty: "",
                nested: {
                    first: 1,
                    other: "keep"
                }
            });
            lien.setSessionData({
                nested: {
                    first: 2
                }
            });
            return lien.end(lien.getSessionData());
        });
        server.get("/read", lien => lien.end({
            flag: lien.getSessionData("flag"),
            count: lien.getSessionData("count"),
            empty: lien.getSessionData("empty"),
            missing: lien.getSessionData("missing"),
            first: lien.getSessionData("nested.first"),
            other: lien.getSessionData("nested.other")
        }));
        server.delete("/destroy", async lien => {
            await lien.destroySession();
            await lien.end("destroyed");
        });
    }, async (server, url, errors) => {
        assert.equal(server.options.session.secret, secret);
        const created = await request(`${url}/set`, "POST");
        const cookie = cookies(created);
        const signed = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
        const [id, signature] = signed.slice(2).split(".");
        assert.equal(signature, createHmac("sha256", secret).update(id).digest("base64").replace(/=+$/, ""));
        const read = await request(`${url}/read`, "GET", {
            headers: { cookie }
        });
        assert.deepEqual(JSON.parse(read.body), {
            flag: false,
            count: 0,
            empty: "",
            missing: null,
            first: 2,
            other: "keep"
        });
        assert.equal((await request(`${url}/destroy`, "DELETE", {
            headers: { cookie }
        })).body, "destroyed");
        assert.equal(JSON.parse((await request(`${url}/read`, "GET", {
            headers: { cookie }
        })).body).flag, null);
        assert.equal(errors.length, 0);
    }, {
        cookieSecret: "different cookie secret",
        session: { secret }
    });
});
test("default secrets are unique per server and explicit cookie secrets remain supported", async () => {
    const a = new Lien({
            port: 0,
            session: true
        }),
        b = new Lien({
            port: 0,
            session: true
        });
    try {
        await Promise.all([a.ready, b.ready]);
        assert.notEqual(a.options.cookieSecret, b.options.cookieSecret);
        assert.equal(a.options.session.secret, a.options.cookieSecret);
        assert(a.options.session.secret.length >= 64);
    } finally {
        await Promise.all([a.close(), b.close()]);
    }
    await withServer(() => {}, server => assert.equal(server.options.session.secret, "configured"), {
        cookieSecret: "configured",
        session: true
    });
});
test("session data cannot alter object prototypes through keys or getters", async () => {
    await withServer(server => {
        server.get("/data", lien => {
            lien.setSessionData(JSON.parse("{\"__proto__\":{\"polluted\":true},\"constructor\":{\"prototype\":{\"polluted\":true}},\"ok\":1}"));
            return lien.end({
                value: lien.getSessionData(),
                unsafe: lien.getSessionData("constructor.prototype")
            });
        });
    }, async (server, url) => {
        assert.deepEqual(JSON.parse((await request(`${url}/data`)).body), {
            value: {
                ok: 1
            },
            unsafe: null
        });
        assert.equal({}.polluted, undefined);
    }, {
        session: true
    });
});
test("session stores support instances, classes, async create providers, and legacy factories", async () => {
    const records = [];
    const providers = [new session.MemoryStore(), session.MemoryStore, {
        async create (options) {
            records.push(options);
            return new session.MemoryStore();
        }
    }, suppliedSession => {
        assert.equal(suppliedSession, session);
        return session.MemoryStore;
    }];
    for (const store of providers) {
        await withServer(server => server.get("/", lien => {
            lien.startSession({
                value: 1
            });
            return lien.end("ok");
        }), async (server, url) => assert.equal((await request(url)).body, "ok"), {
            session: {
                store,
                storeOptions: {
                    marker: true
                }
            }
        });
    }
    assert.deepEqual(records, [{
        marker: true
    }]);
});
test("string stores load ES modules before listening and configuration errors reject ready", async () => {
    await withServer(() => {}, server => assert(server.session), {
        session: {
            store: "../test/fixtures/session-store.js",
            storeOptions: {
                esm: true
            }
        }
    });
    assert.deepEqual(configurations.at(-1), {
        esm: true
    });
    const server = new Lien({
        port: 0,
        session: {
            store: "lien-nonexistent-session-store"
        }
    });
    await assert.rejects(server.ready, /Cannot load session store/);
    await server.close();
});
test("connect-mongo 6 uses create() and closes its owned client without a real database", async () => {
    let closed = 0;
    const client = {
        db: () => ({
            collection: () => ({})
        }),
        async close () {
            ++closed;
        }
    };
    const server = new Lien({
        port: 0,
        session: {
            store: "connect-mongo",
            storeOptions: {
                clientPromise: Promise.resolve(client),
                autoRemove: "disabled"
            }
        }
    });
    await server.ready;
    assert.equal(typeof server.options.session.store.get, "function");
    await Promise.all([server.close(), server.close()]);
    await server.close();
    assert.equal(closed, 1);
});
