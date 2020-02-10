define('two/autoCollector/ui', [
    'two/ui',
    'two/autoCollector',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    autoCollector,
    utils,
    eventQueue
) {
    var $opener

    var init = function () {
        $opener = interfaceOverflow.addMenuButton('Collector', 50, $filter('i18n')('description', $rootScope.loc.ale, 'auto_collector'))
        
        $opener.addEventListener('click', function () {
            if (autoCollector.isRunning()) {
                autoCollector.stop()
                autoCollector.secondVillage.stop()
                utils.emitNotif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'auto_collector'))
            } else {
                autoCollector.start()
                autoCollector.secondVillage.start()
                utils.emitNotif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'auto_collector'))
            }
        })

        eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STARTED, function () {
            $opener.classList.remove('btn-green')
            $opener.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STOPPED, function () {
            $opener.classList.remove('btn-red')
            $opener.classList.add('btn-green')
        })

        if (autoCollector.isRunning()) {
            eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_STARTED)
        }

        return opener
    }

    return init
})
