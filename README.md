# blah
{description}

## Installation
Run the following commands to download and install the application:

```sh
$ git clone git@github.com:IonicaBizau/node-blah.git blah
$ cd blah
$ npm install
```

## Documentation
## `getPackage()`
Returns the parsed content of package.json

### Return:
* **string** representing the content of package.json file found in the current directory

## `generateReadme()`
Returns a string representing the readme content of the project.

## `generateGitignore()`
Returns the content of .gitignore file

## `generateLicense(the)`
Returns the content of the LICENSE by providing the @licenseName

### Params: 
* **licenseName:** `the`: license name

### Return:
* **string** representing the LICENSE content



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
