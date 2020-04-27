const fs = require('fs')
const glob = require('glob')
const path = require('path')
const pkg = require('./package.json')
const notifySend = require('node-notifier')
const argv = require('yargs').argv

async function init () {
    const overflow = generateOverflowModule()

    fs.mkdirSync(`${__dirname}/dist`, {
        recursive: true
    })

    if (argv.lint) {
        await lintCode()
    }
    await concatCode(overflow.js)
    await compileLess(overflow.css)
    await minifyHTML(overflow.html)
    await replaceInFile(overflow.replaces)
    if (argv.minify) await minifyCode(overflow.js)

    if (notifySend) {
        notifySend.notify({
            title: 'TWOverflow',
            message: 'Build complete',
            timeout: 1000
        })
    }

    fs.rmdirSync(`${__dirname}/tmp`, {
        recursive: true
    })
}

async function lintCode (data) {
    console.log('Running lint')

    const LINT_SEVERITY_CODES = {
        1: 'WARN',
        2: 'ERROR'
    }
    const eslint = require('eslint')
    const cli = new eslint.CLIEngine()
    let lint = cli.executeOnFiles(`${__dirname}/src`)
    let clean = !(lint.warningCount + lint.errorCount)

    if (!clean) {
        console.log(`Warnings: ${lint.warningCount}  Errors: ${lint.errorCount}`)
        console.log('')
    }

    lint.results.forEach(function (fileLint) {
        if (fileLint.messages.length) {
            console.log(fileLint.filePath)

            fileLint.messages.forEach(function (error) {
                let severityLabel = LINT_SEVERITY_CODES[error.severity]

                console.log(`${error.line}:${error.column}  ${severityLabel}  ${error.message}`)
            })

            console.log('')
        }
    })

    if (clean) {
        console.log('OK')
        console.log('')
    } else {
        process.exit()
    }
}

async function concatCode (data) {
    console.log('Concatenating scripts')

    const code = data.map(function (file) {
        return fs.readFileSync(`${__dirname}/${file}`, 'utf8')
    })

    fs.writeFileSync(`${__dirname}/dist/tw2overflow.js`, code.join('\n'), 'utf8')

    console.log('OK')
    console.log('')
}

async function compileLess (data) {
    console.log('Compiling styles')

    for (let destination in data) {
        const sourceLocation = data[destination]
        const source = fs.readFileSync(`${__dirname}${sourceLocation}`, 'utf8')
        const fileName = path.basename(destination)
        const destinationDir = __dirname + path.dirname(destination)

        fs.mkdirSync(destinationDir, {
            recursive: true
        })

        await require('less').render(source, {
            compress: true
        })
        .then(function (output) {
            fs.writeFileSync(`${destinationDir}/${fileName}`, output.css, 'utf8')
        })
        .catch(function (error) {
            console.log(error)
            process.exit()
        })
    }

    console.log('OK')
    console.log('')
}

async function minifyHTML (data) {
    console.log('Minifying templates')

    for (let destination in data) {
        const sourceLocation = data[destination]
        const source = fs.readFileSync(`${__dirname}${sourceLocation}`, 'utf8')

        let output = require('html-minifier').minify(source, {
            removeRedundantAttributes: true,
            removeOptionalTags: true,
            collapseWhitespace: true,
            removeComments: true,
            removeTagWhitespace: false,
            quoteCharacter: '"'
        })

        // workaround! waiting https://github.com/terser/terser/issues/518
        output = output.replace(/"/g, '\\"')

        fs.writeFileSync(`${__dirname}${destination}`, output, 'utf8')
    }

    console.log('OK')
    console.log('')
}

async function replaceInFile (data) {
    console.log('Replacing values')

    const delimiters = ['___', '']
    let target = fs.readFileSync(`${__dirname}/dist/tw2overflow.js`, 'utf8')
    let search
    let replace
    let ordered = {
        file: {},
        text: {}
    }

    for (search in data) {
        replace = data[search]

        if (replace.slice(0, 11) === '~read-file:') {
            ordered.file[search] = fs.readFileSync(__dirname + replace.slice(11), 'utf8')
        } else {
            ordered.text[search] = replace
        }
    }

    for (search in ordered.file) {
        replace = ordered.file[search]
        search = `${delimiters[0]}${search}${delimiters[1]}`

        target = replaceText(target, search, replace)
    }

    for (search in ordered.text) {
        replace = ordered.text[search]
        search = `${delimiters[0]}${search}${delimiters[1]}`

        target = replaceText(target, search, replace)
    }

    fs.writeFileSync(`${__dirname}/dist/tw2overflow.js`, target, 'utf8')

    console.log('OK')
    console.log('')
}

async function minifyCode (data) {
    console.log('Compressing script')

    const minified = require('terser').minify({
        'tw2overflow.js': fs.readFileSync(`${__dirname}/dist/tw2overflow.js`, 'utf8')
    }, {
        output: {
            quote_style: 3, // note: it's not working
            max_line_len: 1000
        }
    })
    
    if (minified.error) {
        const error = minified.error

        console.log('')
        console.log(error.filename)
        console.log(`${error.line}:${error.col}  ${error.name}  ${error.message}`)
        console.log('')

        process.exit()
    }

    fs.writeFileSync(`${__dirname}/dist/tw2overflow.min.js`, minified.code, 'utf8')

    console.log('OK')
    console.log('')
}

/**
 * generateModule will generate a object with all information/sources from
 * the the module.
 *
 * Module required files
 * - /module.json
 * - /src/core.js
 * - /src/init.js
 *
 * Module optional folders/files
 * - /src/*.js
 * - /assets/*.html
 * - /assets/*.less
 * - /lang/*.json
 */
function generateModule (moduleId, moduleDir) {
    const modulePath = `/src/modules/${moduleDir}`
    let data = {
        id: moduleId,
        dir: moduleDir,
        js: [],
        css: [],
        html: [],
        replaces: {},
        lang: false
    }

    // Load module info file
    if (fs.existsSync(`${__dirname}${modulePath}/module.json`)) {
        const modulePackage = JSON.parse(fs.readFileSync(`${__dirname}${modulePath}/module.json`, 'utf8'))

        for (let key in modulePackage) {
            data.replaces[`${moduleId}_${key}`] = modulePackage[key]
        }
    } else {
        return console.error(`Module "${moduleId}" is missing "module.json"`)
    }

    // Load the main js source
    if (fs.existsSync(`${__dirname}${modulePath}/src/core.js`)) {
        data.js.push(`${modulePath}/src/core.js`)
    } else {
        return console.error(`Module "${moduleId}" is missing "core.js"`)
    }

    // Load all complementaty js sources
    const source = glob.sync(`${__dirname}${modulePath}/src/*.js`, {
        ignore: [
            `${__dirname}${modulePath}/src/core.js`,
            `${__dirname}${modulePath}/src/init.js`
        ]
    })

    source.forEach(function (filePath) {
        data.js.push(filePath.replace(__dirname, ''))
    })

    // Load the initialization source
    if (fs.existsSync(`${__dirname}${modulePath}/src/init.js`)) {
        data.js.push(`${modulePath}/src/init.js`)
    } else {
        return console.error(`Module "${moduleId}" is missing "init.js"`)
    }


    // Load assets, if exists
    if (fs.existsSync(`${__dirname}${modulePath}/assets`)) {
        data.html = glob.sync(`${__dirname}${modulePath}/assets/*.html`).map(function (htmlPath) {
            return htmlPath.replace(__dirname, '')
        })
        data.css = glob.sync(`${__dirname}${modulePath}/assets/*.less`).map(function (cssPath) {
            return cssPath.replace(__dirname, '')
        })

        data.html.forEach(function (htmlPath) {
            htmlPath = htmlPath.replace(__dirname, '')

            const filename = path.basename(htmlPath, '.html')
            data.replaces[`${moduleId}_html_${filename}`] = htmlPath
        })

        data.css.forEach(function (cssPath) {
            cssPath = cssPath.replace(__dirname, '')
            const filename = path.basename(cssPath, '.less')
            data.replaces[`${moduleId}_css_${filename}`] = cssPath
        })
    }

    // Load languages, if exists
    if (fs.existsSync(`${__dirname}${modulePath}/lang`)) {
        data.lang = glob.sync(`${modulePath}/lang/*.json`).map(function (langPath) {
            return langPath.replace(__dirname, '')
        })

        generateLocaleFile(data)
    }

    return data
}

/**
 * generateLocaleFile will load generate a single .json file from
 * all .json inside the {module}/lang folder.
 */
function generateLocaleFile (module) {
    let langData = {}

    module.lang.forEach(function (langPath) {
        const id = path.basename(langPath, '.json')
        const data = JSON.parse(fs.readFileSync(langPath, 'utf8'))

        langData[id] = data
    })

    langData = JSON.stringify(langData)

    fs.mkdirSync(`${__dirname}/tmp/src/modules/${module.dir}/lang`, {
        recursive: true
    })

    fs.writeFileSync(`${__dirname}/tmp/src/modules/${module.dir}/lang/lang.json`, langData, 'utf8')
}

/**
 * Parse all modules inside /src/modules and generate info objects
 * from each with generateModule().
 */
function generateModules () {
    let modules = []

    fs.readdirSync(`${__dirname}/src/modules/`).forEach(function (moduleDir) {
        if (!fs.existsSync(`${__dirname}/src/modules/${moduleDir}/module.json`)) {
            return false
        }

        const info = JSON.parse(fs.readFileSync(`${__dirname}/src/modules/${moduleDir}/module.json`, 'utf8'))

        if (argv.only && argv.only !== info.id && info.id !== 'interface') {
            console.log(`Ignoring module ${info.id}`)

            return false
        }

        if (argv.ignore && argv.ignore.split(',').includes(info.id)) {
            console.log(`Ignoring module ${info.id}`)

            return false
        }

        modules.push(generateModule(info.id, moduleDir))
    })

    return modules
}

function generateOverflowModule () {
    const modules = generateModules()

    // Store information from all modules as a single module to be build.
    let overflow = {
        js: [],
        html: {},
        css: {},
        replaces: {},
        lang: {}
    }

    overflow.js = overflow.js.concat([
        `/src/header.js`,
        `/src/event-scope.js`,
        `/src/utils.js`,
        `/src/ready.js`,
        `/src/configs.js`,
        `/src/language.js`,
        `/src/settings.js`,
        `/src/map-data.js`,
        `/src/ui.js`,
        `/src/init.js`,
        `/src/libs/lockr.js`
    ])

    // Generate the common translations
    generateLocaleFile({
        lang: glob.sync(`src/lang/*.json`),
        dir: 'core'
    })

    // Generate the common replaces
    overflow.replaces['overflow_name'] = pkg.name
    overflow.replaces['overflow_version'] = pkg.version + (argv.dev ? '-dev' : '')
    overflow.replaces['overflow_author_name'] = pkg.author.name
    overflow.replaces['overflow_author_url'] = pkg.author.url
    overflow.replaces['overflow_author_email'] = pkg.author.email
    overflow.replaces['overflow_author'] = JSON.stringify(pkg.author)
    overflow.replaces['overflow_date'] = new Date().toUTCString()
    // overflow.replaces['overflow_lang'] = fs.readFileSync(`${__dirname}/tmp/src/modules/core/lang/lang.json`, 'utf8')
    overflow.replaces['overflow_lang'] = `~read-file:/tmp/src/modules/core/lang/lang.json`

    // Move all modules information to a single module (overflow)
    modules.forEach(function (module) {
        // js
        overflow.js = overflow.js.concat(module.js)

        // html
        module.html.forEach(function (htmlPath) {
            overflow.html[`/tmp${htmlPath}`] = htmlPath
        })

        // css
        module.css.forEach(function (lessPath) {
            const cssPath = lessPath.replace(/\.less$/, '.css')
            overflow.css[`/tmp${cssPath}`] = lessPath
        })

        // lang
        if (module.lang) {
            overflow.replaces[`${module.id}_lang`] = `~read-file:/tmp/src/modules/${module.dir}/lang/lang.json`
        }

        // replaces
        for (let id in module.replaces) {
            const value = module.replaces[id]

            // If the replace value is a file, create a template to
            // grunt replace later.
            if (fs.existsSync(`${__dirname}/${value}`)) {
                let filePath = value
                const ext = path.extname(value)

                if (ext === '.less') {
                    filePath = filePath.replace(/\.less$/, '.css')
                }

                // lang replaces already have the temporary path included.
                if (id !== `${module.id}_lang`) {
                    filePath = `/tmp${filePath}`
                }

                overflow.replaces[id] = `~read-file:${filePath}`
            } else {
                overflow.replaces[id] = value
            }   
        }
    })

    overflow.js.push(`/src/footer.js`)

    // Load core assets, if exists
    if (fs.existsSync(`${__dirname}/src/assets`)) {
        fs.mkdirSync(`${__dirname}/tmp/src/assets`, {
            recursive: true
        })

        glob.sync(`${__dirname}/src/assets/*.html`).forEach(function (htmlPath) {
            htmlPath = htmlPath.replace(__dirname, '')

            const filename = path.basename(htmlPath, '.html')

            overflow.replaces[`overflow_html_${filename}`] = `~read-file:/tmp${htmlPath}`
            overflow.html[`${__dirname}/tmp${htmlPath}`] = `${__dirname}${htmlPath}`
        })

        glob.sync(`${__dirname}/src/assets/*.less`).forEach(function (lessPath) {
            lessPath = lessPath.replace(__dirname, '')

            const filename = path.basename(lessPath, '.less')

            overflow.replaces[`overflow_css_${filename}`] = `~read-file:/tmp${lessPath}`
            overflow.css[`/tmp${lessPath}`] = `${lessPath}`
        })
    }

    return overflow
}

function concatFiles (files) {
    return files.map(function (file) {
        return fs.readFileSync(file, 'utf8')
    }).join('\n')
}

function replaceText (source, token, replace) {
    let index = 0

    do {
        source = source.replace(token, replace)
    } while((index = source.indexOf(token, index + 1)) > -1)

    return source
}

init()
