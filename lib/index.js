// Dependencies
var Barbe = require("barbe")
  , Fs = require("fs")
  , Path = require("path")
  , MarkDox = require("markdox")
  , IsThere = require("is-there")
  , ReadJson = require("r-json")
  , WriteJson = require("w-json")
  , ParentSearch = require("parent-search")
  , Streamp = require("streamp")
  , Ul = require("ul")
  , SameTime = require("same-time")
  , OneByOne = require("one-by-one")
  , Deffy = require("deffy")
  , Ejs = require("ejs")
  , Ncp = require("ncp")
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

/**
 * Blah
 * Creates a new `Blah` instance.
 *
 * @name Blah
 * @function
 * @param {String} path The Blah working directory (default: `process.cwd()`).
 */
function Blah(path) {

    // Blah working directory
    this.path = Deffy(path, process.cwd());

    // .blah/
    this.blah_dir = Path.join(this.path, BLAH_DIR);

    // ~/.blah-templates
    this.usr_templates = Path.join(Ul.home(), BLAH_TEMPLATES);

    // templates/
    this.lib_templates = Path.join(__dirname, TEMPLATES);

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
Blah.prototype.search = function (file, callback) {

    if (typeof file === "function") {
        callback = file;
        file = "";
    }

    var self = this
      , tries = [

            // Local .blah/file
            Path.join(self.blah_dir, file)

            // Templates: ~/.blah-templates/file
          , Path.join(self.usr_templates, file)

            // Library templates: templates/file
          , Path.join(self.lib_templates, file)
        ]
      ;

    SameTime(tries.map(function (cPath) {
        return function (cb) {
            IsThere(cPath, function (exists) {
                cb(null, cPath, exists);
            });
        }
    }), function (err, fields, exists) {
        if (err) { return callback(err); }
        for (var i = 0; i < exists.length; ++i) {
            if (exists[i]) {
                return callback(null, fields[i]);
            }
        }
        callback(new Error("Cannot find searched file: " + file));
    });
};

/**
 * prepare
 * Prepares the Blah data.
 *
 * @name prepare
 * @function
 * @param {Function} callback The callback function.
 */
Blah.prototype.prepare = function (callback) {
    var self = this;

    if (self.initialized) {
        return callback();
    }

    OneByOne([
        SameTime.bind(this, [
            self.search.bind(self, DOCUMENTATION_TMPL)
          , self.search.bind(self, README_TMPL)
          , self.search.bind(self, GITIGNORE_TMPL)
          , self.search.bind(self, CONTRIBUTING_TMPL)
          , function (cb) {
                ParentSearch(self.path, PACKAGE_JSON, cb);
            }
        ])
      , function (next, data) {
            self.paths.markdox = data[0];
            self.paths.readme = data[1];
            self.paths.gitignore = data[2];
            self.paths.contributing = data[3];
            self.paths.pack = data[4];
            next();
        }
      , function (next) {
            if (!self.paths.pack) {
                return next(null, {});
            }
            ReadJson(self.paths.pack, function (err, pack) {
                pack = Deffy(pack, {});
                next(null, pack);
            });
        }
      , function (next, pack) {
            self.pack = pack;
            self.pack.blah = Deffy(self.pack.blah, {});
            self.copyright = {
                fullname: self.pack.author
              , year: new Date().getFullYear()
              , project: self.pack.name
              , description: self.pack.description
            };
            next();
        }
    ], function (err, data) {
        self.initialized = true;
        callback(err, data);
    });
};

/**
 * init
 * Inits the `.blah` directory in the current project.
 *
 * @name init
 * @function
 * @param {Function} callback The callback function.
 */
Blah.prototype.init = function (callback) {
    var self = this;

    OneByOne([
        self.prepare.bind(self)
      , self.search.bind(self)
      , function (next, path_templates) {
            if (path_templates === self.blah_dir) {
                return next(new Error("Refusing to override existing templates."));
            }
            Ncp(path_templates, self.blah_dir, next);
        }
    ], callback);
};

/**
 * docs
 * Generates the DOCUMENTATION.md file, parsing the input files.
 *
 * @name docs
 * @function
 * @param {String} input Input file name (default: main file from package.json)
 * @param {String} output Output file name (default: `DOCUMENTATION.md`)
 * @param {Boolean} writeFile If `false`, the docs will be returned via the
 * callback function, without writing the output file.
 * @param {Function} callback The callback function.
 */
Blah.prototype.docs = function (input, output, writeFile, callback) {
    var self = this;

    input = Deffy(input, "");

    if (typeof writeFile === "function") {
        callback = writeFile;
        writeFile = true;
    }

    if (typeof output === "function") {
        callback = output;
        output = Path.join(self.path, DOCUMENTATION_NAME);
    } else if (typeof output === "boolean") {
        writeFile = output;
        output = null;
    }

    writeFile = Deffy(writeFile, true);

    OneByOne([
        self.prepare.bind(self)
      , function (next) {
            IsThere(input, next.bind(this, null))
        }
      , function (next, exists) {
            if (!exists) {
                if (writeFile) {
                    return next(new Error("The input file does not exist."));
                }
                return next(null, "");
            }
            MarkDox.process(input, {
                template: self.paths.markdox
            }, next);
        }
      , function (next, content) {
            content = content.split("\n").map(function (c) {
                return c.trimRight();
            }).join("\n");
            if (writeFile) {
                Fs.writeFile(output, content, next);
            } else {
                next(null, content);
            }
        }
    ], function (err, result) {
        if (err) { return callback(err); }
        callback(null, result.slice(-1)[0]);
    });
};

/**
 * readme
 * Creates the `README.md` file.
 *
 * @name readme
 * @function
 * @param {Function} callback The callback function
 */
Blah.prototype.readme = function (callback) {

    var self = this;

    OneByOne([
        self.prepare.bind(self)
      , function (next) {
            self.docs(self.pack.main, false, next);
        }
      , function (next, docs) {
            self.render(self.paths.readme, {
                docs: docs
            }, next);
        }
      , function (err, content) {
            Fs.writeFile(
                Path.join(self.path, README_NAME)
              , content.replace(/^\s+|\s+$/g, "").replace(/\n{3,}/g, "\n\n")
              , callback
            );
        }
    ], callback);
};

/**
 * gitignore
 * Creates the `.gitignore` file.
 *
 * @name gitignore
 * @function
 * @param {Function} callback The callback function.
 */
Blah.prototype.gitignore = function (callback) {
    var self = this;
    OneByOne([
        self.prepare.bind(self)
      , function (next) {
            Ncp(self.paths.gitignore, Path.join(self.path, GITIGNORE), next);
        }
    ], callback);
};

/**
 * license
 * Creates the `LICENSE` file.
 *
 * @name license
 * @function
 * @param {String} license The license name.
 * @param {Function} callback The callback function.
 */
Blah.prototype.license = function (license, callback) {
    var self = this;
    OneByOne([
        self.prepare.bind(self)
      , function (next) {
            var licensePath = Path.join(__dirname, "/licenses/", license.toLowerCase() + ".txt");
            if (!IsThere(licensePath)) {
                return next(new Error("There is no license named " + license));
            }
            if (!self.copyright.fullname) {
                return next(new Error("Cannot find the author name. Is the package.json file missing?"));
            }
            next(null, licensePath);
        }
      , function (next, licensePath) {
            Fs.readFile(licensePath, "utf-8", next);
        }
      , function (next, content) {
            content = Barbe(content, ["[", "]"], self.copyright);
            Fs.writeFile(Path.join(self.path, "LICENSE"), content, next);
        }
    ], callback);
};

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
Blah.prototype.render = function (path, data, callback) {
    var self = this;

    if (typeof data === "function") {
        callback = data;
        data = {};
    }

    Ejs.renderFile(path, Ul.merge({
        _: self
      , require: require
    }, data), callback);
};

/**
 * contributing
 * Generates the `CONTRIBUTING.md` file.
 *
 * @name contributing
 * @function
 * @param {Function} callback The callback function.
 */
Blah.prototype.contributing = function (callback) {
    var self = this;
    OneByOne([
        self.prepare.bind(self)
      , function (next) {
            self.render(self.paths.contributing, next);
        }
      , function (next, content) {
            Fs.writeFile(
                Path.join(self.path, CONTRIBUTING_NAME)
              , content.replace(/^\s+|\s+$/g, "").replace(/\n{3,}/g, "\n\n")
              , next
            );
        }
    ], callback);
};

/**
 * version
 * Bumps the provided version.
 *
 * @name version
 * @function
 * @param {String} what The version which should be bumped. It takes one of the following values: `"major"`, `"minor"`, `"patch"`. The default is `"patch"`.
 * @param {Function} callback The callback function.
 */
Blah.prototype.version = function (what, callback) {
    var self = this;

    if (typeof what === "function") {
        callback = what;
        what = "patch";
    }

    if (!/^major|minor|patch$/.test(what)) {
        return callback(new Error("Invalid version: " + what));
    }
    OneByOne([
        self.prepare.bind(self)
      , function (next) {
            var version = self.pack.version;
            if (!version) {
                return callback(new Error("Cannot find the version in the package.json file."));
            }
            version = self.pack.version.split(".").map(function (x) {
                return parseInt(x);
            });
            switch (what) {
                case "major":
                    ++version[0];
                    version[1] = 0;
                    version[2] = 0;
                    break;
                case "minor":
                    ++version[1];
                    version[2] = 0;
                    break;
                case "patch":
                    ++version[2];
                    break;
                    break;
            }
            self.pack.version = version.join(".");
            if (!Object.keys(self.pack.blah).length) {
                delete self.pack.blah;
            }
            WriteJson(self.paths.pack, self.pack, next);
        }
    ], callback);
};

module.exports = Blah;
