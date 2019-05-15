require([
    'two/language',
    'two/ready',
    'two/autoCollector',
    'two/autoCollector/ui',
    'Lockr',
    'queues/EventQueue',
    'two/autoCollector/secondVillage',
    'two/autoCollector/events'
], function (
    twoLanguage,
    ready,
    autoCollector,
    autoCollectorInterface,
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
        autoCollectorInterface()
        
        ready(function () {
            if (Lockr.get('collector-active', false, true)) {
                autoCollector.start()
                autoCollector.secondVillage.start()
            }

            eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STARTED, function () {
                Lockr.set('collector-active', true)
            })

            eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STOPPED, function () {
                Lockr.set('collector-active', false)
            })
        }, ['initial_village'])
    })
})
