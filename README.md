













![blah](http://i.imgur.com/at4TK2R.png)




# `$ blah`

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

Then, run `blah --help` and see what the CLI tool can do.








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
See the [LICENSE][license] file.


[license]: /LICENSE
[contributing]: /CONTRIBUTING.md
[docs]: /DOCUMENTATION.md
