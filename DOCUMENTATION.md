## Documentation
You can see below the API reference of this module.

### `Blah(path)`
Creates a new `Blah` instance.

#### Params 
- **String** `path`: The Blah working directory (default: `process.cwd()`).

#### Return
- **Blah** The `Blah` instance.

### `search(file, callback)`
Searches a file in the blah directories.

#### Params 
- **String** `file`: The relative path to a file to search in the templates directories (in the following order: local `.blah` directory,
`~/.blah-templates`, library templates).
- **Function** `callback`: The callback function.

### `prepare(callback)`
Prepares the Blah data.

#### Params 
- **Function** `callback`: The callback function.

### `init(callback)`
Inits the `.blah` directory in the current project.

#### Params 
- **Function** `callback`: The callback function.

### `docs(input, output, callback)`
Generates the DOCUMENTATION.md file, parsing the input files.

#### Params 
- **String** `input`: Input file name (default: main file from package.json)
- **String** `output`: Output file name (default: `DOCUMENTATION.md`)
- **Function** `callback`: The callback function.

### `readme(callback)`
Creates the `README.md` file.

#### Params 
- **Function** `callback`: The callback function

### `gitignore(callback)`
Creates the `.gitignore` file.

#### Params 
- **Function** `callback`: The callback function.

### `license(license, callback)`
Creates the `LICENSE` file.

#### Params 
- **String** `license`: The license name.
- **Function** `callback`: The callback function.

### `render(path, data, callback)`
Renders a template from file.

#### Params 
- **String** `path`: The template path.
- **Object** `data`: Additional data to merge into the template data.
- **Function** `callback`: The callback function.

### `contributing(callback)`
Generates the `CONTRIBUTING.md` file.

#### Params 
- **Function** `callback`: The callback function.

