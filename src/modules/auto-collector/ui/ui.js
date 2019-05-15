define('two/autoCollector/ui', [
    'two/autoCollector',
    'two/ui/button',
    'two/utils',
    'queues/EventQueue'
], function (
    autoCollector,
    FrontButton,
    utils,
    eventQueue
) {
    var opener
    var textObject = 'collector'

    var init = function () {
        opener = new FrontButton('Collector', {
            classHover: false,
            classBlur: false,
            tooltip: $filter('i18n')('description', $rootScope.loc.ale, textObject)
        })

        opener.click(function () {
            if (autoCollector.isRunning()) {
                autoCollector.stop()
                autoCollector.secondVillage.stop()
                utils.emitNotif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, textObject))
            } else {
                autoCollector.start()
                autoCollector.secondVillage.start()
                utils.emitNotif('success', $filter('i18n')('activated', $rootScope.loc.ale, textObject))
            }
        })

        eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STARTED, function () {
            opener.$elem.classList.remove('btn-green')
            opener.$elem.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STOPPED, function () {
            opener.$elem.classList.remove('btn-red')
            opener.$elem.classList.add('btn-green')
        })

        if (autoCollector.isRunning()) {
            eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_STARTED)
        }

        return opener
    }

    return init
})
