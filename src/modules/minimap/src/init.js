require([
    'two/language',
    'two/ready',
    'two/minimap',
    'two/minimap/ui',
    'two/minimap/events',
    'two/minimap/actionTypes',
    'two/minimap/settings',
    'two/minimap/settingsMap',
], function (
    twoLanguage,
    ready,
    minimap,
    minimapInterface
) {
    if (minimap.initialized) {
        return false
    }

    ready(function () {
        twoLanguage.add('__minimap_id', __minimap_locale)
        minimap.init()
        minimapInterface()
        minimap.run()
    })
})
