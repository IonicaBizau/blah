"use strict";

const writeFile = require("write-file-trim")
    , path = require("path")
    , markdox = require("markdox")
    , isThere = require("is-there")
    , rJson = require("r-json")
    , wJson = require("w-json")
    , parentSearch = require("parent-search")
    , findFileInDirs = require("find-file-in-dirs")
    , ul = require("ul")
    , sameTime = require("same-time")
    , oneByOne = require("one-by-one")
    , deffy = require("deffy")
    , ejs = require("ejs")
    , ncp = require("ncp")
    , semver = require("semver")
    , abs = require("abs")
    , yearRange = require("year-range")
    , initialCommitDate = require("initial-commit-date")
    , currentYear = require("current-year")
    ;

// Constants
const BLAH_DIR = ".blah"
    , BLAH_TEMPLATES = ".blah-templates"
    , TEMPLATES = "templates"
    , PACKAGE_JSON = "package.json"
    , DOCUMENTATION_NAME = "DOCUMENTATION.md"
    , DOCUMENTATION_TMPL = "docs.ejs"
    , CONTRIBUTING_TMPL = "CONTRIBUTING.ejs"
    , CONTRIBUTING_NAME = "CONTRIBUTING.md"
    , README_TMPL = "README.ejs"
    , README_NAME = "README.md"
    , LICENSE_NAME = "LICENSE"
    , GITIGNORE_TMPL = "gitignore"
    , GITIGNORE = ".gitignore"
    ;

class Blah {

    /**
     * Blah
     * Creates a new `Blah` instance.
     *
     * @name Blah
     * @function
     * @param {String} cwd The Blah working directory (default: `process.cwd()`).
     */
    constructor (cwd) {
        // Blah working directory
        this.path = deffy(cwd, process.cwd());

        // .blah/
        this.blah_dir = path.join(this.path, BLAH_DIR);

        // ~/.blah-templates
        this.usr_templates = abs("~/" + BLAH_TEMPLATES);

        // templates/
        this.lib_templates = path.join(__dirname, TEMPLATES);

        this.templates = {};
        this.pack = {};
        this.paths = {};
    }

    /**
     * search
     * Searches a file in the blah directories.
     *
     * @name search
     * @function
     * @param {String} file The relative path to a file to search in the templates
     * directories (in the following order: local `.blah` directory,
     * `~/.blah-templates`, library templates).
     * @param {Function} callback The callback function.
     */
    search (file, callback) {
        findFileInDirs([

            // Local .blah/file
            this.blah_dir

            // Templates: ~/.blah-templates/file
          , this.usr_templates

            // Library templates: templates/file
          , this.lib_templates
        ], file, callback);
    }

    /**
     * prepare
     * Prepares the Blah data.
     *
     * @name prepare
     * @function
     * @param {Function} callback The callback function.
     */
    prepare (callback) {
        if (this.initialized) {
            return callback();
        }

        oneByOne([
            next => sameTime([
                cb => this.search(DOCUMENTATION_TMPL, cb)
              , cb => this.search(README_TMPL, cb)
              , cb => this.search(GITIGNORE_TMPL, cb)
              , cb => this.search(CONTRIBUTING_TMPL, cb)
              , cb => {
                    parentSearch(this.path, PACKAGE_JSON, cb);
                }
            ], next)
          , (next, data) => {
                this.paths.markdox = data[0];
                this.paths.readme = data[1];
                this.paths.gitignore = data[2];
                this.paths.contributing = data[3];
                this.paths.pack = data[4];
                next();
            }
          , next => {
                if (!this.paths.pack) {
                    return next(null, {});
                }
                rJson(this.paths.pack, (err, pack) => {
                    pack = deffy(pack, {});
                    next(null, pack);
                });
            }
          , (next, pack) => {
                this.pack = pack;
                this.pack.blah = deffy(this.pack.blah, {});
                this.copyright = {
                    fullname: this.pack.author
                  , year: new Date().getFullYear()
                  , project: this.pack.name
                  , description: this.pack.description
                };
                next();
            }
          , next => {
                initialCommitDate((err, d) => {
                    this.current_year = currentYear();
                    this.first_commit_year = err ? this.current_year : d.getFullYear();
                    this.license_year = yearRange(this.first_commit_year, this.current_year);
                    next();
                });
            }
        ], (err, data) => {
            this.initialized = true;
            callback(err, data);
        });
    }

    /**
     * init
     * Inits the `.blah` directory in the current project.
     *
     * @name init
     * @function
     * @param {Function} callback The callback function.
     */
    init (callback) {
        oneByOne([
            next => this.prepare(next)
          , next => this.search(next)
          , (next, path_templates) => {
                if (path_templates === this.blah_dir) {
                    return next(new Error("Refusing to override existing templates."));
                }
                ncp(path_templates, this.blah_dir, next);
            }
        ], callback);
    }

    /**
     * docs
     * Generates the DOCUMENTATION.md file, parsing the input files.
     *
     * @name docs
     * @function
     * @param {String} input Input file name (default: main file from package.json)
     * @param {String} output Output file name (default: `DOCUMENTATION.md`)
     * @param {Boolean} writeToFile If `false`, the docs will be returned via the
     * callback function, without writing the output file.
     * @param {Function} callback The callback function.
     */
    docs (input, output, writeToFile, callback) {
        input = deffy(input, "");

        if (typeof writeToFile === "function") {
            callback = writeToFile;
            writeToFile = true;
        }

        if (typeof output === "function") {
            callback = output;
            output = path.join(this.path, DOCUMENTATION_NAME);
        } else if (typeof output === "boolean") {
            writeToFile = output;
            output = null;
        }

        writeToFile = deffy(writeToFile, true);

        oneByOne([
            next => this.prepare(next)
          , next => {
                isThere(input, next.bind(this, null))
            }
          , (next, exists) => {
                if (!exists) {
                    if (writeToFile) {
                        return next(new Error("The input file does not exist."));
                    }
                    return next(null, "");
                }
                markdox.process(input, {
                    template: this.paths.markdox
                }, next);
            }
          , (next, content) => {
                content = content.split("\n").map(c => {
                    return c.trimRight();
                }).join("\n");
                if (writeToFile) {
                    writeFile(output, content, next);
                } else {
                    next(null, content);
                }
            }
        ], (err, result) => {
            if (err) { return callback(err); }
            callback(null, result.slice(-1)[0]);
        });
    }

    /**
     * readme
     * Creates the `README.md` file.
     *
     * @name readme
     * @function
     * @param {Function} callback The callback function
     */
    readme (callback) {
        oneByOne([
            next => this.prepare(next)
          , next => {
                this.docs(this.pack.blah.main || this.pack.main, false, next);
            }
          , (next, docs) => {
                this.render(this.paths.readme, {
                    docs: docs
                }, next);
            }
          , (err, content) => {
                writeFile(
                    path.join(this.path, README_NAME)
                  , content
                  , callback
                );
            }
        ], callback);
    }

    /**
     * gitignore
     * Creates the `.gitignore` file.
     *
     * @name gitignore
     * @function
     * @param {Function} callback The callback function.
     */
    gitignore (callback) {
        oneByOne([
            next => this.prepare(next)
          , next => {
                ncp(this.paths.gitignore, path.join(this.path, GITIGNORE), next);
            }
        ], callback);
    }

    /**
     * license
     * Creates the `LICENSE` file.
     *
     * @name license
     * @function
     * @param {String} license The license name.
     * @param {Function} callback The callback function.
     */
    license (license, callback) {
        license = license.toLowerCase();
        oneByOne([
            next => this.prepare(next)
          , next => {
                this.search("licenses/" + license + ".ejs", next);
            }
          , (next, licensepath) => {
                if (!this.copyright.fullname) {
                    return next(new Error("Cannot find the author name. Is the package.json file missing?"));
                }
                this.render(licensepath, next);
            }
          , (next, content) => {
                writeFile(
                    path.join(this.path, LICENSE_NAME)
                  , content
                  , next
                );
            }
        ], callback);
    }

    /**
     * render
     * Renders a template from file.
     *
     * @name render
     * @function
     * @param {String} path The template path.
     * @param {Object} data Additional data to merge into the template data.
     * @param {Function} callback The callback function.
     */
    render (path, data, callback) {
        if (typeof data === "function") {
            callback = data;
            data = {};
        }

        ejs.renderFile(path, ul.merge({
            _: this
          , require: require
        }, data), callback);
    }

    /**
     * contributing
     * Generates the `CONTRIBUTING.md` file.
     *
     * @name contributing
     * @function
     * @param {Function} callback The callback function.
     */
    contributing (callback) {
        oneByOne([
            next => this.prepare(next)
          , next => {
                this.render(this.paths.contributing, next);
            }
          , (next, content) => {
                writeFile(
                    path.join(this.path, CONTRIBUTING_NAME)
                  , content
                  , next
                );
            }
        ], callback);
    }

    /**
     * version
     * Bumps the provided version.
     *
     * @name version
     * @function
     * @param {String} what The version which should be bumped. It takes one of the following values: `"major"`, `"minor"`, `"patch"`. The default is `"patch"`.
     * @param {Function} callback The callback function.
     */
    version (what, callback) {
        if (typeof what === "function") {
            callback = what;
            what = "patch";
        }

        oneByOne([
            next => this.prepare(next)
          , next => {
                let version = this.pack.version;
                if (!version) {
                    return callback(new Error("Cannot find the version in the package.json file."));
                }
                this.pack.version = semver.inc(version, what);
                if (!this.pack.version) {
                    return next(new Error("Invalid version."));
                }
                wJson(this.paths.pack, this.pack, next);
            }
        ], callback);
    }
}

module.exports = Blah;
