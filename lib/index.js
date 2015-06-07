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
  ;

// Constants
const BLAH_DIR = ".blah"
    , README_NAME = "README.md"
    , TEMPLATES = "templates"
    , PACKAGE_JSON = "package.json"
    , INDEX_JSON = "index.json"
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
      , templates_path: Path.join(Ul.USER_DIR, ".blah-templates")
    });

    this.blah_dir = Path.join(options.path, BLAH_DIR);
    this.path = options.path;
    this.templates = {};
    this.pack = {};
    this.blah = {};

    if (IsThere(options.templates_path)) {
        this.templates_path = options.templates_path;
    } else {
        this.templates_path = Path.join(__dirname, TEMPLATES)
    }
}

/**
 * prepare
 * Prepares Blah data.
 *
 * @name prepare
 * @function
 * @param {Function} callback The callback function.
 */
Blah.prototype.prepare = function (callback) {
    var self = this;
    ParentSearch(self.path, PACKAGE_JSON, { obj: true }, function (data) {
        if (!data) { return callback(); }
        ReadJson(data.p, function (err, pack) {
            if (err) { return callback(err); }
            self.pack = pack;
            callback();
        });
    });
};

/**
 * getPackage
 * Returns the parsed content of package.json
 *
 * @name getPackage
 * @function
 * @return {String} content of package.json file found in the current directory
 */
Blah.prototype.getPackage = function (callback) {
    ReadJson(this.pack_path, callback);
};

/**
 * init
 * Inits the `.blah` directory in the current project.
 *
 * @name init
 * @function
 * @param {Object} options An object containing the following fields:
 *
 *  - `readme` (Object): Data to render the `README.md` template.
 *  - `blah` (Object): An object which will be written to `.blah/index.json`
 *
 * @param {Function} callback The callback function.
 */
Blah.prototype.init = function (options, callback) {

    if (typeof options === "function") {
        callback = options;
        options = {};
    }

    options = Ul.merge(options, {
        blah: {}
      , readme: {}
    });

    var self = this
      , readme = new Streamp.writable(Path.join(self.blah_dir, README_NAME))
      , blahIndex = Path.join(self.blah_dir, INDEX_JSON)
      ;

    // Run the init tasks
    SameTime([
        // Prepare data
        self.prepare.bind(self)
        // Read the readme template
      , Fs.readFile.bind(self, Path.join(self.templates_path, README_NAME), "utf-8")
        // Read the .blah/index.json
      , function (cb) {
            ReadJson(blahIndex, function (err, blahData) {
                if (err) {
                    err = null;
                    blahData = {};
                }
                cb(err, blahData);
            });
        }
    ], function (err, data) {
        if (err) { return callback(err); }

        self.templates.readme = data[1];
        self.templates.blah = data[2];
        self.blah_data = Ul.merge(options.blah, data[2]);

        SameTime([
            WriteJson.bind(self, blahIndex, self.blah_data)
          , function (cb) {
                readme.end(Barbe(data[1], options.readme));
                callback();
            }
        ], callback);
    });
};

///**
// * generateDocs
// * Generate documentation file from package.json main file.
// *
// * @name generateDocs
// * @function
// * @param {String} input Input file name (default: main file from package.json)
// * @param {String} output Output file name (default: `DOCUMENTATION.md`)
// * @param {Function} callback The callback function
// */
//Blah.prototype.docs = function (input, output, callback) {
//    MarkDox.process(input, {
//        template: __dirname + "/markdox-res/template.ejs"
//      , output: output || "./DOCUMENTATION.md"
//    }, callback);
//};
//
///**
// * generateReadme
// * Returns a string representing the readme content of the project.
// *
// * @name generateReadme
// * @function
// * @param {Function} callback The callback function
// * @return {undefined}
// */
//Blah.prototype.readme = function (path, callback) {
//
//    if (typeof path === "function") {
//        callback = path;
//        path = process.cwd();
//    }
//
//    var self = this
//      , pack = self.getPackage()
//      , flattenPack = JxUtils.flattenObject(pack)
//      , content = Fs.readFileSync(__dirname + "/templates/README.md").toString()
//      , outputFile = "./docs-" + Math.random().toString(36) + ".md"
//      ;
//
//    this.generateDocs("", outputFile, function (err) {
//        if (err) {
//            return callback("Error when generating docs." + err.toString());
//        }
//        var mData = {};
//        mData.documentation = Fs.readFileSync(outputFile);
//        Fs.unlinkSync(outputFile);
//        for (var k in pack) {
//            mData[k] = pack[k];
//        }
//        content = Barbe(content, ["{{", "}}"], mData);
//        callback(null, content);
//    });
//
//};
//
///**
// * generateGitignore
// * Returns the content of .gitignore file
// *
// * @name generateGitignore
// * @function
// * @return {String} Content of gitignore file.
// */
//Blah.prototype.generateGitignore = function () {
//
//    var content =
//        "*.swp\n" +
//        "*.swo\n" +
//        "*~\n" +
//        "*.log\n" +
//        "node_modules"
//      ;
//
//    return content;
//};
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
