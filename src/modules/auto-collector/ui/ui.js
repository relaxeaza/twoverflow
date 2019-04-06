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
        Locale.create('collector', __collector_locale, 'en')
        
        opener = new FrontButton('Collector', {
            classHover: false,
            classBlur: false,
            tooltip: Locale('collector', 'description')
        })

        opener.click(function () {
            if (autoCollector.isRunning()) {
                autoCollector.stop()
                autoCollector.secondVillage.stop()
                utils.emitNotif('success', Locale('collector', 'deactivated'))
            } else {
                autoCollector.start()
                autoCollector.secondVillage.start()
                utils.emitNotif('success', Locale('collector', 'activated'))
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
