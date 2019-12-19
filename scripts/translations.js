const fs = require('fs')
const glob = require('glob')
const path = require('path')
const https = require('https')
const request = require('request')
const parseOptions = require('./parse-options.js')

const approvedMinRequired = false // %
const translatedMinRequired = 40 // %
const options = parseOptions()

const gameLanguageCodes = {
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

async function init () {
    if (!options.source || !path.isAbsolute(options.source)) {
        return console.log('Missing/wrong translations directory --source')
    }

    if (!validSource()) {
        return console.log('Invalid translation source')
    }

    const crowdinKey = getCrowdinKey()

    if (!crowdinKey) {
        return console.log('Missing crowdin project api key (/keys/crowdin.key)')
    }

    const translationStatus = await getTranslationStatus(crowdinKey)
    const allowedTranslations = translationStatus.filter(function (item) {
        const approved = approvedMinRequired ? item.approved_progress < approvedMinRequired : true
        const translated = translatedMinRequired ? item.translated_progress < translatedMinRequired : true
        return approved || translated
    })
    
    allowedTranslations.forEach(function (status) {
        const languageCode = gameLanguageCodes[status.code]
        const languageFiles = glob.sync(`${options.source}/${status.code}/twoverflow/*.json`)

        console.log(`Generating ${languageCode} translations...`)

        languageFiles.forEach(function (languageFile) {
            let moduleName = path.basename(languageFile, '.json')
            let languageStream = fs.readFileSync(languageFile, 'utf8')
            let destPath

            if (moduleName === 'twoverflow') {
                destPath = `./src/lang/${languageCode}.json`
            } else {
                destPath = `./src/modules/${moduleName}/lang/${languageCode}.json`
            }



            fs.writeFileSync(destPath, languageStream, 'utf8')
        })
    })
}

async function getTranslationStatus (key) {
    let url = `https://api.crowdin.com/api/project/twoverflow/status?key=${key}&json`
    
    return new Promise(function (resolve, reject) {
        https.get(url, {
            headers: {'User-Agent': 'request'}
        }, function (res) {
            let data = []

            res.on('data', function (chunk) {
                data.push(chunk)
            })

            res.on('end', function () {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data.join('')))
                    } catch (error) {
                        reject()
                    }
                } else {
                    reject()
                }
            })
        })
    })
}

function getCrowdinKey () {
    if (!fs.existsSync('./keys/crowdin.key')) {
        return false
    }

    return fs.readFileSync('./keys/crowdin.key', 'utf8').trim()
}

function validSource () {
    return Object.keys(gameLanguageCodes).every(function (languageDir) {
        return fs.existsSync(`${options.source}/${languageDir}/twoverflow/twoverflow.json`)
    })
}

init()
