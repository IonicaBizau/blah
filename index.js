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


function generateReadme () {
    var pack = require ("./package")
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

function generateGitignore () {
    var content =
        "*.swp\n" +
        "*~\n" +
        "*.log\n" +
        "node_modules";

    return content;
}


var options = {
    // options
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

    // actions
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
};

for (var i = 2; i < process.argv.length; ++i) {
    var cArg = process.argv[i];
    for (var op in options) {
        var cOp = options[op];
        if (cOp.aliases.indexOf (cArg) !== -1) {
            cOp.run();
            break;
        }
    }
}
