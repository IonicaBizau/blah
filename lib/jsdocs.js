"use strict";

const fs = require("fs");

function formatDescription(value) {
    const output = [];
    let previousWasBlock = false;
    let fence = null;
    for (const line of value.split("\n")) {
        const marker = /^\s*(```|~~~)/.exec(line);
        if (fence) {
            output.push(line);
            if (marker && marker[1] === fence) fence = null;
            previousWasBlock = true;
            continue;
        }
        if (marker) {
            output.push(line);
            fence = marker[1];
            previousWasBlock = true;
            continue;
        }
        if (!line.trim()) {
            if (output.length && output[output.length - 1] !== "") output.push("");
            previousWasBlock = false;
            continue;
        }
        const block = /^\s*(?:[-*+] |\d+[.)] |> |#{1,6} |\|)/.test(line) || /^ {4,}\S/.test(line);
        if (!block && output.length && output[output.length - 1] && !previousWasBlock) {
            output[output.length - 1] += " " + line.trim();
        } else {
            output.push(line);
        }
        previousWasBlock = block && !/^\s*(?:[-*+] |\d+[.)] )/.test(line);
    }
    return output.join("\n").trim();
}

function parseTag(line) {
    const match = /^@(\w+)\s*(.*)$/.exec(line);
    if (!match) return null;
    let rest = match[2];
    let type = "";
    if (rest.startsWith("{")) {
        let depth = 0;
        let end = -1;
        for (let i = 0; i < rest.length; i++) {
            if (rest[i] === "{") depth++;
            if (rest[i] === "}") {
                depth--;
                if (depth === 0) { end = i; break; }
            }
        }
        if (end !== -1) {
            type = rest.slice(1, end);
            rest = rest.slice(end + 1).trim();
        }
    }
    return { kind: match[1], type, rest };
}

function inferredName(after) {
    const code = after.replace(/^\s+/, "");
    const match = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:class|function)\s+([\w$]+)|^(?:async\s+)?(?:get\s+|set\s+)?([\w$]+)\s*\(|^([\w$.]+)\s*=/.exec(code);
    return match && (match[1] || match[2] || match[3].split(".").pop()) || "";
}

function parse(file) {
    const source = fs.readFileSync(file, "utf8");
    const javadoc = [];
    for (const match of source.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
        const lines = match[1].split("\n").map(line => line.replace(/^\s*\* ?/, "").trimEnd());
        const description = [];
        const tags = [];
        let current = null;
        for (const line of lines) {
            const tag = parseTag(line);
            if (tag) {
                tags.push(tag);
                current = tag;
            } else if (current) {
                current.rest += "\n" + line;
            } else {
                description.push(line);
            }
        }
        const named = tags.find(tag => tag.kind === "name" || tag.kind === "typedef" || tag.kind === "callback");
        const next = source.slice(match.index + match[0].length);
        const inferred = inferredName(next);
        const name = named ? named.rest.split(/\s/)[0] : inferred;
        if (!name || tags.some(tag => tag.kind === "ignore" || tag.kind === "private")) continue;
        if (named && (named.kind === "typedef" || named.kind === "callback")) {
            const extra = named.rest.slice(name.length).trim();
            if (extra) description.push(extra);
        }
        const firstDescriptionLine = description.findIndex(line => line.trim());
        if (firstDescriptionLine !== -1 &&
            [name, inferred].includes(description[firstDescriptionLine].trim())) {
            description.splice(firstDescriptionLine, 1);
        }
        const details = tags.filter(tag => ["param", "property", "return", "returns"].includes(tag.kind));
        const normalized = details.map(tag => {
            const isReturn = tag.kind === "return" || tag.kind === "returns";
            const parts = isReturn ? ["", "", tag.rest] : /^([^\s]+)\s*([\s\S]*)$/.exec(tag.rest) || ["", "", ""];
            return {
                kind: tag.kind,
                name: parts[1],
                description: formatDescription(parts[2]),
                joinedTypes: tag.type.replace(/</g, "\\<").replace(/\*/g, "\\*")
            };
        });
        const isFunction = tags.some(tag => tag.kind === "function" || tag.kind === "callback") ||
            /^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s/.test(next.trimStart());
        const isMethod = !isFunction && /^(?:async\s+)?[\w$]+\s*\(/.test(next.trimStart());
        const kindTag = tags.find(tag => ["typedef", "callback", "class", "function", "method", "namespace", "event", "interface", "module", "type"].includes(tag.kind));
        const isClass = /^(?:export\s+(?:default\s+)?)?class\s/.test(next.trimStart());
        const kind = kindTag ? kindTag.kind : isClass ? "class" : isMethod ? "method" : isFunction ? "function" : "value";
        const prose = formatDescription(description.join("\n"));
        javadoc.push({
            name,
            description: `<sup><small><kbd>${kind}</kbd></small></sup>` + (prose ? `\n\n${prose}` : ""),
            kind,
            isFunction,
            isMethod,
            paramTags: normalized.filter(tag => tag.kind === "param"),
            propertyTags: normalized.filter(tag => tag.kind === "property"),
            returnTags: normalized.filter(tag => tag.kind === "return" || tag.kind === "returns"),
            paramStr: normalized.filter(tag => tag.kind === "param").map(tag => tag.name.replace(/^\[|\]$/g, "")).join(", ")
        });
    }
    return { filename: file, javadoc };
}

module.exports = parse;
