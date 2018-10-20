define('two/locale', [
    'conf/locale',
    'i18n'
], function (gameLocale, i18n) {
    /**
     * Linguagens geradas para cada modulo
     *
     * @type {Object}
     */
    var langs = {}

    /**
     * Linguagem padrão para cada modulo
     *
     * @type {Object}
     */
    var defaults = {}

    /**
     * Linguagem atualmente selecionada em cada modulo.
     *
     * @type {Object}
     */
    var selecteds = {}

    /**
     * Linguagem atualmente usada pela interface do jogo.
     *
     * @type {String}
     */
    var gameLang = gameLocale.LANGUAGE.split('_')[0]

    /**
     * Função chamada quando a linguagem parão espeficicada e
     * a linguagem nativa do jogo não estão presetes na lista
     * de de locales.
     *
     * @param {Object} langData - Dados com os locales.
     * @return {String} O ID da primeira liguagem que encontrar.
     */
    var getSomeLang = function (langData) {
        for (var langId in langData) {
            return langId
        }
    }

    /**
     * Obtem a tradução de uma linguagem
     *
     * @param {String} moduleId - Identificação do modulo.
     * @param {String} key - Key da tradução.
     * @param {Object} replaces - Valores a serem substituidos na tradução.
     *
     * @return {String} Tradução da key.
     */
    function Locale (moduleId, key, replaces) {
        if (!langs.hasOwnProperty(moduleId)) {
            return console.error('Language for module ' + moduleId + ' not created')
        }

        var args = Array.from(arguments).slice(1)
        var selected = selecteds[moduleId]

        return langs[moduleId][selected].apply(this, args)
    }

    /**
     * Gera linguagens para um modulo.
     *
     * Locale.create("module", {
     *     "en": {
     *         "langName": "English",
     *         "key": "value",
     *         ...
     *     },
     *     "pt": {
     *         "langName": "Português",
     *         "key": "value"
     *     }
     * }, "en")
     *
     * @param  {String} moduleId - Identificação do modulo.
     * @param  {Object} langData - Dados de cada linguagem.
     * @param  {String} defaultLang - Linguagem padrão
     */
    Locale.create = function (moduleId, langData, defaultLang) {
        if (langs.hasOwnProperty(moduleId)) {
            return false
        }

        langs[moduleId] = {}

        var dataHasGameLang = langData.hasOwnProperty(gameLang)
        var dataHasDefaultLang = langData.hasOwnProperty(defaultLang)

        defaults[moduleId] = dataHasDefaultLang ? defaultLang : getSomeLang(langData)
        selecteds[moduleId] = dataHasGameLang ? gameLang : defaults[moduleId]

        for (var langId in langData) {
            langs[moduleId][langId] = i18n.create({
                values: langData[langId]
            })
        }
    }

    /**
     * Altera a linguagem selecionada do modulo.
     *
     * @param  {String} moduleId - Identificação do modulo.
     * @param  {String} langId - Linguagem a ser selecionada.
     */
    Locale.change = function (moduleId, langId) {
        if (langs[moduleId].hasOwnProperty(langId)) {
            selecteds[moduleId] = langId
        } else {
            console.error('Language ' + langId + ' of module ' + moduleId
                + ' not created. Selection default (' + defaults[moduleId] + ')')

            selecteds[moduleId] = defaults[moduleId]
        }
    }

    /**
     * Obtem a linguagem atualmente selecionada do modulo.
     *
     * @param  {String} moduleId - Identificação do modulo.
     */
    Locale.current = function (moduleId) {
        return selecteds[moduleId]
    }

    /**
     * Loop em cada linguagem adicionado ao modulo.
     *
     * @param  {String} moduleId - Identificação do modulo.
     * @param  {Function} callback
     */
    Locale.eachLang = function (moduleId, callback) {
        var moduleLangs = langs[moduleId]

        for (var langId in moduleLangs) {
            callback(langId, moduleLangs[langId]('langName'))
        }
    }

    return Locale
})
