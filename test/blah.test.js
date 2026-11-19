"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
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

test("search uses user templates between project and bundled templates", async t => {
    const { dir, blah } = project(t);
    fs.mkdirSync(blah.usr_templates);
    fs.writeFileSync(path.join(blah.usr_templates, "README.ejs"), "user template");
    assert.equal(await call(blah, "search", "README.ejs"),
        path.join(blah.usr_templates, "README.ejs"));

    fs.mkdirSync(path.join(dir, ".blah"));
    fs.writeFileSync(path.join(dir, ".blah", "README.ejs"), "project template");
    assert.equal(await call(blah, "search", "README.ejs"),
        path.join(dir, ".blah", "README.ejs"));
});

test("init copies bundled templates and preserves existing project templates", async t => {
    const { dir, blah } = project(t);
    await call(blah, "init");
    const readme = path.join(dir, ".blah", "README.ejs");
    assert.equal(fs.readFileSync(readme, "utf8"),
        fs.readFileSync(path.join(blah.lib_templates, "README.ejs"), "utf8"));
    fs.writeFileSync(readme, "custom template");
    await assert.rejects(call(blah, "init"), /Refusing to override existing templates/);
    assert.equal(fs.readFileSync(readme, "utf8"), "custom template");
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

test("docs preserves the multiline JSDoc return fields from the supplied example", async t => {
    const { blah } = project(t);
    const input = path.join(__dirname, "example-jsdocs.js");
    const content = await call(blah, "docs", input, false);

    assert.match(content, /### `parsePath\(url\)`/);
    assert.match(content, /### `parsePath\(url\)` <sup><small><kbd>function<\/kbd><\/small><\/sup>\n\nParses the input url\./);
    assert.doesNotMatch(content, /parsePath\(url\)`\nparsePath/);
    assert.match(content, /\*\*String\*\* `url`: The input url\./);
    assert.match(content, /#### Return\n- \*\*Object\*\* An object containing the following fields:/);
    for (const field of [
        "protocols", "protocol", "port", "resource", "host", "user",
        "password", "pathname", "hash", "search", "href", "query", "parse_failed"
    ]) {
        assert.match(content, new RegExp("^   - `" + field + "` \\(", "m"));
    }
});

test("docs follows local imports and requires once, including cycles", async t => {
    const { dir, blah } = project(t);
    fs.writeFileSync(path.join(dir, "index.js"), [
        "import { helper } from './helper.js';",
        "const other = require('./other');",
        "import 'external-package';"
    ].join("\n"));
    fs.writeFileSync(path.join(dir, "helper.js"), [
        "import './index.js';",
        "/**",
        " * @name helper",
        " * @function",
        " */",
        "export function helper() {}"
    ].join("\n"));
    fs.writeFileSync(path.join(dir, "other.js"), [
        "const helper = require('./helper');",
        "/**",
        " * @name other",
        " * @function",
        " */",
        "exports.other = function () {};"
    ].join("\n"));
    const content = await call(blah, "docs", path.join(dir, "index.js"), false);
    assert.equal((content.match(/### `helper\(/g) || []).length, 1);
    assert.equal((content.match(/### `other\(/g) || []).length, 1);
});

test("docs follows multiline imports, re-exports, dynamic imports, and directory indexes", async t => {
    const { dir, blah } = project(t);
    const nested = path.join(dir, "nested");
    fs.mkdirSync(nested);
    fs.writeFileSync(path.join(dir, "index.js"), [
        "import {",
        "  helper",
        "} from './nested/helper';",
        "export { item } from './nested';",
        "const core = require('./core.cjs');",
        "import('./lazy.mjs');"
    ].join("\n"));
    for (const [file, name] of [
        [path.join(nested, "helper.js"), "helper"],
        [path.join(nested, "index.js"), "item"],
        [path.join(dir, "core.cjs"), "core"],
        [path.join(dir, "lazy.mjs"), "lazy"]
    ]) {
        fs.writeFileSync(file, `/**\n * @name ${name}\n * @function\n */\nfunction ${name}() {}\n`);
    }
    const content = await call(blah, "docs", path.join(dir, "index.js"), false);
    for (const name of ["helper", "item", "core", "lazy"]) {
        assert.equal((content.match(new RegExp("### `" + name + "\\(", "g")) || []).length, 1);
    }
});

test("docs gives a fallback when reachable files have no JSDoc", async t => {
    const { dir, blah } = project(t);
    fs.writeFileSync(path.join(dir, "index.js"), [
        "require('./plain');",
        "require('./missing');",
        "require('external-package');"
    ].join("\n"));
    fs.writeFileSync(path.join(dir, "plain.js"), "module.exports = 1;\n");
    const content = await call(blah, "docs", path.join(dir, "index.js"), false);
    assert.match(content, /There is currently no API documentation/);
    assert.doesNotMatch(content, /#### Params|#### Properties/);
});

test("docs includes Lien imports and per-property JSDoc options", async t => {
    const { blah } = project(t);
    const content = await call(blah, "docs", path.join(__dirname, "Lien/lib/index.js"), false);
    const routeOptions = content.match(/### RouteOptions <sup><small><kbd>typedef<\/kbd><\/small><\/sup>\n([\s\S]*?)(?=\n### )/)[1];
    assert.match(routeOptions, /#### Properties/);
    assert.match(routeOptions, /\*\*string\*\* `method`: The lowercase HTTP method or all\./);
    assert.match(routeOptions, /\*\*Middleware\|Array\\<Middleware>\*\* `\[before\]`/);
    assert.match(routeOptions, /`\[after\]`: Express middleware reached when the handler delegates\./);
    const lienOptions = content.match(/### LienOptions <sup><small><kbd>typedef<\/kbd><\/small><\/sup>\n([\s\S]*?)(?=\n### )/)[1];
    const source = fs.readFileSync(path.join(__dirname, "Lien/lib/server.js"), "utf8");
    const sourceOptions = source.match(/@typedef \{object\} LienOptions([\s\S]*?)\*\//)[1];
    const propertyCount = (sourceOptions.match(/@property /g) || []).length;
    assert.equal((lienOptions.match(/^- \*\*/gm) || []).length, propertyCount);
    assert.match(lienOptions, /`\[session=false\]`: Session configuration\./);
    assert.match(lienOptions, /`\[errorPages=\{\}\]`: Custom error pages/);
    assert.match(content, /\*\*import\("node:http"\)\.Server\|import\("node:https"\)\.Server\*\* `server`/);
    assert.match(content, /### `addStaticPath\(url, localPath\)`/);
    assert.match(content, /### `addStaticPath\(url, localPath\)` <sup><small><kbd>method<\/kbd><\/small><\/sup>/);
    assert.match(content, /### `RouteHandler\(lien, args\)` <sup><small><kbd>callback<\/kbd><\/small><\/sup>/);
    assert.match(content, /### Lien <sup><small><kbd>class<\/kbd><\/small><\/sup>/);
    assert.match(content, /### `toBuffer\(data\)`/);
    assert.match(content, /### `toBuffer\(data\)` <sup><small><kbd>function<\/kbd><\/small><\/sup>/);
    assert.match(content, /### SerializedContent <sup><small><kbd>typedef<\/kbd><\/small><\/sup>\n\n#### Properties\n- \*\*Buffer\*\* `buffer`:/);
});

test("CLI includes Lien properties with an older custom documentation template", t => {
    const { dir } = project(t);
    fs.cpSync(path.join(__dirname, "Lien/lib"), path.join(dir, "lib"), { recursive: true });
    const local = path.join(dir, ".blah");
    fs.mkdirSync(local);
    const template = fs.readFileSync(path.join(__dirname, "../lib/templates/docs.ejs"), "utf8");
    fs.writeFileSync(path.join(local, "docs.ejs"), template.replace(
        /\s*<\? if \(comment\.propertyTags\.length > 0\) \{ \?>[\s\S]*?<\? \} \?>/,
        ""
    ));
    const result = spawnSync(process.execPath,
        [path.join(__dirname, "../bin/blah"), "-d", "lib/index.js"],
        { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /\.blah\/docs\.ejs as source/);
    const content = fs.readFileSync(path.join(dir, "DOCUMENTATION.md"), "utf8");
    const lienOptions = content.match(/### LienOptions <sup><small><kbd>typedef<\/kbd><\/small><\/sup>\n([\s\S]*?)(?=\n### )/)[1];
    assert.match(lienOptions, /#### Properties/);
    assert.match(lienOptions, /`\[session=false\]`: Session configuration\./);
    assert.match(lienOptions, /`\[errorPages=\{\}\]`: Custom error pages/);
});

test("CLI force generates the same docs as docs and reports generation errors", t => {
    const { dir } = project(t);
    const input = path.join(dir, "index.js");
    fs.writeFileSync(input, [
        "/**",
        " * Describes a value over",
        " * two source lines.",
        " * @name describe",
        " * @function",
        " * @param {String} value A wrapped",
        " * description.",
        " */",
        "function describe(value) {}"
    ].join("\n"));
    const cli = path.join(__dirname, "../bin/blah");
    const env = { ...process.env, HOME: dir };
    const run = (...args) => spawnSync(process.execPath, [cli, ...args],
        { cwd: dir, env, encoding: "utf8" });

    const direct = run("-d", "index.js");
    assert.equal(direct.status, 0, direct.stderr || direct.stdout);
    const expected = fs.readFileSync(path.join(dir, "DOCUMENTATION.md"), "utf8");
    const force = run("-f");
    assert.equal(force.status, 0, force.stderr || force.stdout);
    assert.equal(fs.readFileSync(path.join(dir, "DOCUMENTATION.md"), "utf8"), expected);
    assert.match(expected, /Describes a value over two source lines\./);
    assert.match(expected, /A wrapped description\./);

    fs.rmSync(input);
    const failed = run("-f");
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /The input file does not exist/);
});

test("docs still supports legacy Object types and multiline option descriptions", async t => {
    const { blah } = project(t);
    const content = await call(blah, "docs", path.join(__dirname, "jsdocs2.js"), false);
    assert.match(content, /\*\*Object\*\* `data`: The commit data containing:/);
    assert.match(content, /`_data` \(Object\): If this field is provided/);
    assert.match(content, /\*\*Object\|Undefined\*\* If no callback is provided/);
    assert.match(content, /### `getConfig\(callback\)` <sup><small><kbd>function<\/kbd><\/small><\/sup>\n\nFetches the configuration object/);
    assert.doesNotMatch(content, /### `record\(data, callback\)`\nremoveCommit/);
});

test("docs joins wrapped prose while preserving paragraphs and list items", async t => {
    const { dir, blah } = project(t);
    const input = path.join(dir, "index.js");
    fs.writeFileSync(input, [
        "/**",
        " * Describes a value over",
        " * two source lines.",
        " *",
        " * A separate paragraph stays separate.",
        " *",
        " * ```js",
        " * const first = 1;",
        " * const second = 2;",
        " * ```",
        " * @name describe",
        " * @function",
        " * @param {Object} options The options are",
        " * wrapped across lines:",
        " * - first: A first option",
        " *   with a wrapped explanation.",
        " * - second: Another option.",
        " * @return {String} A return value that",
        " * continues on the next line.",
        " */",
        "function describe(options) {}"
    ].join("\n"));
    const content = await call(blah, "docs", input, false);
    assert.match(content, /Describes a value over two source lines\.\n\nA separate paragraph/);
    assert.match(content, /```js\nconst first = 1;\nconst second = 2;\n```/);
    assert.match(content, /The options are wrapped across lines:\n- first: A first option with a wrapped explanation\.\n- second:/);
    assert.match(content, /A return value that continues on the next line\./);
});

test("docs keeps wrapped descriptions from the library on one Markdown line", async t => {
    const { blah } = project(t);
    const content = await call(blah, "docs", path.join(__dirname, "../lib/index.js"), false);
    assert.match(content, /Generates the DOCUMENTATION\.md file from the input and its local JavaScript imports and requires\./);
    assert.doesNotMatch(content, /Generates the DOCUMENTATION\.md file from the input and its local\nJavaScript/);
    assert.match(content, /The relative path to a file to search in the templates directories \(in the following order: local `\.blah` directory, `~\/\.blah-templates`, library templates\)\./);
});

test("docs keeps complex property types and joins wrapped property descriptions", async t => {
    const { dir, blah } = project(t);
    const input = path.join(dir, "index.js");
    fs.writeFileSync(input, [
        "/**",
        " * @typedef {Object<string, Array<{value: number}>>} Settings",
        " * @property {Array<{value: number}>} [items=[]] Items that are",
        " * described on two source lines.",
        " * @property {boolean} enabled Whether processing is enabled.",
        " */"
    ].join("\n"));
    const content = await call(blah, "docs", input, false);
    assert.match(content, /### Settings <sup><small><kbd>typedef<\/kbd><\/small><\/sup>/);
    assert.match(content, /\*\*Array\\<\{value: number}>\*\* `\[items=\[\]\]`: Items that are described on two source lines\./);
    assert.match(content, /\*\*boolean\*\* `enabled`: Whether processing is enabled\./);
    assert.equal((content.match(/#### Properties/g) || []).length, 1);
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
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "package.json"))).version, "2.0.0");
});

test("version reports a missing package version", async t => {
    const { blah } = project(t, { version: undefined });
    await assert.rejects(call(blah, "version"), /Cannot find the version/);
});
