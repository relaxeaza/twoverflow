let fs = require('fs')
let glob = require('glob')
let path = require('path')
let mkdirp = require('mkdirp')
let https = require('https')
let request = require('request')
let unzip = require('unzipper')

let approvedMinRequired = false // %
let translatedMinRequired = 40 // %

let api = process.argv[2]
let gameLanguageCodes = {
    'cs': 'cs_cz',
    'da': 'da_dk',
    'de': 'de_de',
    'el': 'el_gr',
    'en': 'en_us',
    'es-ES': 'es_es',
    'fi': 'fi_fi',
    'fr': 'fr_fr',
    'hu': 'hu_hu',
    'it': 'it_it',
    'no': 'nb_no',
    'nl': 'nl_nl',
    'pl': 'pl_pl',
    'pt-BR': 'pt_br',
    'ro': 'ro_ro',
    'ru': 'ru_ru',
    'sk': 'sk_sk',
    'sv-SE': 'sv_se',
    'tr': 'tr_tr',
}

let deleteDirectory = function (path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            let curPath = path + '/' + file
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteDirectory(curPath)
            } else {
                fs.unlinkSync(curPath)
            }
        })
        fs.rmdirSync(path)
    }
}

let downloadTranslations = function (callback) {
    mkdirp.sync('../dist/temp/crowdin/')

    let url = `https://api.crowdin.com/api/project/twoverflow/download/all.zip?key=${api}`
    let zip = fs.createWriteStream('../dist/temp/crowdin/all.zip')
    let req = https.get(url, function (res) {
        res.pipe(zip)
        zip.on('finish', function () {
            zip = fs.createReadStream('../dist/temp/crowdin/all.zip')
            zip.pipe(unzip.Extract({
                path: '../dist/temp/crowdin/all/'
            }))

            callback()
        })
    })
}

let getTranslationStatus = function (callback) {
    let url = `https://api.crowdin.com/api/project/twoverflow/status?key=${api}&json`
    
    request.get({
        url: url,
        json: true,
        headers: {'User-Agent': 'request'}
    }, function (err, res, data) {
        if (err) {
            console.log('Error:', err)
        } else if (res.statusCode !== 200) {
            console.log('Status:', res.statusCode)
        } else {
            callback(data)
        }
    })
}

let run = function () {
    if (api.indexOf('--api=') === 0) {
        api = api.replace('--api=', '')
    } else {
        console.log('Missing crowdin api key!')
        return false
    }

    downloadTranslations(function () {
        getTranslationStatus(function (status) {
            status.forEach(function (languageStatus) {
                if (approvedMinRequired && languageStatus.approved_progress < approvedMinRequired) {
                    return false
                }

                if (translatedMinRequired && languageStatus.translated_progress < translatedMinRequired) {
                    return false
                }

                let languageFiles = glob.sync(`../dist/temp/crowdin/all/${languageStatus.code}/twoverflow/*.json`)
                let languageCode = gameLanguageCodes[languageStatus.code]

                console.log(`Generating ${languageCode} translations...`)

                languageFiles.forEach(function (languageFile) {
                    let moduleName = path.basename(languageFile, '.json')
                    let languageStream = fs.readFileSync(languageFile, 'utf8')
                    let destPath

                    if (moduleName === 'twoverflow') {
                        destPath = `../src/lang/${languageCode}.json`
                    } else {
                        destPath = `../src/modules/${moduleName}/lang/${languageCode}.json`
                    }

                    fs.writeFileSync(destPath, languageStream, 'utf8')
                })
            })

            deleteDirectory('../dist/temp/')
        })
    })
}

run()
