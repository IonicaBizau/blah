"use strict";

const fs = require("fs");
const path = require("path");

// Follow only file references. Package imports and Node built-ins are not part of
// the project's source documentation.
function collect(input) {
    const files = [];
    const seen = new Set();

    function resolve(from, specifier) {
        if (!specifier.startsWith(".") && !path.isAbsolute(specifier)) return null;
        const base = path.resolve(path.dirname(from), specifier);
        const candidates = [base, base + ".js", base + ".mjs", base + ".cjs",
            path.join(base, "index.js"), path.join(base, "index.mjs"), path.join(base, "index.cjs")];
        return candidates.find(file => {
            try { return fs.statSync(file).isFile(); } catch (_) { return false; }
        }) || null;
    }

    function visit(file) {
        file = fs.realpathSync(file);
        if (seen.has(file)) return;
        seen.add(file);
        files.push(file);
        const source = fs.readFileSync(file, "utf8");
        const specs = [];
        const patterns = [
            /^\s*(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/gm,
            /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
            /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
        ];
        for (const pattern of patterns) {
            for (const match of source.matchAll(pattern)) specs.push([match.index, match[1]]);
        }
        specs.sort((a, b) => a[0] - b[0]);
        for (const [, specifier] of specs) {
            const dependency = resolve(file, specifier);
            if (dependency) visit(dependency);
        }
    }

    visit(input);
    return files;
}

module.exports = collect;
