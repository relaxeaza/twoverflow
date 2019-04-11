require([
    'helper/i18n',
    'two/ready',
    'two/minimap',
    'two/minimap/ui',
    'two/minimap/data',
    'two/minimap/Events',
    'two/minimap/actionTypes',
    'two/minimap/settings',
    'two/minimap/settingsMap',
], function (
    i18n,
    ready,
    minimap,
    minimapInterface
) {
    if (minimap.initialized) {
        return false
    }

    var updateModuleLang = function () {
        var langs = __minimap_locale
        var current = $rootScope.loc.ale
        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    ready(function () {
        updateModuleLang()
        minimap.init()
        minimapInterface()
        minimap.run()
    })
})
