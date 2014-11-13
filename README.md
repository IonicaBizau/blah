![Blah - A command line tool to optimize the repetitive actions.](http://i.imgur.com/at4TK2R.png)

## Installation
Run the following commands to download and install the application:

```sh
# Globally from NPM
$ sudo npm install -g blah
# Locally from Git
$ git clone git@github.com:IonicaBizau/node-blah.git blah
$ cd blah
$ npm install
$ ./blah.js --version
```

## How to use

After you have `package.json` file you can run `blah readme` to generate a README.md file with information taken from package.json and parsed documentation from code.

To generate the `LICENSE` file (let's create a file containing MIT license), use use `blah license mit`.

To generate documentation for a specific file, run `blah docs your-file.js`.

## Help

```sh
$ blah --help
blah --help
usage: blah [options] [actions]

A command line tool to optimize the repetitive actions.

options:
  --v, --version          prints the version
  --help                  prints this output

actions:
  readme                  creates the README.md file containing the documentation also
  gitignore               creates .gitignore file
  license [license-name]  creates the LICENSE file by providing the license name
  docs <input-file>       creates the DOCUMENTATION.md file from main file or <input-file>
                          if this was provided
  version <what>          where <what> can be 'major', 'minor' or 'patch'. Default: patch

examples:
  $ blah --version          # outputs the version
  $ blah readme             # generates the README.md file using package.json
  $ blah gitignore          # generates the .gitignore file
  $ blah license mit        # generates the LICENSE file taking copyright holder information
                            # from package.json or GIT variables
  $ blah docs index.js      # generates DOCUMENTATION.md from index.js, parsing JSDoc comments
  $ blah version major      # bumps the major field of version, in package.json file
```

## Documentation

Below you find the list with the methods that can be accessed programmatically:

### `getPackage()`
Returns the parsed content of package.json

#### Return
- **String** content of package.json file found in the current directory

### `generateDocs(input, output, callback)`
Generate documentation file from package.json main file.

#### Params
- **String** `input`: Input file name (default: main file from package.json)
- **String** `output`: Output file name (default: `DOCUMENTATION.md`)
- **Function** `callback`: The callback function

### `generateReadme(callback)`
Returns a string representing the readme content of the project.

#### Params
- **Function** `callback`: The callback function

### `generateGitignore()`
Returns the content of .gitignore file

#### Return
- **String** Content of gitignore file.

### `generateLicense(licenseName)`
Returns the content of the LICENSE by providing the `@licenseName`.

#### Params
- **String** `licenseName`: The license name (e.g. `mit`)

#### Return
- **String** The content of license.

## How to contribute

1. File an issue in the repository, using the bug tracker, describing the
   contribution you'd like to make. This will help us to get you started on the
   right foot.
2. Fork the project in your account and create a new branch:
   `your-great-feature`.
3. Commit your changes in that branch.
4. Open a pull request, and reference the initial issue in the pull request
   message.

## Changelog

### `1.0.0`
 - First stable release.

### `0.0.x`
 - Prereleases.

## License
See the [LICENSE](./LICENSE) file.
