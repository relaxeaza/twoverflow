require([
    'two/ready',
    'two/autoCollector',
    'Lockr',
    'helper/i18n',
    'two/eventQueue',
    'two/autoCollector/secondVillage',
    'two/autoCollector/ui'
], function (
    ready,
    autoCollector,
    Lockr,
    i18n,
    eventQueue
) {
    if (autoCollector.isInitialized()) {
        return false
    }

    var updateModuleLang = function () {
        var langs = __collector_locale
        var current = $rootScope.loc.ale
        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    ready(function () {
        updateModuleLang()
        autoCollector.init()
        autoCollector.secondVillage.init()
        autoCollector.interface()
        
        ready(function () {
            if (Lockr.get('collector-active', false, true)) {
                autoCollector.start()
                autoCollector.secondVillage.start()
            }

            eventQueue.bind('Collector/started', function () {
                Lockr.set('collector-active', true)
            })

            eventQueue.bind('Collector/stopped', function () {
                Lockr.set('collector-active', false)
            })
        }, ['initial_village'])
    })
})
