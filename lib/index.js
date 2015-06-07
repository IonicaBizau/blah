// Dependencies
var Barbe = require("barbe")
  , Fs = require("fs")
  , Path = require("path")
  , JxUtils = require("jxutils")
  , MarkDox = require("markdox")
  , IsThere = require("is-there")
  , ReadJson = require("r-json")
  , WriteJson = require("w-json")
  , ParentSearch = require("parent-search")
  , Streamp = require("streamp")
  , Ul = require("ul")
  , SameTime = require("same-time")
  , Deffy = require("deffy")
  , Ejs = require("ejs")
  , Ncp = require("ncp")
  ;

// Constants
const BLAH_DIR = ".blah"
    , README_NAME = "README.ejs"
    , TEMPLATES = "templates"
    , PACKAGE_JSON = "package.json"
    , INDEX_JSON = "index.json"
    , DOCUMENTATION_FILE_NAME = "DOCUMENTATION.md"
    , MARKDOX_EJS = "docs.ejs"
    ;

/*!
 * Blah
 * Creates a new `Blah` instance.
 *
 * @name Blah
 * @function
 */
function Blah(options) {
    if (typeof options === "string") {
        options = {
            path: options
        };
    }

    options = Ul.merge(options, {
        path: process.cwd()
    });

    // .blah/
    this.blah_dir = Path.join(options.path, BLAH_DIR);

    // ~/.blah-templates
    this.usr_templates = Path.join(Ul.USER_DIR, ".blah-templates");

    // templates/
    this.lib_templates = Path.join(__dirname, TEMPLATES);

    this.path = options.path;
    this.templates = {};
    this.pack = {};
    this.paths = {};
}

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

    // Find the paths
    SameTime([
        self.search.bind(self, MARKDOX_EJS)
      , self.search.bind(self, README_NAME)
      , self.search.bind(self, ".gitignore")
      , self.search.bind(self, "CONTRIBUTING.ejs")
      , function (cb) {
            ParentSearch(self.path, PACKAGE_JSON, cb.bind(this, null));
        }
    ], function (err, data) {
        if (err) { return callback(err); }

        self.paths.markdox = data[0];
        self.paths.readme = data[1];
        self.paths.gitignore = data[2];
        self.paths.contributing = data[3];
        self.paths.pack = data[4];

        // Read the template data
        SameTime([
            function (cb) {
                if (!self.paths.pack) {
                    return cb(null, {});
                }
                ReadJson(self.paths.pack, function (err, pack) {
                    pack = Deffy(pack, {});
                    cb(null, pack);
                });
            }
        ], function (err, data) {
            if (err) { return callback(err); }
            self.pack = data[0];
            callback();
        });
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
    self.prepare(function (err) {
        if (err) { return callback(err); }
        self.search(function (err, path_templates) {
            if (err) { return callback(err); }
            if (path_templates === self.blah_dir) {
                return callback(new Error("Refusing to override existing templates."));
            }
            Ncp(path_templates, self.blah_dir, callback);
        });
    });
};

/**
 * generateDocs
 * Generate documentation file from package.json main file.
 *
 * @name generateDocs
 * @function
 * @param {String} input Input file name (default: main file from package.json)
 * @param {String} output Output file name (default: `DOCUMENTATION.md`)
 * @param {Function} callback The callback function
 */
Blah.prototype.docs = function (input, output, callback) {
    var self = this;
    if (typeof output === "function") {
        callback = output;
        output = DOCUMENTATION_FILE_NAME;
    }
    self.prepare(function (err) {
        if (err) { return callback(err); }
        MarkDox.process(input, {
            template: self.paths.markdox
          , output: output
        }, callback);
    });
};

/**
 * generateReadme
 * Returns a string representing the readme content of the project.
 *
 * @name generateReadme
 * @function
 * @param {Function} callback The callback function
 */
Blah.prototype.readme = function (callback) {

    var self = this;

    self.prepare(function (err) {
        if (err) { return callback(err); }
        SameTime([
            function (cb) {
                IsThere(self.pack.main, function (exists) {
                    if (!exists) { return cb(null, ""); }
                    MarkDox.process(self.pack.main, {
                        template: self.markdox_tmpl
                    }, function (err, docs) {
                        cb(err, docs);
                    });
                });
            }
        ], function (err, data) {
            if (err) { return callback(err); }
            content = Barbe(self.templates.readme, ["{", "}"], {
                pack: self.pack
              , docs: data[0]
            });
            Fs.writeFile("README.md", content, callback);
        });
    });
};

/**
 * generateGitignore
 * Returns the content of .gitignore file
 *
 * @name generateGitignore
 * @function
 * @return {String} Content of gitignore file.
 */
Blah.prototype.generateGitignore = function () {

    var content =
        "*.swp\n" +
        "*.swo\n" +
        "*~\n" +
        "*.log\n" +
        "node_modules"
      ;

    return content;
};
//
///**
// * generateLicense
// * Returns the content of the LICENSE by providing the `@licenseName`.
// *
// * @name generateLicense
// * @function
// * @param {String} licenseName The license name (e.g. `mit`)
// * @return {String} The content of license.
// */
//Blah.prototype.generateLicense = function (licenseName) {
//
//    var fullName = null
//      , pack = require(process.env.PWD + "/package")
//      ;
//
//    try {
//        var gitconfigLines = Fs.readFileSync(
//            require('path-extra').homedir() + "/.gitconfig"
//        ).toString().replace(/\t/g, "").split("\n");
//        for (var i = 0; i < gitconfigLines.length; ++i) {
//            var cLine = gitconfigLines[i].trim();
//            if (/^name/.test(cLine)) {
//                fullName = cLine.split("=")[1].trim();
//                break;
//            }
//        }
//    } catch(e) {
//    }
//
//    if (!fullName) {
//        console.log("No fullname found in .gitconfig. Please modify LICENSE [fullname] manually");
//        fullName = "[fullname]";
//    }
//
//    return Fs
//        .readFileSync(__dirname + "/templates/licenses/" + licenseName.toLowerCase() + ".txt")
//        .toString()
//        .replace("[project]", pack.name)
//        .replace("[year]", new Date().getFullYear())
//        .replace("[fullname]", fullName)
//        .replace("[description]", pack.description)
//        ;
//};

module.exports = Blah;
