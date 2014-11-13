#!/usr/bin/env node

// Dependencies
var Blah = require("../index.js");

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

/*!
 * Available options and actions
 *
 */
var options = {

    // Options
    "version": {
        run: function() {
            console.log("Blah v" + require("../package").version)
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
            Blah.generateReadme(function (err, content) {
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
              , Blah.generateGitignore()
            )
        }
      , aliases: ["gitignore"]
    }
  , "license": {
        run: function() {
            Fs.writeFileSync(
                "./LICENSE"
              , Blah.generateLicense(process.argv[3])
            )
        }
      , aliases: ["license"]
    }
  , "docs": {
        run: function() {
            Blah.generateDocs(process.argv[3], "", function (err, data) {
                if (err) { return console.log(err); }
                console.log("Generated DOCUMENTATION.md");
            });
        }
      , aliases: ["docs"]
    }
  , "bump-version": {
        run: function() {
            var pack = Blah.getPackage()
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
                    process.exit(1);
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
