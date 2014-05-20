#!/usr/bin/env node

const HELP =
"blah --help" +
"\nusage: blah [options] [actions]" +
"\n" +
"\nBlah version. Blah gitignore. Blah README. Boring. You need blah." +
"\n" +
"\noptions:" +
"\n  --v, --version          print the version" +
"\n  --help                  print this output" +
"\n" +
"\nactions:" +
"\n  readme                  creates the readme.md file" +
"\n  gitignore               creates .gitignore file" +
"\n  license [license-name]  creates the LICENSE file by providing the license name" +
"\n" +
"\nDocumentation can be found at https://github.com/IonicaBizau/node-blah";


/**
 * getPackage
 * Returns the parsed content of package.json
 *
 * @return string representing the content of package.json file
 * found in the current directory
 */
function getPackage () {
    return require (process.env.PWD + "/package");
}


/**
 * generateReadme
 * Returns a string representing the readme content of the project.
 *
 * @return: string representing the content of README.md file
 */
function generateReadme () {

    var pack = getPackage ()
      , content = ""
      ;

    // title
    content += pack.name + "\n";
    for (var i = 0; i < pack.name.length; ++i) {
        content += "=";
    }

    content += "\n";

    // description
    content += pack.description + "\n\n";

    // license
    content += "## License\n"
    content += "See the [LICENSE](./LICENSE) file.\n"

    return content;
}

/**
 * generateGitignore
 * Returns the content of .gitignore file
 *
 * @return: string representing the content of .gitignore file
 */
function generateGitignore () {

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
 * Returns the content of the LICENSE by providing the @licenseName
 *
 * @param licenseName: the license name
 * @return string representing the LICENSE content
 */
function generateLicense (licenseName) {

    var fullName = null
      , pack = require (process.env.PWD + "/package")
      ;

    try {
        var gitconfigLines = require ("fs").readFileSync(
            require('path-extra').homedir() + "/.gitconfig"
        ).toString().replace(/\t/g, "").split("\n");

        for (var i = 0; i < gitconfigLines.length; ++i) {
            var cLine = gitconfigLines[i].trim();
            if (/^name/.test(cLine)) {
                fullName = cLine.split("=")[1].trim();
                break;
            }
        }
    } catch (e) {
    }

    if (!fullName) {
        console.log("No fullname found in .gitconfig. Please modify LICENSE [fullname] manually");
        fullName = "[fullname]";
    }


    return require ("fs")
        .readFileSync (__dirname + "/licenses/" + licenseName.toLowerCase() + ".txt")
        .toString ()
        .replace ("[year]", new Date().getFullYear())
        .replace ("[fullname]", fullName)
        .replace ("[description]", pack.description)
        ;
}

/**
 * Available options and actions
 *
 */
var options = {

    // Options
    "version": {
        run: function () {
            console.log("Blah v" + require ("./package").version)
        },
        aliases: ["-v", "--version", "--v", "-version"]
    }
  , "help": {
        run: function () {
            console.log (HELP);
        },
        aliases: ["-h", "--help", "--h", "-help"]
    }

    // Actions
  , "readme": {
        run: function () {
            require ("fs").writeFileSync (
                "./README.md"
              , generateReadme()
            )
        },
        aliases: ["readme"]
    }
  , "gitignore": {
        run: function () {
            require ("fs").writeFileSync (
                "./.gitignore"
              , generateGitignore()
            )
        },
        aliases: ["gitignore"]
    }
  , "license": {
        run: function () {
            require ("fs").writeFileSync (
                "./LICENSE"
              , generateLicense (process.argv[3])
            )
        },
        aliases: ["license"]
    }
};

// Parse process.argv and run the needed action
for (var i = 2; i < process.argv.length; ++i) {
    var cArg = process.argv[i];
    for (var op in options) {
        var cOp = options[op];
        if (cOp.aliases.indexOf (cArg) !== -1) {
            cOp.run();
            process.exit (0);
        }
    }
}

// No actions, no fun
if (process.argv.length === 2) {
    console.error ("No action/option provided. Run blah --help for more information");
    process.exit (1);
}

// Invalid option/action
console.error ("Invalid option or action: " + process.argv.slice (2).join(", "));
