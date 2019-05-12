define('two/attackView/ui', [
    'two/attackView',
    'two/ui2',
    'two/FrontButton',
    'two/utils',
    'queues/EventQueue',
    'helper/time',
    'conf/unitTypes',
    'two/attackView/columnTypes',
    'two/attackView/commandTypes',
    'two/attackView/filterTypes',
    'two/attackView/unitSpeedOrder',
    'two/EventScope'
], function (
    attackView,
    interfaceOverflow,
    FrontButton,
    utils,
    eventQueue,
    timeHelper,
    UNIT_TYPES,
    COLUMN_TYPES,
    COMMAND_TYPES,
    FILTER_TYPES,
    UNIT_SPEED_ORDER,
    EventScope
) {
    var $scope
    var textObject
    var textObjectCommon
    var eventScope

    var init = function () {
        var opener = new FrontButton('AttackView', {
            classHover: false,
            classBlur: false,
            onClick: buildWindow
        })

        interfaceOverflow.addTemplate('twoverflow_attack_view_main', `__attackView_html_main`)
        interfaceOverflow.addStyle('__attackView_css_style')
    }

    var buildWindow = function () {
        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon

        eventScope = new EventScope('twoverflow_queue_window')
        // eventScope.register(eventTypeProvider.MAP_SELECTED_VILLAGE, onVillageSwitched, true)
        // eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMANDS_LOADED, populateCommandsView)
        // eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMAND_CANCELLED, onCommandCancelled)
        // eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMAND_IGNORED, onCommandIgnored)
        // eventScope.register(eventTypeProvider.ATTACK_VIEW_VILLAGE_RENAMED, onVillageRenamed)
        // eventScope.register(eventTypeProvider.ATTACK_VIEW_FILTERS_CHANGED, updateFilterElements)
        // eventScope.register(eventTypeProvider.ATTACK_VIEW_SORTING_CHANGED, updateSortingElements)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_attack_view_main', $scope)
    }

    return init
})
