require([
    'two/ready',
    'two/autoCollector',
    'Lockr',
    'two/eventQueue',
    'two/autoCollector/secondVillage',
    'two/autoCollector/ui',
], function (
    ready,
    autoCollector,
    Lockr,
    eventQueue
) {
    if (autoCollector.isInitialized()) {
        return false
    }

    ready(function () {
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