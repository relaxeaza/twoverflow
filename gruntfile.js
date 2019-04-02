var fs = require('fs')
var glob = require('glob')
var path = require('path')
var mkdirp = require('mkdirp')
var pkg = require('./package.json')

// Temporary build files location
var temp = 'dist/temp'

// Store modules information generated with generateModule()
var modules = []

// Store information from all modules as a single module to be build.
var overflow = {
    js: [],
    html: {},
    css: {},
    replaces: [],
    locales: {}
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
 * - /ui/ui.js
 * - /ui/*.html
 * - /ui/*.less
 * - /locale/*.json
 */
var generateModule = function (moduleId, moduleDir) {
    var modulePath = `src/modules/${moduleDir}`
    var data = {
        id: moduleId,
        dir: moduleDir,
        js: [],
        css: [],
        html: [],
        replaces: {},
        locales: false
    }

    // Load module info file

    if (fs.existsSync(`${modulePath}/module.json`)) {
        var modulePackage = JSON.parse(fs.readFileSync(`${modulePath}/module.json`, 'utf8'))

        for (var key in modulePackage) {
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

    var source = glob.sync(`${modulePath}/src/*.js`, {
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

    // Load the interface source, if exists

    var hasInterfacePath = fs.existsSync(`${modulePath}/ui`)
    var hasInterfaceFile = fs.existsSync(`${modulePath}/ui/ui.js`)

    if (hasInterfacePath) {
        if (hasInterfaceFile) {
            data.js.push(`${modulePath}/ui/ui.js`)
        }

        data.html = glob.sync(`${modulePath}/ui/*.html`)
        data.css = glob.sync(`${modulePath}/ui/*.less`)

        data.html.forEach(function (htmlPath) {
            var filename = path.basename(htmlPath, '.html')
            data.replaces[`${moduleId}_html_${filename}`] = htmlPath
        })

        data.css.forEach(function (cssPath) {
            var filename = path.basename(cssPath, '.less')
            data.replaces[`${moduleId}_css_${filename}`] = cssPath
        })
    }

    // Load the locale source, if exists

    if (fs.existsSync(`${modulePath}/locale`)) {
        data.locales = glob.sync(`${modulePath}/locale/*.json`)

        generateLocaleFile(data)
    }

    return data
}

/**
 * generateLocaleFile will load generate a single .json file from
 * all .json inside the {module}/locales folder.
 */
var generateLocaleFile = function (module) {
    var localeData = {}

    module.locales.forEach(function (localePath) {
        var id = path.basename(localePath, '.json')
        var data = JSON.parse(fs.readFileSync(localePath, 'utf8'))

        localeData[id] = data
    })

    localeData = JSON.stringify(localeData)

    mkdirp.sync(`${temp}/src/modules/${module.dir}/locale`)
    fs.writeFileSync(`${temp}/src/modules/${module.dir}/locale/locales.json`, localeData, 'utf8')
}

/**
 * Parse all modules inside /src/modules and generate info objects
 * from each with generateModule().
 */
var generateAllModules = function (excludeModules) {
    fs.readdirSync('src/modules/').forEach(function (moduleDir) {
        if (!fs.existsSync(`src/modules/${moduleDir}/module.json`)) {
            return false
        }

        var moduleInfo = JSON.parse(fs.readFileSync(`src/modules/${moduleDir}/module.json`, 'utf8'))

        if (excludeModules && excludeModules.includes(moduleInfo.id)) {
            console.log(`Ignoring module ${moduleInfo.id}`)
            return false
        }

        var moduleData = generateModule(moduleInfo.id, moduleDir)

        modules.push(moduleData)
    })
}

module.exports = function (grunt) {
    var excludeModules = grunt.option('exclude')

    generateAllModules(excludeModules)

    overflow.js = overflow.js.concat([
        'src/libs/lockr.js',
        'src/libs/i18n.js',
        'src/libs/ejs.js',
        'src/header.js',
        'src/event-queue.js',
        'src/event-scope.js',
        'src/utils.js',
        'src/locale.js',
        'src/ready.js',
        'src/configs.js',
        'src/init.js'
    ])

    // Generate the common translations

    generateLocaleFile({
        locales: glob.sync(`src/locale/*.json`),
        dir: 'core'
    })

    // Generate the common replaces

    overflow.replaces.push({
        json: {
            overflow_title: pkg.title,
            overflow_version: pkg.version,
            overflow_author: JSON.stringify(pkg.author),
            overflow_author_name: pkg.author.name,
            overflow_author_url: pkg.author.url,
            overflow_date: new Date().toLocaleString(),
            overflow_locales: fs.readFileSync(`${temp}/src/modules/core/locale/locales.json`, 'utf8')
        }
    })

    // Move all modules information to a single module (overflow)

    modules.forEach(function (module) {
        // js

        overflow.js = overflow.js.concat(module.js)

        // html

        module.html.forEach(function (htmlPath) {
            overflow.html[`${temp}/${htmlPath}`] = htmlPath
        })

        // css

        module.css.forEach(function (lessPath) {
            var cssPath = lessPath.replace(/\.less$/, '.css')
            overflow.css[`${temp}/${cssPath}`] = lessPath
        })

        // locales

        if (module.locales) {
            module.replaces[`${module.id}_locale`] = `${temp}/src/modules/${module.dir}/locale/locales.json`
        }

        // replaces

        var replaces = {}

        for (var id in module.replaces) {
            var value = module.replaces[id]

            // If the replace value is a file, create a template to
            // grunt replace later.
            if (fs.existsSync(value)) {
                var filePath = value
                var ext = path.extname(value)

                if (ext === '.less') {
                    filePath = filePath.replace(/\.less$/, '.css')
                }

                // locale replaces already have the temporary path included.
                if (id !== `${module.id}_locale`) {
                    filePath = `${temp}/${filePath}`
                }

                replaces[id] = `<%= grunt.file.read("${filePath}") %>`
            } else {
                replaces[id] = value
            }   
        }

        overflow.replaces.push({
            json: replaces
        })
    })

    overflow.js.push('src/footer.js')

    grunt.initConfig({
        concat: {
            build: {
                src: overflow.js,
                dest: `${temp}/${pkg.name}.js`
            }
        },
        eslint: {
            options: {
                configFile: '.eslintrc.json',
                quiet: true
            },
            build: overflow.js
        },
        less: {
            build: {
                options: {
                    compress: true,
                    ieCompat: false
                },
                files: overflow.css
            }
        },
        htmlmin: {
            build: {
                options: {
                    removeComments: true,
                    collapseWhitespace: true,
                    ignoreCustomFragments: [/\<\#[\s\S]*?\#\>/]
                },
                files: overflow.html
            }
        },
        replace: {
            build: {
                options: {
                    prefix: '__',
                    patterns: overflow.replaces
                },
                files: [{
                    expand: true,
                    flatten: true,
                    src: [
                        `${temp}/${pkg.name}.js`
                    ],
                    dest: 'dist/'
                }]
            }
        },
        uglify: {
            options: {
                sourceMap: true,
                sourceMapName: `dist/${pkg.name}.map`,
                banner: `/*! ${pkg.name}.min.js@${pkg.version} | Licence ${pkg.license} */`
            },
            build: {
                files: {
                    [`dist/${pkg.name}.min.js`]: `dist/${pkg.name}.js`
                }
            }
        },
        clean: {
            build: [temp]
        }
    })

    grunt.loadNpmTasks('grunt-eslint')
    grunt.loadNpmTasks('grunt-contrib-concat')
    grunt.loadNpmTasks('grunt-contrib-less')
    grunt.loadNpmTasks('grunt-contrib-htmlmin')
    grunt.loadNpmTasks('grunt-replace')
    grunt.loadNpmTasks('grunt-contrib-clean')
    grunt.loadNpmTasks('grunt-contrib-copy')

    var tasks = [
        'eslint',
        'concat',
        'less',
        'htmlmin',
        'replace'
    ]

    var flags = grunt.option.flags()

    if (flags.includes('--minify')) {
        grunt.loadNpmTasks('grunt-contrib-uglify-es')
        tasks.push('uglify')
    }

    if (!flags.includes('--keep-temp')) {
        tasks.push('clean')
    }

    grunt.registerTask('build', tasks)
}
