<!---------------------------------------------------------------------------->
<!-- STOP, LOOK & LISTEN!                                                   -->
<!-- ====================                                                   -->
<!-- Do NOT edit this file directly since it's generated from a template    -->
<!-- file, using https://github.com/IonicaBizau/node-blah                   -->
<!--                                                                        -->
<!-- If you found a typo in documentation, fix it in the source files       -->
<!-- (`lib/*.js`) and make a pull request.                                  -->
<!--                                                                        -->
<!-- If you have any other ideas, open an issue.                            -->
<!--                                                                        -->
<!-- Please consider reading the contribution steps (CONTRIBUTING.md).      -->
<!-- * * * Thanks! * * *                                                    -->
<!---------------------------------------------------------------------------->

![blah](http://i.imgur.com/at4TK2R.png)

# `$ blah` [![Donate now][donate-now]][paypal-donations]

A command line tool to optimize the repetitive actions.

## Installation

```sh
$ npm i blah
```

### CLI Usage
You can install the package globally and use it as command line tool:

```sh
$ npm i -g blah
```

Then, run `blah --help` and see what the cli tool can do.

```sh
$ blah -h
Usage: blah [options]

Options:
  -i, --init                    Inits the .blah directory.
  -r, --readme                  Creates the README.md file.
  -g, --gitignore               Creates the .gitignore file.
  -l, --license <license>       Generates a LICENSE file with copyright
                                information.
  -c, --contributing            Generates the CONTRIBUTING.md.
  -d, --docs <path>             Generates the markdown documentation
                                (DOCUMENTATION.md) for input file.
  -b, --bump-version <version>  Bumps the package.json version.
  -h, --help                    Displays this help.
  -v, --version                 Displays version information.

Examples:

  $ blah --readme      # generates the README.md file using package.json
  $ blah --gitignore   # generates the .gitignore file
  $ blah --license mit # generates the LICENSE file taking copyright holder information
                       # from package.json or GIT variables
  $ blah --docs index.js # generates DOCUMENTATION.md from index.js, parsing JSDoc comments
  $ blah --bump-version major # bumps the major field of version, in package.json file

Happy Blahing!

Documentation can be found at https://github.com/IonicaBizau/node-blah
```

## Example

Here is an example how to use this package as library.

```js
// Dependencies
var Blah = require("blah");

// Create a new Blah instance
var blh = new Blah("path/to/project");

// Generate the .gitignore file
blh.gitignore(function (err) {
    // Generated gitignore
});

// Create a copy of The KINDLY license
blh.license("KINDLY", function (err) {
    // Do something after creating the license
});

```

## Documentation

For full API reference, see the [DOCUMENTATION.md][docs] file.

## How to contribute
Have an idea? Found a bug? See [how to contribute][contributing].

## License
[KINDLY][license] © [Ionică Bizău][website]–The [LICENSE](/LICENSE) file contains
a copy of the license.

[license]: http://ionicabizau.github.io/kindly-license/?author=Ionic%C4%83%20Biz%C4%83u%20%3Cbizauionica@gmail.com%3E&year=2015
[contributing]: /CONTRIBUTING.md
[website]: http://ionicabizau.net
[docs]: /DOCUMENTATION.md
[paypal-donations]: https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=MG98D7NPFZ3MG
[donate-now]: http://i.imgur.com/jioicaN.png