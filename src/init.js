require([
    'helper/i18n',
    'two/ready'
], function (
    i18n,
    ready
) {
    var updateModuleLang = function () {
        var langs = __overflow_locales
        var current = $rootScope.loc.ale

        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    ready(function () {
        updateModuleLang()
    })
})
