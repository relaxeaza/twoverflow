var fs = require('fs')
var glob = require('glob')
var path = require('path')
var mkdirp = require('mkdirp')
var https = require('https')
var request = require('request')
var pkg = require('../package.json')
var unzip = require('unzip')
var approvedMinRequired = 50
var apiKey = process.argv[2]
var gameLanguageCodes = {
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

var downloadTranslations = function (callback) {
    mkdirp.sync('../dist/temp/crowdin/')

    var url = `https://api.crowdin.com/api/project/twoverflow/download/all.zip?key=${apiKey}`
    var zip = fs.createWriteStream('../dist/temp/crowdin/all.zip')
    var req = https.get(url, function (res) {
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

var getTranslationStatus = function (callback) {
    var url = `https://api.crowdin.com/api/project/twoverflow/status?key=${apiKey}&json`
    
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

var run = function () {
    downloadTranslations(function () {
        getTranslationStatus(function (status) {
            status.forEach(function (languageStatus) {
                if (languageStatus.approved_progress > approvedMinRequired) {
                    console.log(`Generating ${languageStatus.code} translations...`)

                    var languageFiles = glob.sync(`../dist/temp/crowdin/all/${languageStatus.code}/twoverflow/*.json`)
                    var languageCode = gameLanguageCodes[languageStatus.code]

                    languageFiles.forEach(function (languageFile) {
                        var moduleName = path.basename(languageFile, '.json')
                        var languageStream = fs.readFileSync(languageFile, 'utf8')
                        var destPath = `../src/modules/${moduleName}/lang/${languageCode}.json`

                        fs.writeFileSync(destPath, languageStream, 'utf8')
                    })

                    console.log('OK!')
                }
            })
        })
    })
}

(function () {
    if (apiKey.indexOf('--api') !== 0) {
        console.log('Missing crowdin api key!')

        return false
    }

    apiKey = apiKey.replace('--api=', '')

    // run()
})()
