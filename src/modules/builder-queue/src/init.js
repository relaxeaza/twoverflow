require([
    'two/ready',
    'two/builder',
    'two/builder/ui',
    'two/builder/events'
], function (
    ready,
    builderQueue
) {
    if (builderQueue.isInitialized()) {
        return false
    }

    var updateModuleLang = function () {
        var langs = __builder_locale
        var current = $rootScope.loc.ale
        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    ready(function () {
        updateModuleLang()
        builderQueue.init()
        builderQueue.interface()
    })
})
