require([
    'two/language',
    'two/ready',
    'two/autoCollector',
    'Lockr',
    'queues/EventQueue',
    'two/autoCollector/secondVillage',
    'two/autoCollector/ui'
], function (
    twoLanguage,
    ready,
    autoCollector,
    Lockr,
    eventQueue
) {
    if (autoCollector.isInitialized()) {
        return false
    }

    ready(function () {
        twoLanguage.add('__auto_collector_id', __auto_collector_locale)
        autoCollector.init()
        autoCollector.secondVillage.init()
        autoCollector.interface()
        
        ready(function () {
            if (Lockr.get('collector-active', false, true)) {
                autoCollector.start()
                autoCollector.secondVillage.start()
            }

            eventQueue.register('Collector/started', function () {
                Lockr.set('collector-active', true)
            })

            eventQueue.register('Collector/stopped', function () {
                Lockr.set('collector-active', false)
            })
        }, ['initial_village'])
    })
})
