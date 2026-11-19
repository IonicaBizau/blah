## Documentation

You can see below the API reference of this module.

### `Blah(cwd)` <sup><small><kbd>function</kbd></small></sup>

Creates a new `Blah` instance.

#### Params

- **String** `cwd`: The Blah working directory (default: `process.cwd()`).

### `search(file, callback)` <sup><small><kbd>function</kbd></small></sup>

Searches a file in the blah directories.

#### Params

- **String** `file`: The relative path to a file to search in the templates directories (in the following order: local `.blah` directory, `~/.blah-templates`, library templates).
- **Function** `callback`: The callback function.

### `prepare(callback)` <sup><small><kbd>function</kbd></small></sup>

Prepares the Blah data.

#### Params

- **Function** `callback`: The callback function.

### `init(callback)` <sup><small><kbd>function</kbd></small></sup>

Inits the `.blah` directory in the current project.

#### Params

- **Function** `callback`: The callback function.

### `docs(input, output, writeToFile, callback)` <sup><small><kbd>function</kbd></small></sup>

Generates the DOCUMENTATION.md file from the input and its local JavaScript imports and requires.

#### Params

- **String** `input`: Input file name (default: main file from package.json)
- **String** `output`: Output file name (default: `DOCUMENTATION.md`)
- **Boolean** `writeToFile`: If `false`, the docs will be returned via the callback function, without writing the output file.
- **Function** `callback`: The callback function.

### `readme(callback)` <sup><small><kbd>function</kbd></small></sup>

Creates the `README.md` file.

#### Params

- **Function** `callback`: The callback function

### `gitignore(callback)` <sup><small><kbd>function</kbd></small></sup>

Creates the `.gitignore` file.

#### Params

- **Function** `callback`: The callback function.

### `license(license, callback)` <sup><small><kbd>function</kbd></small></sup>

Creates the `LICENSE` file.

#### Params

- **String** `license`: The license name.
- **Function** `callback`: The callback function.

### `render(path, data, callback)` <sup><small><kbd>function</kbd></small></sup>

Renders a template from file.

#### Params

- **String** `path`: The template path.
- **Object** `data`: Additional data to merge into the template data.
- **Function** `callback`: The callback function.

### `contributing(callback)` <sup><small><kbd>function</kbd></small></sup>

Generates the `CONTRIBUTING.md` file.

#### Params

- **Function** `callback`: The callback function.

### `version(what, callback)` <sup><small><kbd>function</kbd></small></sup>

Bumps the provided version.

#### Params

- **String** `what`: The version which should be bumped. It takes one of the following values: `"major"`, `"minor"`, `"patch"`. The default is `"patch"`.
- **Function** `callback`: The callback function.

