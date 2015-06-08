// Dependencies
var Blah = require("../lib");

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
