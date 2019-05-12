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

## Testing version

You can run the testing version to experiment new features and bug fixes before the stable release.

See [https://gitlab.com/relaxeaza/twoverflow/wikis/Testing-version](https://gitlab.com/relaxeaza/twoverflow/wikis/Testing-version)

## Languages

- English
- Português
- Polish

Please help to translate the TWOverflow here: [https://crowdin.com/project/twoverflow](https://crowdin.com/project/twoverflow).

## Creating your own modules

See [https://gitlab.com/relaxeaza/twoverflow/wikis/Custom-modules](https://gitlab.com/relaxeaza/twoverflow/wikis/Custom-modules)

## Compiling from source

You'll need to install [nodejs](https://nodejs.org/en/download/) to build the script from source.

Open the terminal, clone and install the dependencies.

```bash
git clone https://gitlab.com/relaxeaza/twoverflow.git
cd twoverflow
npm install
```

Install grunt globally.

```bash
npm install -g grunt-cli
```

To compile run `grunt build`. The script will be compiled inside `dist/`

### Compile flags

You can use some flags to customize the resulting file.

- `--minify` to generate a minified file.
- `--ignore` to ignore specific modules by ID (check _module.json_ for ID).

Example: `grunt build --ignore=farm,minimap --minify` ignores both modules farm and minimap and will generate an minified file.
