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

// dependencies
var Yargs = require('yargs').usage(HELP)
  , argv = Yargs.argv
  ;

// show version
if (argv.v || argv.version) {
    return console.log("Blah v" + require ("./package").version);
}

// show help
if (argv.help) {
    return console.log(Yargs.help());
}
