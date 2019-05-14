define('two/language', ['helper/i18n'], function (i18n) {
    var initialized = false
    var moduleLanguages = {}
    var selectedLanguage
    var defaultLanguage = 'en_us'
    var sharedLanguages = {
        'en_dk': 'en_us',
        'pt_pt': 'pt_br'
    }

    var injectLanguage = function (moduleId) {
        if (!initialized) {
            throw new Error('Language module not initialized.')
            return false
        }

        if (!(moduleId in moduleLanguages)) {
            throw new Error('Language data for ' + moduleId + ' does not exists.')
            return false
        }

        var moduleLanguage = moduleLanguages[moduleId][selectedLanguage] || moduleLanguages[moduleId][defaultLanguage]

        i18n.setJSON(moduleLanguage)
    }

    var selectLanguage = function (language) {
        selectedLanguage = language
        
        if (selectedLanguage in sharedLanguages) {
            selectedLanguage = sharedLanguages[selectedLanguage]
        }
    }

    var twoLanguage = {}

    twoLanguage.add = function (moduleId, languages) {
        if (!initialized) {
            twoLanguage.init()
        }

        if (moduleId in moduleLanguages) {
            throw new Error('Language data for ' + moduleId + ' already exists.')
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
        $rootScope.$watch('loc.ale', function () {
            selectLanguage($rootScope.loc.ale)

            var moduleId

            for (moduleId in moduleLanguages) {
                injectLanguage(moduleId)
            }
        })
    }

    return twoLanguage
})
