# TWOverflow - Tools for Tribal Wars 2

## Current tools

- **FarmOverflow** - Tool with lots of settings and filters to farm automatically around all your villages.
- **CommandQueue** - Tool to send attacks/supports or relocate troops specifying the date it should arrive, or a data to send.
- **AutoCollector** - Tool to collect all resources from deposit and second village automatically.
- **Minimap** - Tool to display a minimap with custom highlights.
- **BuilderQueue** - Tool to build in every village automatically.
- **AttackView** - Tool to have a better overview of incoming commands.

## Installation

See [https://gitlab.com/relaxeaza/twoverflow/wikis/Installation](https://gitlab.com/relaxeaza/twoverflow/wikis/Installation).

# For developers

## Module Structure

```
/
|-- module.json (required)
|-- src (required)
|-- |-- core.js (required)
|-- |-- init.js (required)
|-- |-- customScript1.js
|-- |-- customScript2.js
|-- ui
|-- |-- ui.js (optional)
|-- |-- customMarkup1.html
|-- |-- customMarkup2.html
|-- |-- customStyle1.less
|-- |-- customStyle2.less
|-- locale
|-- |-- en.json
|-- |-- pt.json
```

### Root Folder

Module Root folder can have any name.

### The module.json File

The `module.json` contain basic information about the module.
Only the `id` key is required and must be lower case and a single word.
Any other keys can be included and can be retrivied in any `.js` script across the module with the fallowing code: `__moduleId_customKey`.

### Interface Folder

If `ui.js` is present inside the `ui` folder, the script will be called with all custom files ready to use. The purpose of the script must be to build de interface.

Any `.html` files included inside the interface folder will be minified and can be retrivied by `.js` scripts using the fallowing code: `__moduleId_html_fileName`. Note: `moduleId` must be replaced with the name of the module and `fileName` by the name of the file (without extension) that will be retrivied. Exemple: `__myModule_html_customMarkup1`.
The same goes to style files: `__myModule_css_customStyle1`

The folder can include unlimited custom files.

### Locale Folder

Locale files must a `json` named with simple language codes (en, pt, pl, it...).

The files will be compiled to a single object with the fallowing structure:

```
{
    "en": {
        "key": "string",
        ...
    },
    "pt": {
        "key": "string",
        ...
    },
    ...
}
```

The object can be retrivied in any ".js" script using the fallowing code: `__moduleId_locale`.

### Source Folder

The `src` folder must have a `.js` script named with the same name of the module that will include the logic of the module, and a `init.js` script that must start the module script.

The folder can include any custom `.js` files and all will be concatened between the `core.js` script (first file) and the `init.js` (last file).

## Compiling from source

You'll need to install [nodejs](https://nodejs.org/en/download/) to build the script from source.

Open the terminal, clone and install the dependencies.

```bash
git clone https://gitlab.com/relaxeaza/twoverflow.git
cd twoverflow
npm install
```

To compile run `npm run build-prod` or `npm run build` to skip minifined/map version and clean temp files.

The script will be compiled inside `dist/`

## Languages

- English
- Português
- Polish

Please help to translate the TWOverflow [here](https://crowdin.com/project/twoverflow).
