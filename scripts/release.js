const fs = require('fs')

if (!fs.existsSync('package.json')) {
    console.log('Run this script from project\'s root!')
    process.exit()
}

const package = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const git = require('git-promise')
const parseOptions = require('./parse-options.js')

const cdnPath = 'cdn'
const releasesPath = `${cdnPath}/public/releases`
const testingPath = `${releasesPath}/testing`

const gitOptions = {
    cwd: `${cdnPath}/`
}

function run () {
    const options = parseOptions()

    if (options.testing) {
        deployTesting()
    } else if (options.production) {
        deployProduction()
    }
}

function copyFiles (files, ignoreSame) {
    if (!ignoreSame) {
        for (let original in files) {
            const destination = files[original]

            if (fs.existsSync(destination)) {
                const originalBuffer = fs.readFileSync(original)
                const destinationBuffer = fs.readFileSync(destination)

                return !originalBuffer.equals(destinationBuffer)
            }
        }
    }

    for (let original in files) {
        const destination = files[original]
        console.log(`Copying ${original} to ${destination}`)
        fs.copyFileSync(original, destination)
    }

    return true
}

function gitAdd () {
    console.log('Running git add')

    return git('add --all', gitOptions)
        .fail(function () {
            console.log('git add failed.')
        })
}

function gitCommit () {
    console.log('Running git commit')

    return git(`commit --message "Update testing version"`, gitOptions)
        .fail(function (error) {
            console.log('git commit failed.')
            console.log(error.stdout)
        })
}

function gitPush () {
    console.log('Running git push')
    
    return git('push', gitOptions)
        .fail(function (error) {
            console.log('git push fail')
            console.log(error.stdout)
        })
}

function gitDeploy () {
    console.log('')

    gitAdd()
    .then(gitCommit)
    .then(gitPush)
    .then(function () {
        console.log('')
        console.log('Done')
    })
}

function deployTesting () {
    const copied = copyFiles({
        'dist/tw2overflow.js': `${testingPath}/tw2overflow.js`,
        'dist/tw2overflow.min.js': `${testingPath}/tw2overflow.min.js`
    }, true)

    if (copied) {
        gitDeploy()
    } else {
        console.log('Testing version is already the last build.')
    }
}

function deployProduction () {
    if (fs.existsSync(`${releasesPath}/${package.version}`)) {
        console.log(`v${package.version} is already in the repository.`)
        return false
    }

    console.log(`Creating directory ${releasesPath}/${package.version}`)

    fs.mkdirSync(`${releasesPath}/${package.version}`, {
        recursive: true
    })

    copyFiles({
        'dist/tw2overflow.js': `${releasesPath}/${package.version}/tw2overflow.js`,
        'dist/tw2overflow.min.js': `${releasesPath}/${package.version}/tw2overflow.min.js`
    }, true)

    copyFiles({
        'dist/tw2overflow.js': `${releasesPath}/latest/tw2overflow.js`,
        'dist/tw2overflow.min.js': `${releasesPath}/latest/tw2overflow.min.js`
    }, true)

    gitDeploy(`v${package.version} release`)
}

run()
