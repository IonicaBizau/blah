
[![blah](http://i.imgur.com/at4TK2R.png)](#)

# `$ blah`

 [![Patreon](https://img.shields.io/badge/Support%20me%20on-Patreon-%23e6461a.svg)][paypal-donations] [![PayPal](https://img.shields.io/badge/%24-paypal-f39c12.svg)][paypal-donations] [![AMA](https://img.shields.io/badge/ask%20me-anything-1abc9c.svg)](https://github.com/IonicaBizau/ama) [![Version](https://img.shields.io/npm/v/blah.svg)](https://www.npmjs.com/package/blah) [![Downloads](https://img.shields.io/npm/dt/blah.svg)](https://www.npmjs.com/package/blah) [![Get help on Codementor](https://cdn.codementor.io/badges/get_help_github.svg)](https://www.codementor.io/johnnyb?utm_source=github&utm_medium=button&utm_term=johnnyb&utm_campaign=github)

> A command line tool to optimize the repetitive actions.

## :cloud: Installation

You can install the package globally and use it as command line tool:


```sh
$ npm i -g blah
```


Then, run `blah --help` and see what the CLI tool can do.


```
$ blah --help
Usage: blah <command> [options]

A command line tool to optimize the repetitive actions.

Commands:
  init  Inits the .blah directory.

Options:
  -b, --bump-version       Bumps the package.json version.
  -r, --readme             Creates the README.md file.
  -g, --gitignore          Creates the .gitignore file.
  -l, --license <license>  Generates a LICENSE file with copyright
                           information.
  -d, --docs <path>        Generates the markdown documentation
                           (DOCUMENTATION.md) for input file.
  -c, --contributing       Generates the CONTRIBUTING.md.
  -f, --force              When running `blah` without any arguments, force
                           overriding existing files.
  -v, --version            Displays version information.
  -h, --help               Displays this help.

Examples:
  $ blah --readme      # generates README.md
  $ blah --gitignore   # generates .gitignore
  $ blah --license mit # writes the MIT license in the LICENSE file
  $ blah --docs index.js # generates DOCUMENTATION.md from index.js, parsing JSDoc comments
  $ blah --bump-version major # bumps the major field of version, in package.json file

Happy Blahing!

Documentation can be found at https://github.com/IonicaBizau/blah.
```

## :clipboard: Example


Here is an example how to use this package as library. To install it locally, as library, you can do that using `npm`:

```sh
$ npm i --save blah
```



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

## :memo: Documentation

For full API reference, see the [DOCUMENTATION.md][docs] file.

## :yum: How to contribute
Have an idea? Found a bug? See [how to contribute][contributing].

## :moneybag: Donations

Another way to support the development of my open-source modules is
to [set up a recurring donation, via Patreon][patreon]. :rocket:

[PayPal donations][paypal-donations] are appreciated too! Each dollar helps.

Thanks! :heart:

## :dizzy: Where is this library used?
If you are using this library in one of your projects, add it in this list. :sparkles:


 - [`ship-release`](https://github.com/IonicaBizau/ship-release#readme)—Publish new versions on GitHub and npm with ease.

## :scroll: License

[MIT][license] © [Ionică Bizău][website]

[patreon]: https://www.patreon.com/ionicabizau
[paypal-donations]: https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RVXDDLKKLQRJW
[donate-now]: http://i.imgur.com/6cMbHOC.png

[license]: http://showalicense.com/?fullname=Ionic%C4%83%20Biz%C4%83u%20%3Cbizauionica%40gmail.com%3E%20(http%3A%2F%2Fionicabizau.net)&year=2014#license-mit
[website]: http://ionicabizau.net
[contributing]: /CONTRIBUTING.md
[docs]: /DOCUMENTATION.md
