
[![blah](http://i.imgur.com/at4TK2R.png)](#)

# `$ blah`

 [![Support me on Patreon][badge_patreon]][patreon] [![Buy me a book][badge_amazon]][amazon] [![PayPal][badge_paypal_donate]][paypal-donations] [![Version](https://img.shields.io/npm/v/blah.svg)](https://www.npmjs.com/package/blah) [![Downloads](https://img.shields.io/npm/dt/blah.svg)](https://www.npmjs.com/package/blah)

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


## :sparkling_heart: Support my projects

I open-source almost everything I can, and I try to reply everyone needing help using these projects. Obviously,
this takes time. You can integrate and use these projects in your applications *for free*! You can even change the source code and redistribute (even resell it).

However, if you get some profit from this or just want to encourage me to continue creating stuff, there are few ways you can do it:

 - Starring and sharing the projects you like :rocket:
 - [![PayPal][badge_paypal]][paypal-donations]—You can make one-time donations via PayPal. I'll probably buy a ~~coffee~~ tea. :tea:
 - [![Support me on Patreon][badge_patreon]][patreon]—Set up a recurring monthly donation and you will get interesting news about what I'm doing (things that I don't share with everyone).
 - **Bitcoin**—You can send me bitcoins at this address (or scanning the code below): `1P9BRsmazNQcuyTxEqveUsnf5CERdq35V6`

    ![](https://i.imgur.com/z6OQI95.png)

Thanks! :heart:


## :dizzy: Where is this library used?
If you are using this library in one of your projects, add it in this list. :sparkles:


 - [`ship-release`](https://github.com/IonicaBizau/ship-release#readme)—Publish new versions on GitHub and npm with ease.

## :scroll: License

[MIT][license] © [Ionică Bizău][website]

[badge_patreon]: http://ionicabizau.github.io/badges/patreon.svg
[badge_amazon]: http://ionicabizau.github.io/badges/amazon.svg
[badge_paypal]: http://ionicabizau.github.io/badges/paypal.svg
[badge_paypal_donate]: http://ionicabizau.github.io/badges/paypal_donate.svg
[patreon]: https://www.patreon.com/ionicabizau
[amazon]: http://amzn.eu/hRo9sIZ
[paypal-donations]: https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RVXDDLKKLQRJW
[donate-now]: http://i.imgur.com/6cMbHOC.png

[license]: http://showalicense.com/?fullname=Ionic%C4%83%20Biz%C4%83u%20%3Cbizauionica%40gmail.com%3E%20(https%3A%2F%2Fionicabizau.net)&year=2014#license-mit
[website]: https://ionicabizau.net
[contributing]: /CONTRIBUTING.md
[docs]: /DOCUMENTATION.md
