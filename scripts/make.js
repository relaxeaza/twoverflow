const fs = require('fs')
const glob = require('glob')
const path = require('path')
const pkg = require('../package.json')
const parseOptions = require('./parse-options.js')
const terser = require('terser')
const less = require('less')
const htmlMinifier = require('html-minifier').minify
const eslint = require('eslint')
const notifySend = require('node-notifier')
const LINT_SEVERITY_CODES = {
    1: 'WARN',
    2: 'ERROR'
}
const root = path.dirname(__dirname)
const distDir = `${root}/dist`
const srcDir = `${root}/src`
const tempDir = `${root}/tmp`

async function init () {
    const options = parseOptions()
    const overflow = generateOverflowModule(options)

    fs.mkdirSync(distDir, {
        recursive: true
    })

    if (options.lint) await lintCode()
    await concatCode(overflow.js)
    await compileLess(overflow.css)
    await minifyHTML(overflow.html)
    await replaceInFile(overflow.replaces)
    if (options.minify) await minifyCode(overflow.js)

    if (notifySend) {
        notifySend.notify({
            title: 'TWOverflow',
            message: 'Build complete',
            timeout: 1000
        })
    }

    fs.rmdirSync(tempDir, { recursive: true })
}

async function lintCode (data) {
    console.log('Running lint')

    let cli = new eslint.CLIEngine()
    let lint = cli.executeOnFiles(srcDir)
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
    console.log('Concatenating sources')

    let fileCount = 0

    const code = data.map(function (file) {
        fileCount++
        return fs.readFileSync(file, 'utf8')
    })

    fs.writeFileSync(`${distDir}/tw2overflow.js`, code.join('\n'), 'utf8')

    console.log(`OK [${fileCount} js files]`)
    console.log('')
}

async function compileLess (data) {
    console.log('Compiling styles')

    let fileCount = 0

    for (let destination in data) {
        const sourceLocation = data[destination]
        const source = fs.readFileSync(sourceLocation, 'utf8')

        fs.mkdirSync(path.dirname(destination), {
            recursive: true
        })

        await less.render(source, {
            compress: true
        })
        .then(function (output) {
            fs.writeFileSync(destination, output.css, 'utf8')
        })
        .catch(function (error) {
            console.log(error)
            process.exit()
        })

        fileCount++
    }

    console.log(`OK [${fileCount} styles]`)
    console.log('')
}

async function minifyHTML (data) {
    console.log('Minifying HTML')

    let fileCount = 0

    for (let destination in data) {
        const sourceLocation = data[destination]
        const source = fs.readFileSync(sourceLocation, 'utf8')

        let output = htmlMinifier(source, {
            removeRedundantAttributes: true,
            removeOptionalTags: true,
            collapseWhitespace: true,
            ignoreCustomFragments: [/\<\#[\s\S]*?\#\>/],
            removeComments: true,
            removeTagWhitespace: false,
            quoteCharacter: '"'
        })

        // workaround! waiting https://github.com/terser/terser/issues/518
        output = output.replace(/"/g, '\\"')

        fs.writeFileSync(destination, output, 'utf8')

        fileCount++
    }

    console.log(`OK [${fileCount} html files]`)
    console.log('')
}

async function replaceInFile (data) {
    console.log('Replacing in file')

    const delimiters = ['___', '']
    let target = fs.readFileSync(`${distDir}/tw2overflow.js`, 'utf8')
    let search
    let replace
    let replaceCount = 0
    let ordered = {
        file: {},
        text: {}
    }

    for (search in data) {
        replace = data[search]

        if (replace.slice(0, 11) === '~read-file:') {
            ordered.file[search] = fs.readFileSync(replace.slice(11), 'utf8')
        } else {
            ordered.text[search] = replace
        }
    }

    for (search in ordered.file) {
        replace = ordered.file[search]
        search = `${delimiters[0]}${search}${delimiters[1]}`

        target = replaceText(target, search, replace)

        replaceCount++
    }

    for (search in ordered.text) {
        replace = ordered.text[search]
        search = `${delimiters[0]}${search}${delimiters[1]}`

        target = replaceText(target, search, replace)

        replaceCount++
    }

    fs.writeFileSync(`${distDir}/tw2overflow.js`, target, 'utf8')

    console.log(`OK [${replaceCount} replaces]`)
    console.log('')
}

async function minifyCode (data) {
    console.log('Minifying code')

    const minified = terser.minify({
        'tw2overflow.js': fs.readFileSync(`${distDir}/tw2overflow.js`, 'utf8')
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

    fs.writeFileSync(`${distDir}/tw2overflow.min.js`, minified.code, 'utf8')

    console.log('OK', `[${distDir}/tw2overflow.min.js]`.replace(root, ''))
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
    const modulePath = `${root}/src/modules/${moduleDir}`
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
    if (fs.existsSync(`${modulePath}/module.json`)) {
        const modulePackage = JSON.parse(fs.readFileSync(`${modulePath}/module.json`, 'utf8'))

        for (let key in modulePackage) {
            data.replaces[`${moduleId}_${key}`] = modulePackage[key]
        }
    } else {
        return console.error(`Module "${moduleId}" is missing "module.json"`)
    }

    // Load the main js source
    if (fs.existsSync(`${modulePath}/src/core.js`)) {
        data.js.push(`${modulePath}/src/core.js`)
    } else {
        return console.error(`Module "${moduleId}" is missing "core.js"`)
    }

    // Load all complementaty js sources
    const source = glob.sync(`${modulePath}/src/*.js`, {
        ignore: [
            `${modulePath}/src/core.js`,
            `${modulePath}/src/init.js`
        ]
    })

    source.forEach(function (filePath) {
        data.js.push(filePath)
    })

    // Load the initialization source
    if (fs.existsSync(`${modulePath}/src/init.js`)) {
        data.js.push(`${modulePath}/src/init.js`)
    } else {
        return console.error(`Module "${moduleId}" is missing "init.js"`)
    }

    // Load assets, if exists
    if (fs.existsSync(`${modulePath}/assets`)) {
        data.html = glob.sync(`${modulePath}/assets/*.html`)
        data.css = glob.sync(`${modulePath}/assets/*.less`)

        data.html.forEach(function (htmlPath) {
            const filename = path.basename(htmlPath, '.html')
            data.replaces[`${moduleId}_html_${filename}`] = htmlPath
        })

        data.css.forEach(function (cssPath) {
            const filename = path.basename(cssPath, '.less')
            data.replaces[`${moduleId}_css_${filename}`] = cssPath
        })
    }

    // Load languages, if exists
    if (fs.existsSync(`${modulePath}/lang`)) {
        data.lang = glob.sync(`${modulePath}/lang/*.json`)

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

    fs.mkdirSync(`${tempDir}/src/modules/${module.dir}/lang`, {
        recursive: true
    })

    fs.writeFileSync(`${tempDir}/src/modules/${module.dir}/lang/lang.json`, langData, 'utf8')
}

/**
 * Parse all modules inside /src/modules and generate info objects
 * from each with generateModule().
 */
function generateModules (options) {
    let modules = []

    fs.readdirSync(`${root}/src/modules/`).forEach(function (moduleDir) {
        if (!fs.existsSync(`${root}/src/modules/${moduleDir}/module.json`)) {
            return false
        }

        const info = JSON.parse(fs.readFileSync(`${root}/src/modules/${moduleDir}/module.json`, 'utf8'))

        if (options.only && options.only !== info.id && info.id !== 'interface') {
            console.log(`Ignoring module ${info.id}`)

            return false
        }

        if (options.ignore && options.ignore.split(',').includes(info.id)) {
            console.log(`Ignoring module ${info.id}`)

            return false
        }

        modules.push(generateModule(info.id, moduleDir))
    })

    return modules
}

function generateOverflowModule (options) {
    const modules = generateModules({
        ignore: options.ignore,
        only: options.only
    })

    // Store information from all modules as a single module to be build.
    let overflow = {
        js: [],
        html: {},
        css: {},
        replaces: {},
        lang: {}
    }

    overflow.js = overflow.js.concat([
        `${root}/src/header.js`,
        `${root}/src/event-scope.js`,
        `${root}/src/utils.js`,
        `${root}/src/ready.js`,
        `${root}/src/configs.js`,
        `${root}/src/language.js`,
        `${root}/src/settings.js`,
        `${root}/src/map-data.js`,
        `${root}/src/ui.js`,
        `${root}/src/init.js`,
        `${root}/src/libs/lockr.js`
    ])

    // Generate the common translations
    generateLocaleFile({
        lang: glob.sync(`src/lang/*.json`),
        dir: 'core'
    })

    // Generate the common replaces
    overflow.replaces['overflow_name'] = pkg.name
    overflow.replaces['overflow_version'] = pkg.version + (options.dev ? '-dev' : '')
    overflow.replaces['overflow_author_name'] = pkg.author.name
    overflow.replaces['overflow_author_url'] = pkg.author.url
    overflow.replaces['overflow_author_email'] = pkg.author.email
    overflow.replaces['overflow_author'] = JSON.stringify(pkg.author)
    overflow.replaces['overflow_date'] = new Date().toUTCString()
    overflow.replaces['overflow_lang'] = fs.readFileSync(`${tempDir}/src/modules/core/lang/lang.json`, 'utf8')

    // Move all modules information to a single module (overflow)
    modules.forEach(function (module) {
        // js
        overflow.js = overflow.js.concat(module.js)

        // html
        module.html.forEach(function (htmlPath) {
            overflow.html[`${tempDir}/${htmlPath}`] = htmlPath
        })

        // css
        module.css.forEach(function (lessPath) {
            const cssPath = lessPath.replace(/\.less$/, '.css')
            overflow.css[`${tempDir}/${cssPath}`] = lessPath
        })

        // lang
        if (module.lang) {
            overflow.replaces[`${module.id}_lang`] = `~read-file:${tempDir}/src/modules/${module.dir}/lang/lang.json`
        }

        // replaces
        for (let id in module.replaces) {
            const value = module.replaces[id]

            // If the replace value is a file, create a template to
            // grunt replace later.
            if (fs.existsSync(value)) {
                let filePath = value
                const ext = path.extname(value)

                if (ext === '.less') {
                    filePath = filePath.replace(/\.less$/, '.css')
                }

                // lang replaces already have the temporary path included.
                if (id !== `${module.id}_lang`) {
                    filePath = `${tempDir}/${filePath}`
                }

                overflow.replaces[id] = `~read-file:${filePath}`
            } else {
                overflow.replaces[id] = value
            }   
        }
    })

    overflow.js.push(`${root}/src/footer.js`)

    // Load core assets, if exists
    if (fs.existsSync(`${srcDir}/assets`)) {
        // GOD FORGIVE ME
        fs.mkdirSync(`${tempDir}/${srcDir}/assets`, {
            recursive: true
        })

        glob.sync(`${srcDir}/assets/*.html`).forEach(function (htmlPath) {
            const filename = path.basename(htmlPath, '.html')
            overflow.replaces[`overflow_html_${filename}`] = `~read-file:${tempDir}/${htmlPath}`
            overflow.html[`${tempDir}/${htmlPath}`] = htmlPath
        })

        glob.sync(`${srcDir}/assets/*.less`).forEach(function (lessPath) {
            const filename = path.basename(lessPath, '.less')
            overflow.replaces[`overflow_css_${filename}`] = `~read-file:${tempDir}/${lessPath}`
            overflow.css[`${tempDir}/${lessPath}`] = lessPath
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
