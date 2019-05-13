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
    var textObject = 'attack_view'
    var textObjectCommon = 'common'
    var eventScope

    var nowSeconds = function () {
        return Date.now() / 1000
    }

    var showText = function (text) {
        var modalScope = $rootScope.$new()
        modalScope.text = text
        windowManagerService.getModal('!twoverflow_attack_view_show_text_modal', modalScope)
    }

    var removeTroops = function (command) {
        var outDate = utils.formatDate((command.time_completed - 10) * 1000, 'HH:mm:ss:sss dd/MM/yyyy')
        attackView.setQueueCommand(command, outDate)
    }

    var switchWindowSize = function () {
        var $window = $('#two-attack-view').parent()
        $window.toggleClass('fullsize')
    }

    var eventHandlers = {
        updateCommands: function () {
            $scope.commands = attackView.getCommands()
        },
        onVillageSwitched: function () {
            $scope.selectedVillageId = modelDataService.getSelectedVillage().getId()
        }
    }

    var init = function () {
        var opener = new FrontButton('AttackView', {
            classHover: false,
            classBlur: false,
            onClick: buildWindow
        })

        interfaceOverflow.addTemplate('twoverflow_attack_view_main', `__attackView_html_main`)
        interfaceOverflow.addTemplate('twoverflow_attack_view_show_text_modal', `__builder_html_modal-show-text`)
        interfaceOverflow.addStyle('__attackView_css_style')
    }

    var buildWindow = function () {
        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon

        $scope.commands = attackView.getCommands()
        $scope.selectedVillageId = modelDataService.getSelectedVillage().getId()
        $scope.UNIT_TYPES = UNIT_TYPES

        // functions
        $scope.openCharacterProfile = windowDisplayService.openCharacterProfile
        $scope.openVillageInfo = windowDisplayService.openVillageInfo
        $scope.jumpToVillage = mapService.jumpToVillage
        $scope.now = nowSeconds
        $scope.showText = showText
        $scope.removeTroops = removeTroops
        $scope.switchWindowSize = switchWindowSize

        eventScope = new EventScope('twoverflow_queue_window')
        eventScope.register(eventTypeProvider.MAP_SELECTED_VILLAGE, eventHandlers.onVillageSwitched, true)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMANDS_LOADED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMAND_CANCELLED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMAND_IGNORED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_VILLAGE_RENAMED, eventHandlers.updateCommands)
        // eventScope.register(eventTypeProvider.ATTACK_VIEW_FILTERS_CHANGED, updateFilterElements)
        // eventScope.register(eventTypeProvider.ATTACK_VIEW_SORTING_CHANGED, updateSortingElements)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_attack_view_main', $scope)
    }

    return init
})
