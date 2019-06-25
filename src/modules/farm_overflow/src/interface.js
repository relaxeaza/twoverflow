define('two/farmOverflow/ui', [
    'two/ui',
    'two/ui/button',
    'two/farmOverflow',
    'two/farmOverflow/errorTypes',
    'two/farmOverflow/logTypes',
    'two/farmOverflow/settings',
    'two/Settings',
    'two/utils',
    'queues/EventQueue',
    'struct/MapData',
    'helper/time',
], function (
    interfaceOverflow,
    FrontButton,
    farmOverflow,
    ERROR_TYPES,
    LOG_TYPES,
    SETTINGS,
    Settings,
    utils,
    eventQueue,
    mapData,
    timeHelper
) {
    var textObject = 'farm_overflow'
    var textObjectCommon = 'common'

    var init = function () {
        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_START, function (data) {
            $rootScope.$broadcast(eventTypeProvider.MESSAGE_SUCCESS, {
                message: $filter('i18n')('farm_started', $rootScope.loc.ale, textObject)
            })
        })

        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_STOP, function (data) {
            switch (data.reason) {
            case ERROR_TYPES.NO_PRESETS:
                $rootScope.$broadcast(eventTypeProvider.MESSAGE_ERROR, {
                    message: $filter('i18n')('stop_no_presets', $rootScope.loc.ale, textObject)
                })

                break
            }
        })
    }

    return init
})
