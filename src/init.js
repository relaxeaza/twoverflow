require([
    'two/locale',
    'helper/i18n'
], function (
    Locale,
    i18n
) {
    var updateModuleLang = function () {
        var langs = __overflow_locales
        var current = rootScope.loc.ale
        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    updateModuleLang()
})
