const fs = require('fs')
const glob = require('glob')
const path = require('path')
const https = require('https')
const projectRoot = __dirname.replace(/\\/g, '/')

const approvedMinRequired = 0 // %
const translatedMinRequired = 50 // %

const gameLanguageCodes = {
    'cs': 'cs_cz',
    'nl': 'nl_nl',
    'en': 'en_us',
    'fr': 'fr_fr',
    'de': 'de_de',
    'el': 'el_gr',
    'pl': 'pl_pl',
    'pt-BR': 'pt_br',
    'ro': 'ro_ro',
    'ru': 'ru_ru',
    'es-ES': 'es_es'
}

async function init () {
    if (!validSource()) {
        return console.log('Invalid translation source')
    }

    const crowdinKey = getCrowdinKey()

    if (!crowdinKey) {
        return console.log('Missing crowdin project api key (share/keys/crowdin.key)')
    }

    const translationStatus = await getTranslationStatus(crowdinKey)
    const allowedTranslations = translationStatus.filter(function (item) {
        const approved = item.approved_progress >= approvedMinRequired
        const translated = item.translated_progress >= translatedMinRequired

        return approved && translated
    })

    allowedTranslations.forEach(function (status) {
        const languageCode = gameLanguageCodes[status.code]
        const languageFiles = glob.sync(`${projectRoot}/share/translations/${status.code}/twoverflow/*.json`)

        languageFiles.forEach(function (languageFile) {
            let moduleName = path.basename(languageFile, '.json')
            let languageStream = fs.readFileSync(languageFile, 'utf8')
            let destPath

            if (moduleName === 'twoverflow') {
                destPath = `${projectRoot}/src/lang/${languageCode}.json`
            } else {
                destPath = `${projectRoot}/src/modules/${moduleName}/lang/${languageCode}.json`
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
    if (!fs.existsSync(`${projectRoot}/share/keys/crowdin.key`)) {
        return false
    }

    return fs.readFileSync(`${projectRoot}/share/keys/crowdin.key`, 'utf8').trim()
}

function validSource () {
    return Object.keys(gameLanguageCodes).every(function (languageDir) {
        return fs.existsSync(`${projectRoot}/share/translations/${languageDir}/twoverflow/twoverflow.json`)
    })
}

init()
