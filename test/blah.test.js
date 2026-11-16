"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const Blah = require("../lib");

function project(t, pack = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blah-test-"));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
        name: "fixture-package",
        version: "1.2.3",
        description: "Fixture description",
        author: "Test Author",
        license: "MIT",
        main: "index.js",
        ...pack
    }));
    const blah = new Blah(dir);
    blah.usr_templates = path.join(dir, "user-templates");
    return { dir, blah };
}

function call(instance, method, ...args) {
    return new Promise((resolve, reject) => {
        instance[method](...args, (err, result) => err ? reject(err) : resolve(result));
    });
}

test("prepare loads package metadata and template paths once", async t => {
    const { dir, blah } = project(t);
    await call(blah, "prepare");
    assert.equal(blah.pack.name, "fixture-package");
    assert.equal(blah.paths.pack, path.join(dir, "package.json"));
    assert.equal(blah.paths.readme, path.join(blah.lib_templates, "README.ejs"));
    assert.equal(blah.copyright.fullname, "Test Author");
    assert.equal(blah.initialized, true);

    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "changed" }));
    await call(blah, "prepare");
    assert.equal(blah.pack.name, "fixture-package");
});

test("search prefers project templates over bundled templates", async t => {
    const { dir, blah } = project(t);
    const local = path.join(dir, ".blah");
    fs.mkdirSync(local);
    fs.writeFileSync(path.join(local, "README.ejs"), "local template");
    assert.equal(await call(blah, "search", "README.ejs"), path.join(local, "README.ejs"));
    assert.equal(await call(blah, "search", "CONTRIBUTING.ejs"),
        path.join(blah.lib_templates, "CONTRIBUTING.ejs"));
});

test("render combines project data, caller data, and the Blah instance", async t => {
    const { dir, blah } = project(t);
    const local = path.join(dir, ".blah");
    fs.mkdirSync(local);
    fs.writeFileSync(path.join(local, "data.js"),
        "module.exports = async () => ({ source: 'hook', shared: 'hook' });\n");
    const template = path.join(local, "custom.ejs");
    fs.writeFileSync(template, "<%= source %>|<%= shared %>|<%= _.pack.name %>");
    await call(blah, "prepare");
    assert.equal(await call(blah, "render", template, { shared: "caller" }),
        "hook|hook|fixture-package");
});

test("docs returns generated content without writing and rejects a missing input for file output", async t => {
    const { dir, blah } = project(t);
    const input = path.join(dir, "index.js");
    fs.writeFileSync(input, [
        "/**",
        " * Adds one to a number.",
        " * @name addOne",
        " * @function",
        " * @param {Number} value The input.",
        " */",
        "function addOne(value) { return value + 1; }"
    ].join("\n"));
    const content = await call(blah, "docs", input, false);
    assert.match(content, /addOne\(value\)/);
    assert.equal(fs.existsSync(path.join(dir, "DOCUMENTATION.md")), false);
    assert.equal(await call(blah, "docs", path.join(dir, "missing.js"), false), "");
    await assert.rejects(call(blah, "docs", path.join(dir, "missing.js"),
        path.join(dir, "DOCUMENTATION.md")), /input file does not exist/);

    const output = path.join(dir, "API.md");
    await call(blah, "docs", input, output, true);
    assert.match(fs.readFileSync(output, "utf8"), /addOne\(value\)/);
});

test("file generators write project files from bundled templates", async t => {
    const { dir, blah } = project(t);
    fs.writeFileSync(path.join(dir, "index.js"), "module.exports = 1;\n");
    await call(blah, "gitignore");
    await call(blah, "license", "MIT");
    await call(blah, "contributing");
    await call(blah, "readme");
    assert.match(fs.readFileSync(path.join(dir, ".gitignore"), "utf8"), /node_modules/);
    assert.match(fs.readFileSync(path.join(dir, "LICENSE"), "utf8"), /Test Author/);
    assert.match(fs.readFileSync(path.join(dir, "CONTRIBUTING.md"), "utf8"), /Contributing/);
    assert.match(fs.readFileSync(path.join(dir, "README.md"), "utf8"), /fixture-package/);
});

test("version bumps patch by default and accepts major and minor", async t => {
    const { dir, blah } = project(t);
    await call(blah, "version");
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "package.json"))).version, "1.2.4");
    await call(blah, "version", "minor");
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "package.json"))).version, "1.3.0");
    await call(blah, "version", "major");
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "package.json"))).version, "2.0.0");
    await assert.rejects(call(blah, "version", "invalid"), /Invalid version/);
});

test("version reports a missing package version", async t => {
    const { blah } = project(t, { version: undefined });
    await assert.rejects(call(blah, "version"), /Cannot find the version/);
});
