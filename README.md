# Magpiler

<img src="magpiler-icon.svg" style="margin-bottom: 1rem;" />

## Make a small, simple website or blog

Make a simple website from a folder full of Markdown and JS template files (`lit-html-server`, pure-Javascript templates, similar to `lit-html`).

## `magpiler-dev.js`

Run a small development web server, serving up the website in /path/to/src/

Run with no arguments or -h or --help to see usage.

## `magpiler-make.js`

Compile the website in /path/to/src/ as a static site at path/to/out/

Run with no arguments or -h or --help to see usage.

## Folder layout and conventions

```
  root-project-folder/
    - ignored-file.sh
    - src/
      - config.js
      - global.js
      - layouts/
        - default.js
        - x.js
        - y.js
      - render/
        - stuff/
          - a.html.md
        - b.html
      - static/
        - folder
          - c.jpg
        - d.css
    - out/
      - stuff/
        - a.html
      - b.html
      - folder/
        - c.jpg
      - d.css
```

### `src/render/`

Files in the `layouts/` and `render/` folders are read from disk as `data.body` with their filenames as `data.file`. For Markdown files (`xyz.html.md`, rendered as `xyz.html`), the `body` field has the converted HTML.

For `render/` and `layouts/`, metadata in YAML-style `---` delimiters are parsed as key-value pairs and added to each object as `data.key1` and `data.key2`. Importantly, the right hand side is parsed with `JSON.parse` so `null`, `false`, `true`, and numbers get parsed as real Javascript values; strings must be `"quoted"`.

### `src/layouts/`

Every Javascript file in the `layouts/` folder is loaded from disk and `eval`'d to create a function that can be called and passed a pair of `(data, global)` — a data object and the entire `global` object (which is itself augmented with the code from `config.js` and `global.js`).

Layouts can have metadata key `layout` with a right-hand-side string (quoted) with the name of another parent layout, or null. Files in `render/` without a layout assigned get `"default"` for their layout.

Layout templates can be called with ``global.renderLayout('layoutName', dataObject)`` from template code.

### `src/static/`

All static files are copied to `out/` (or served up from the server root as static files or routes with a prefixed folder).

## Inspiration

Magpiler is based on the limited features I used when I first built my blog with [DocPad](https://github.com/docpad/docpad), which is now unsupported and also just stopped working one day.
