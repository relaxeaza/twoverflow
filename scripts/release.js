let fs = require('fs')
let mkdirp = require('mkdirp')
let package = JSON.parse(fs.readFileSync(`package.json`, 'utf8'))
let git = require('git-promise')
let isTestingRelease = process.argv[2] === '--testing'

let cdnPath = 'cdn'
let releasesPath = `${cdnPath}/public/releases`
let testingPath = `${releasesPath}/testing`

function copyFiles (files, ignoreSame) {
    if (!ignoreSame) {
        for (let original in files) {
            let destination = files[original]
            let originalBuffer = fs.readFileSync(original)
            let destinationExists = fs.existsSync(destination)

            if (destinationExists) {
                let destinationBuffer = fs.readFileSync(destination)

                if (originalBuffer.equals(destinationBuffer)) {
                    return false
                }
            }
        }
    }

    for (let original in files) {
        let destination = files[original]
        console.log(`Copying ${original} to ${destination}`)
        fs.copyFileSync(original, destination)
    }

    return true
}

function gitDeploy (commitMsg) {
    console.log('')

    let opt = {
        cwd: `${cdnPath}/`
    }

    let add = function () {
        console.log('Running git add')

        return git('add --all', opt)
            .fail(function () {
                console.log('git add failed.')
            })
    }

    let commit = function () {
        console.log('Running git commit')

        return git(`commit --message "${commitMsg}"`, opt)
            .fail(function (error) {
                console.log('git commit failed.')
                console.log(error.stdout)
            })
    }

    let push = function () {
        console.log('Running git push')
        
        return git('push', opt)
            .fail(function (error) {
                console.log('git push fail')
                console.log(error.stdout)
            })
    }

    add()
    .then(commit)
    .then(push)
    .then(function () {
        console.log('')
        console.log('Done')
    })
}

function deployTesting () {
    let copied = copyFiles({
        'dist/tw2overflow.map': `${testingPath}/tw2overflow.map`,
        'dist/tw2overflow.js': `${testingPath}/tw2overflow.js`,
        'dist/tw2overflow.min.js': `${testingPath}/tw2overflow.min.js`
    })

    if (copied) {   
        gitDeploy('Update testing version')
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
    mkdirp.sync(`${releasesPath}/${package.version}`)

    copyFiles({
        'dist/tw2overflow.map': `${releasesPath}/${package.version}/tw2overflow.map`,
        'dist/tw2overflow.js': `${releasesPath}/${package.version}/tw2overflow.js`,
        'dist/tw2overflow.min.js': `${releasesPath}/${package.version}/tw2overflow.min.js`
    }, true)

    copyFiles({
        'dist/tw2overflow.map': `${releasesPath}/latest/tw2overflow.map`,
        'dist/tw2overflow.js': `${releasesPath}/latest/tw2overflow.js`,
        'dist/tw2overflow.min.js': `${releasesPath}/latest/tw2overflow.min.js`
    }, true)

    gitDeploy(`v${package.version} release`)
}

if (isTestingRelease) {
    deployTesting()
} else {
    deployProduction()
}
