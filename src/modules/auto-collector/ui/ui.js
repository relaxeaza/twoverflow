define('two/autoCollector/ui', [
    'two/autoCollector',
    'two/FrontButton',
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
        console.log('$filter("i18n")("description", $rootScope.loc.ale, "collector")', $filter('i18n')('description', $rootScope.loc.ale, 'collector'))
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
            opener.$elem.removeClass('btn-green').addClass('btn-red')
        })

        eventQueue.bind('Collector/stopped', function () {
            opener.$elem.removeClass('btn-red').addClass('btn-green')
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
