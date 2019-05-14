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

    var copyTimeModal = function (time) {
        var modalScope = $rootScope.$new()
        modalScope.text = $filter('readableDateFilter')(time * 1000, $rootScope.loc.ale, $rootScope.GAME_TIMEZONE, $rootScope.GAME_TIME_OFFSET, 'H:mm:ss:sss dd/MM/yyyy')
        modalScope.title = $filter('i18n')('copy', $rootScope.loc.ale, textObject)
        windowManagerService.getModal('!twoverflow_attack_view_show_text_modal', modalScope)
    }

    var removeTroops = function (command) {
        var formatedDate = $filter('readableDateFilter')((command.time_completed - 10) * 1000, $rootScope.loc.ale, $rootScope.GAME_TIMEZONE, $rootScope.GAME_TIME_OFFSET, 'H:mm:ss:sss dd/MM/yyyy')
        attackView.setCommander(command, formatedDate)
    }

    var switchWindowSize = function () {
        var $window = $('#two-attack-view').parent()
        var $wrapper = $('#wrapper')

        $window.toggleClass('fullsize')
        $wrapper.toggleClass('window-fullsize')
    }

    var updateVisibileCommands = function () {
        var offset = $scope.pagination.offset
        var limit = $scope.pagination.limit

        $scope.visibleCommands = $scope.commands.slice(offset, offset + limit)
        $scope.pagination.count = $scope.commands.length
    }

    var checkCommands = function () {
        var now = Date.now()
        var i
        
        for (i = 0; i < $scope.commands.length; i++) {
            if ($scope.commands[i].model.percent(now) === 100) {
                $scope.commands.splice(i, 1)
            }
        }

        updateVisibileCommands()
    }

    // scope functions

    var toggleFilter = function (type, _filter) {
        attackView.toggleFilter(type, _filter)
        $scope.filters = attackView.getFilters()
    }

    var toggleSorting = function (column) {
        attackView.toggleSorting(column)
        $scope.sorting = attackView.getSortings()
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

        interfaceOverflow.addTemplate('twoverflow_attack_view_main', `__attack_view_html_main`)
        interfaceOverflow.addTemplate('twoverflow_attack_view_show_text_modal', `__attack_view_html_modal-show-text`)
        interfaceOverflow.addStyle('__attack_view_css_style')
    }

    var buildWindow = function () {
        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.commandQueueEnabled = attackView.commandQueueEnabled()
        $scope.commands = attackView.getCommands()
        $scope.selectedVillageId = modelDataService.getSelectedVillage().getId()
        $scope.filters = attackView.getFilters()
        $scope.sorting = attackView.getSortings()
        $scope.UNIT_TYPES = UNIT_TYPES
        $scope.FILTER_TYPES = FILTER_TYPES
        $scope.COMMAND_TYPES = COMMAND_TYPES
        $scope.UNIT_SPEED_ORDER = UNIT_SPEED_ORDER
        $scope.COLUMN_TYPES = COLUMN_TYPES
        $scope.pagination = {
            count: $scope.commands.length,
            offset: 0,
            loader: updateVisibileCommands,
            limit: storageService.getPaginationLimit()
        }

        // functions
        $scope.openCharacterProfile = windowDisplayService.openCharacterProfile
        $scope.openVillageInfo = windowDisplayService.openVillageInfo
        $scope.jumpToVillage = mapService.jumpToVillage
        $scope.now = nowSeconds
        $scope.copyTimeModal = copyTimeModal
        $scope.removeTroops = removeTroops
        $scope.switchWindowSize = switchWindowSize
        $scope.toggleFilter = toggleFilter
        $scope.toggleSorting = toggleSorting

        updateVisibileCommands()

        eventScope = new EventScope('twoverflow_queue_window', function onWindowClose() {
            timeHelper.timer.remove(checkCommands)
        })
        eventScope.register(eventTypeProvider.MAP_SELECTED_VILLAGE, eventHandlers.onVillageSwitched, true)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMANDS_LOADED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMAND_CANCELLED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMAND_IGNORED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_VILLAGE_RENAMED, eventHandlers.updateCommands)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_attack_view_main', $scope)

        timeHelper.timer.add(checkCommands)
    }

    return init
})
