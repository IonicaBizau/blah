// Dependencies
var Barbe = require("barbe")
  , Fs = require("fs")
  , Path = require("path")
  , JxUtils = require("jxutils")
  , MarkDox = require("markdox")
  ;

/*!
 * Blah
 * Creates a new `Blah` instance.
 *
 * @name Blah
 * @function
 */
function Blah() {}

/**
 * getPackage
 * Returns the parsed content of package.json
 *
 * @name getPackage
 * @function
 * @return {String} content of package.json file found in the current directory
 */
Blah.prototype.getPackage = function () {
    return require(process.env.PWD + "/package");
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
Blah.prototype.generateDocs = function (input, output, callback) {
    var pack = this.getPackage();
    input = input || pack.main;
    MarkDox.process("./" + input, {
        template: __dirname + "/markdox-res/template.ejs"
      , output: output || "./DOCUMENTATION.md"
    }, callback);
};

/**
 * generateReadme
 * Returns a string representing the readme content of the project.
 *
 * @name generateReadme
 * @function
 * @param {Function} callback The callback function
 * @return {undefined}
 */
Blah.prototype.readme = function (path, callback) {

    if (typeof path === "function") {
        callback = path;
        path = process.cwd();
    }

    var self = this
      , pack = self.getPackage()
      , flattenPack = JxUtils.flattenObject(pack)
      , content = Fs.readFileSync(__dirname + "/templates/README.md").toString()
      , outputFile = "./docs-" + Math.random().toString(36) + ".md"
      ;

    this.generateDocs("", outputFile, function (err) {
        if (err) {
            return callback("Error when generating docs." + err.toString());
        }
        var mData = {};
        mData.documentation = Fs.readFileSync(outputFile);
        Fs.unlinkSync(outputFile);
        for (var k in pack) {
            mData[k] = pack[k];
        }
        content = Mustache.render(content, mData);
        callback(null, content);
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

/**
 * generateLicense
 * Returns the content of the LICENSE by providing the `@licenseName`.
 *
 * @name generateLicense
 * @function
 * @param {String} licenseName The license name (e.g. `mit`)
 * @return {String} The content of license.
 */
Blah.prototype.generateLicense = function (licenseName) {

    var fullName = null
      , pack = require(process.env.PWD + "/package")
      ;

    try {
        var gitconfigLines = Fs.readFileSync(
            require('path-extra').homedir() + "/.gitconfig"
        ).toString().replace(/\t/g, "").split("\n");
        for (var i = 0; i < gitconfigLines.length; ++i) {
            var cLine = gitconfigLines[i].trim();
            if (/^name/.test(cLine)) {
                fullName = cLine.split("=")[1].trim();
                break;
            }
        }
    } catch(e) {
    }

    if (!fullName) {
        console.log("No fullname found in .gitconfig. Please modify LICENSE [fullname] manually");
        fullName = "[fullname]";
    }

    return Fs
        .readFileSync(__dirname + "/templates/licenses/" + licenseName.toLowerCase() + ".txt")
        .toString()
        .replace("[project]", pack.name)
        .replace("[year]", new Date().getFullYear())
        .replace("[fullname]", fullName)
        .replace("[description]", pack.description)
        ;
};

module.exports = new Blah();
