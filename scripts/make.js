const fs = require('fs')
const glob = require('glob')
const path = require('path')
const pkg = require('../package.json')
const parseOptions = require('./parse-options.js')
const terser = require('terser')
const less = require('less')
const htmlMinifier = require('html-minifier').minify

const distDir = './dist'
const tempDir = '/tmp'

const terserOptions = {
    output: {
        quote_style: 3, // note: it's not working
        max_line_len: 1000
    }
}
const lessOptions = {
    compress: true
}
const replaceOptions = {
    delimiters: ['{:', ':}']
}

async function init () {
    const options = parseOptions()
    const overflow = generateOverflowModule(options)

    fs.mkdirSync(distDir, {
        recursive: true
    })

    await concatCode(overflow.js)
    await compileLess(overflow.css)
    await minifyHTML(overflow.html)
    await replaceInFile(overflow.replaces)

    if (options.minify) {
        await minifyCode(overflow.js)
    }
}

async function concatCode (data) {
    const code = data.map(function (file) {
        log('Concatenating', file)

        return fs.readFileSync(file, 'utf8')
    })

    fs.writeFileSync(`${distDir}/tw2overflow.js`, code.join('\n'), 'utf8')
}

async function compileLess (data) {
    for (let destination in data) {
        const sourceLocation = data[destination]
        const source = fs.readFileSync(sourceLocation, 'utf8')

        fs.mkdirSync(path.dirname(destination), {
            recursive: true
        })

        log('Compiling .less', sourceLocation)

        await less.render(source, lessOptions)
        .then(function (output) {
            fs.writeFileSync(destination, output.css, 'utf8')
        })
        .catch(function (error) {
            console.log(error)
            process.exit()
        })
    }
}

async function minifyHTML (data) {
    for (let destination in data) {
        const sourceLocation = data[destination]
        const source = fs.readFileSync(sourceLocation, 'utf8')

        log('Minifying .html', sourceLocation)

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
    }
}

async function replaceInFile (data) {
    let target = fs.readFileSync(`${distDir}/tw2overflow.js`, 'utf8')
    let search
    let replace
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
        search = `${replaceOptions.delimiters[0]} ${search} ${replaceOptions.delimiters[1]}`

        log('Replacing', search)

        target = replaceText(target, search, replace)
    }

    for (search in ordered.text) {
        replace = ordered.text[search]
        search = `${replaceOptions.delimiters[0]} ${search} ${replaceOptions.delimiters[1]}`

        log('Replacing', search)

        target = replaceText(target, search, replace)
    }

    fs.writeFileSync(`${distDir}/tw2overflow.js`, target, 'utf8')
}

async function minifyCode (data) {
    log('Minifying .js', `${distDir}/tw2overflow.min.js`)

    const minified = terser.minify({
        'tw2overflow.js': fs.readFileSync(`${distDir}/tw2overflow.js`, 'utf8')
    }, terserOptions)

    fs.writeFileSync(`${distDir}/tw2overflow.min.js`, minified.code, 'utf8')
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
    const modulePath = `src/modules/${moduleDir}`
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

    fs.readdirSync('src/modules/').forEach(function (moduleDir) {
        if (!fs.existsSync(`src/modules/${moduleDir}/module.json`)) {
            return false
        }

        const info = JSON.parse(fs.readFileSync(`src/modules/${moduleDir}/module.json`, 'utf8'))

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
        'src/header.js',
        'src/event-scope.js',
        'src/utils.js',
        'src/ready.js',
        'src/configs.js',
        'src/language.js',
        'src/settings.js',
        'src/map-data.js',
        'src/init.js',
        'src/libs/lockr.js'
    ])

    // Generate the common translations
    generateLocaleFile({
        lang: glob.sync(`src/lang/*.json`),
        dir: 'core'
    })

    // Generate the common replaces
    overflow.replaces['overflow_title'] = pkg.title
    overflow.replaces['overflow_version'] = pkg.version
    overflow.replaces['overflow_author'] = JSON.stringify(pkg.author)
    overflow.replaces['overflow_author_name'] = pkg.author.name
    overflow.replaces['overflow_author_url'] = pkg.author.url
    overflow.replaces['overflow_author_email'] = pkg.author.email
    overflow.replaces['overflow_date'] = new Date().toLocaleString()
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

    overflow.js.push('src/footer.js')

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

function log () {
    let args = arguments
    args[0] = `\x1b[32m${args[0]}\x1b[0m`
    console.log.apply(this, args)
}

init()
