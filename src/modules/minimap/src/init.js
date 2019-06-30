require([
    'two/language',
    'two/ready',
    'two/minimap',
    'two/minimap/ui',
    'two/minimap/events',
    'two/minimap/types/actions',
    'two/minimap/settings',
    'two/minimap/settings/updates',
    'two/minimap/settings/map'
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
        twoLanguage.add('__minimap_id', __minimap_lang)
        minimap.init()
        minimapInterface()
        minimap.run()
    })
})
