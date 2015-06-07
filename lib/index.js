// Dependencies
var Barbe = require("barbe")
  , Fs = require("fs")
  , Path = require("path")
  , JxUtils = require("jxutils")
  , MarkDox = require("markdox")
  , IsThere = require("is-there")
  , ReadJson = require("r-json")
  , ParentSearch = require("parent-search")
  , Streamp = require("streamp")
  , Ul = require("ul")
  , SameTime = require("same-time")
  ;

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
      , templates_path: Path.join(Ul.USER_DIR, BLAH_DIR)
    });

    this.path = options.path;
    if (IsThere(options.templates_path)) {
        this.templates_path = options.templates_path;
    } else {
        this.templates_path = Path.join(__dirname, TEMPLATES)
    }

    this.templates = {};
}

Blah.prototype.prepare = function (callback) {
    var self = this;
    ParentSearch(self.path, PACKAGE_JSON, { obj: true }, function (data) {
        debugger
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

Blah.prototype.init = function (options, callback) {

    if (typeof options === "function") {
        callback = options;
        options = {
        };
    }

    var self = this
      , readme = new Streamp.Writable(Path.join(self.blah_dir, README_NAME))
      , complete = 0
      , _done = false
      , errors = []
      , res = []
      ;

    function done(err, data) {
        if (_done) {
            return;
        }
        errors.push(err);
        if (--complete !== 0) {
            return;
        }
    }

    // Run the init tasks
    SameTime([
        // Prepare data
        self.prepare.bind(self)
        // Read the readme template
      , Fs.readFile.bind(self, Path.join(self.templates_path, README_NAME))
        // Read the .blah/index.json
      , ReadJson.bind(self, Path.join(self.blah_dir, INDEX_JSON))
    ], function (err, data) {
        if (err) { return callback(err); }
        self.blah_data = data[1];
        readme.on("error", callback);
        readme.on("end", callback);
        readme.end(Barbe(data[0], data[1]));
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
