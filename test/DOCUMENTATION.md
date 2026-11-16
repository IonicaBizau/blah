## Documentation

You can see below the API reference of this module.

### `parsePath(url)` <small>Type: function</small>

Parses the input url.

#### Params

- **String** `url`: The input url.

#### Return
- **Object** An object containing the following fields:

   - `protocols` (Array): An array with the url protocols (usually it has one element).
   - `protocol` (String): The first protocol or `"file"`.
   - `port` (String): The domain port (default: `""`).
   - `resource` (String): The url domain/hostname.
   - `host` (String): The url domain (including subdomain and port).
   - `user` (String): The authentication user (default: `""`).
   - `password` (String): The authentication password (default: `""`).
   - `pathname` (String): The url pathname.
   - `hash` (String): The url hash.
   - `search` (String): The url querystring value (excluding `?`).
   - `href` (String): The normalized input url.
   - `query` (Object): The url querystring, parsed as object.
   - `parse_failed` (Boolean): Whether the parsing failed or not.

