define('two/language', ['helper/i18n'], function (i18n) {
    let initialized = false
    let moduleLanguages = {}
    let selectedLanguage
    const defaultLanguage = 'en_us'
    const sharedLanguages = {
        'en_dk': 'en_us',
        'pt_pt': 'pt_br'
    }

    const injectLanguage = function (moduleId) {
        if (!initialized) {
            throw new Error('Language module not initialized.')
            return false
        }

        if (!(moduleId in moduleLanguages)) {
            throw new Error('Language data for ' + moduleId + ' does not exists.')
            return false
        }

        const moduleLanguage = moduleLanguages[moduleId][selectedLanguage] || moduleLanguages[moduleId][defaultLanguage]

        i18n.setJSON(moduleLanguage)
    }

    const selectLanguage = function (language) {
        selectedLanguage = language

        if (selectedLanguage in sharedLanguages) {
            selectedLanguage = sharedLanguages[selectedLanguage]
        }

        return selectedLanguage
    }

    let twoLanguage = {}

    twoLanguage.add = function (moduleId, languages) {
        if (!initialized) {
            twoLanguage.init()
        }

        if (moduleId in moduleLanguages) {
            return false
        }

        moduleLanguages[moduleId] = languages

        injectLanguage(moduleId)
    }

    twoLanguage.init = function () {
        if (initialized) {
            return false
        }

        initialized = true
        selectedLanguage = selectLanguage($rootScope.loc.ale)

        // trigger eventTypeProvider.LANGUAGE_SELECTED_CHANGED you dumb fucks
        $rootScope.$watch('loc.ale', function (newValue, oldValue) {
            if (newValue === oldValue) {
                return false
            }

            selectLanguage($rootScope.loc.ale)

            for (let moduleId in moduleLanguages) {
                injectLanguage(moduleId)
            }
        })
    }

    return twoLanguage
})
