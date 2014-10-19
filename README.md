# blah
Blah version. Blah gitignore. Blah README. Boring. You need blah.

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

## Help

```sh
$ ./blah.js --help
blah --help
usage: blah [options] [actions]

Blah version. Blah gitignore. Blah README. Boring. You need blah.

options:
  --v, --version          prints the version
  --help                  prints this output

actions:
  readme                  creates the README.md file containing the documentation also
  gitignore               creates .gitignore file
  license [license-name]  creates the LICENSE file by providing the license name
  docs                    creates the DOCUMENTATION.md file
  version <what>          where <what> can be 'major', 'minor' or 'patch'. Default: patch

Documentation can be found at https://github.com/IonicaBizau/node-blah
```

## Documentation
## `getPackage()`
Returns the parsed content of package.json

### Return:
* **String** content of package.json file found in the current directory

## `generateDocs(file, callback)`
Generate documentation file from package.json main file.

### Params:
* **String** `file`: Output file name (default: `DOCUMENTATION.md`)
* **Function** `callback`: The callback function

## `generateReadme(callback)`
Returns a string representing the readme content of the project.

### Params:
* **Function** `callback`: The callback function

## `generateGitignore()`
Returns the content of .gitignore file

### Return:
* **String** Content of gitignore file.

## `generateLicense(licenseName)`
Returns the content of the LICENSE by providing the `@licenseName`.

### Params:
* **String** `licenseName`: The license name (e.g. `mit`)

### Return:
* **String** The content of license.

## How to contribute

1. File an issue in the repository, using the bug tracker, describing the
   contribution you'd like to make. This will help us to get you started on the
   right foot.
2. Fork the project in your account and create a new branch:
   `your-great-feature`.
3. Commit your changes in that branch.
4. Open a pull request, and reference the initial issue in the pull request
   message.

## License
See the [LICENSE](./LICENSE) file.
