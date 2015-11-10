[![blah](http://i.imgur.com/at4TK2R.png)](#)

# `$ blah` [![Support this project][donate-now]][paypal-donations]

A command line tool to optimize the repetitive actions.

## Installation

You can install the package globally and use it as command line tool:

```sh
$ npm i -g blah
```

Then, run `blah --help` and see what the CLI tool can do.

```sh
$ blah --help
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

Documentation can be found at https://github.com/IonicaBizau/blah
```

## Example

Here is an example how to use this package as library. To install it locally, as library, you can do that using `npm`:

```sh
$ npm i blah
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

## Documentation

For full API reference, see the [DOCUMENTATION.md][docs] file.

## How to contribute
Have an idea? Found a bug? See [how to contribute][contributing].

## Where is this library used?
If you are using this library in one of your projects, add it in this list. :sparkles:

## License

[KINDLY][license] © [Ionică Bizău][website]

[license]: http://ionicabizau.github.io/kindly-license/?author=Ionic%C4%83%20Biz%C4%83u%20%3Cbizauionica@gmail.com%3E&year=2014

[website]: http://ionicabizau.net
[paypal-donations]: https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RVXDDLKKLQRJW
[donate-now]: http://i.imgur.com/6cMbHOC.png

[contributing]: /CONTRIBUTING.md
[docs]: /DOCUMENTATION.md