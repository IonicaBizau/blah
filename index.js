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

var options = {
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
