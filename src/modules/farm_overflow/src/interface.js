define('two/farmOverflow/ui', [
    'two/ui',
    'two/ui/button',
    'two/farmOverflow',
    'two/farmOverflow/errorTypes',
    'two/farmOverflow/logTypes',
    'two/farmOverflow/eventStates',
    'two/farmOverflow/settings',
    'two/Settings',
    'two/utils',
    'two/EventScope',
    'queues/EventQueue',
    'struct/MapData',
    'helper/time',
], function (
    interfaceOverflow,
    FrontButton,
    farmOverflow,
    ERROR_TYPES,
    LOG_TYPES,
    EVENT_STATES,
    SETTINGS,
    Settings,
    utils,
    EventScope,
    eventQueue,
    mapData,
    timeHelper
) {
    var textObject = 'farm_overflow'

    var init = function () {
        eventQueue.bind(eventTypeProvider.FARM_OVERFLOW_STOP, function (reason) {
            switch (reason) {
            case EVENT_STATES.STOP_NO_PRESETS:
                $rootScope.$broadcast(eventTypeProvider.MESSAGE_ERROR, {
                    message: $filter('i18n')('stop_no_presets', $rootScope.loc.ale, textObject)
                })

                break
            }
        })
    }

    return init
})
