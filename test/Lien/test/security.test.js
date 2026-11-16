import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { withServer, request } from "./helpers.js";
test("CSRF validates ordinary and object-form routes with absent, invalid, and valid tokens", async () => {
    await withServer(server => {
        server.get("/token", lien => lien.end({
            token: lien.csrfToken,
            input: lien.csrfInput
        }));
        server.post("/plain", lien => lien.end("accepted"));
        server.addPage("/object", {
            method: "post",
            before: [(req, res, next) => next()]
        }, lien => lien.end("accepted"));
    }, async (server, url) => {
        const response = await request(`${url}/token`);
        const { token, input } = JSON.parse(response.body);
        assert(token);
        assert(input.includes("name=\"_csrf\""));
        const cookie = response.headers["set-cookie"].map(value => value.split(";")[0]).join("; ");
        for (const route of ["plain", "object"]) {
            assert.equal((await request(`${url}/${route}`, "POST")).status, 422);
            assert.equal((await request(`${url}/${route}`, "POST", {
                headers: {
                    cookie,
                    "x-csrf-token": "invalid"
                }
            })).status, 422);
            assert.equal((await request(`${url}/${route}`, "POST", {
                headers: {
                    cookie,
                    "x-csrf-token": token
                }
            })).body, "accepted");
        }
    }, {
        csrf: true
    });
});
test("file serving allows rooted paths and rejects traversal and escaping symlinks", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "lien-files-"));
    const root = path.join(directory, "public");
    try {
        await mkdir(root);
        await writeFile(path.join(root, "index.txt"), "public");
        await writeFile(path.join(directory, "secret.txt"), "private");
        await symlink(path.join(directory, "secret.txt"), path.join(root, "escape.txt"));
        await withServer(server => {
            server.get("/file", lien => lien.file(lien.query.name, root));
        }, async (server, url) => {
            const file = name => request(`${url}/file?name=${encodeURIComponent(name)}`);
            assert.equal((await file("index.txt")).body, "public");
            assert.equal((await file("/index.txt")).body, "public");
            assert.equal((await file("../secret.txt")).status, 403);
            assert.equal((await file("escape.txt")).status, 403);
            assert.equal((await file("missing.txt")).status, 404);
            assert.notEqual((await file(path.join(directory, "secret.txt"))).body, "private");
        });
    } finally {
        await rm(directory, {
            recursive: true,
            force: true
        });
    }
});
