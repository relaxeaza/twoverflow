define('two/autoCollector/ui', [
    'two/autoCollector',
    'two/ui/button',
    'two/utils',
    'two/eventQueue'
], function (
    autoCollector,
    FrontButton,
    utils,
    eventQueue
) {
    var opener

    function CollectorInterface () {
        opener = new FrontButton('Collector', {
            classHover: false,
            classBlur: false,
            tooltip: $filter('i18n')('description', $rootScope.loc.ale, 'collector')
        })

        opener.click(function () {
            if (autoCollector.isRunning()) {
                autoCollector.stop()
                autoCollector.secondVillage.stop()
                utils.emitNotif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'collector'))
            } else {
                autoCollector.start()
                autoCollector.secondVillage.start()
                utils.emitNotif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'collector'))
            }
        })

        eventQueue.bind('Collector/started', function () {
            opener.$elem.classList.remove('btn-green')
            opener.$elem.classList.add('btn-red')
        })

        eventQueue.bind('Collector/stopped', function () {
            opener.$elem.classList.remove('btn-red')
            opener.$elem.classList.add('btn-green')
        })

        if (autoCollector.isRunning()) {
            eventQueue.trigger('Collector/started')
        }

        return opener
    }

    autoCollector.interface = function () {
        autoCollector.interface = CollectorInterface()
    }
})
