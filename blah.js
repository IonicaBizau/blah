#!/usr/bin/env node

// Help content
const HELP =
"blah --help" +
"\nusage: blah [options] [actions]" +
"\n" +
"\nBlah version. Blah gitignore. Blah README. Boring. You need blah." +
"\n" +
"\noptions:" +
"\n  --v, --version          prints the version" +
"\n  --help                  prints this output" +
"\n" +
"\nactions:" +
"\n  readme                  creates the README.md file containing the documentation also" +
"\n  gitignore               creates .gitignore file" +
"\n  license [license-name]  creates the LICENSE file by providing the license name" +
"\n  docs                    creates the DOCUMENTATION.md file" +
"\n  version <what>          where <what> can be 'major', 'minor' or 'patch'. Default: patch" +
"\n" +
"\nDocumentation can be found at https://github.com/IonicaBizau/node-blah";

// Dependencies
var Mustache = require("mustache")
  , Fs = require("fs")
  , Path = require("path")
  , JxUtils = require("jxutils")
  , MarkDox = require("markdox")
  ;

/**
 * getPackage
 * Returns the parsed content of package.json
 *
 * @name getPackage
 * @function
 * @return {String} content of package.json file found in the current directory
 */
function getPackage() {
    return require(process.env.PWD + "/package");
}

/**
 * generateDocs
 * Generate documentation file from package.json main file.
 *
 * @name generateDocs
 * @function
 * @param {String} file Output file name (default: `DOCUMENTATION.md`)
 * @param {Function} callback The callback function
 * @return {undefined}
 */
function generateDocs(file, callback) {
    var pack = getPackage();
    MarkDox.process("./" + pack.main, {
        template: __dirname + "/markdox-res/template.ejs"
      , output: file || "./DOCUMENTATION.md"
    }, callback);
}

/**
 * generateReadme
 * Returns a string representing the readme content of the project.
 *
 * @name generateReadme
 * @function
 * @param {Function} callback The callback function
 * @return {undefined}
 */
function generateReadme(callback) {

    var pack = getPackage()
      , flattenPack = JxUtils.flattenObject(pack)
      , content = Fs.readFileSync(__dirname + "/templates/README.md").toString()
      , outputFile = "./docs-" + Math.random().toString(36) + ".md"
      ;

    generateDocs(outputFile, function (err) {
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

}

/**
 * generateGitignore
 * Returns the content of .gitignore file
 *
 * @name generateGitignore
 * @function
 * @return {String} Content of gitignore file.
 */
function generateGitignore() {

    var content =
        "*.swp\n" +
        "*.swo\n" +
        "*~\n" +
        "*.log\n" +
        "node_modules"
      ;

    return content;
}

/**
 * generateLicense
 * Returns the content of the LICENSE by providing the `@licenseName`.
 *
 * @name generateLicense
 * @function
 * @param {String} licenseName The license name (e.g. `mit`)
 * @return {String} The content of license.
 */
function generateLicense(licenseName) {

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
}

/*!
 * Available options and actions
 *
 */
var options = {

    // Options
    "version": {
        run: function() {
            console.log("Blah v" + require("./package").version)
        }
      , aliases: ["-v", "--version", "--v", "-version"]
    }
  , "help": {
        run: function() {
            console.log(HELP);
        }
      , aliases: ["-h", "--help", "--h", "-help"]
    }

    // Actions
  , "readme": {
        run: function() {
            generateReadme(function (err, content) {
                if (err) { return console.log(err); }
                Fs.writeFileSync( "./README.md" , content);
            });
        }
      , aliases: ["readme"]
    }
  , "gitignore": {
        run: function() {
            Fs.writeFileSync(
                "./.gitignore"
              , generateGitignore()
            )
        }
      , aliases: ["gitignore"]
    }
  , "license": {
        run: function() {
            Fs.writeFileSync(
                "./LICENSE"
              , generateLicense(process.argv[3])
            )
        }
      , aliases: ["license"]
    }
  , "docs": {
        run: function() {
            generateDocs("", function (err, data) {
                if (err) { return console.log(err); }
                console.log("Generated DOCUMENTATION.md");
            });
        }
      , aliases: ["docs"]
    }
  , "bump-version": {
        run: function() {
            var pack = getPackage()
              , version = pack.version.split(".").map(function (x) {
                    return parseInt(x, 10);
                })
              , what = process.argv[3] || "patch"
              ;

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
                default:
                    console.error("Invalid input: " + what + ". Pass one of the following values: major, minor, patch.");
                    break;
            }

            pack.version = version.join(".");
            Fs.writeFileSync(process.env.PWD + "/package.json", JSON.stringify(
                pack, null, 2
            ));
        }
      , aliases: ["version"]
    }
};

// Parse process.argv and run the needed action
var found = false;
for (var i = 2; i < process.argv.length; ++i) {
    var cArg = process.argv[i];
    for (var op in options) {
        var cOp = options[op];
        if (cOp.aliases.indexOf(cArg) !== -1) {
            cOp.run();
            found = true;
            break;
        }
    }
}

// No actions, no fun
if (process.argv.length === 2 && !found) {
    console.error("No action/option provided. Run blah --help for more information");
    found = true;
}

// Invalid option/action
if (!found) {
    console.error("Invalid option or action: " + process.argv.slice(2).join(", "));
}
