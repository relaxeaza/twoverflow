define('two/queue/ui', [
    'two/queue',
    'two/locale',
    'two/ui2',
    'two/FrontButton',
    'two/utils',
    'queues/EventQueue',
    'helper/time',
    'helper/util'
], function (
    commandQueue,
    Locale,
    ui,
    FrontButton,
    utils,
    eventQueue,
    $timeHelper,
    util
) {
    var textObject = 'queue'
    var textObjectCommon = 'common'
    var $scope
    var $gameData = modelDataService.getGameData()
    var orderedUnitNames = $gameData.getOrderedUnitNames()
    var orderedOfficerNames = $gameData.getOrderedOfficerNames()

    /**
     * @type {Object}
     */
    var EVENT_CODES = {
        NOT_OWN_VILLAGE: 'notOwnVillage',
        NOT_ENOUGH_UNITS: 'notEnoughUnits',
        TIME_LIMIT: 'timeLimit',
        COMMAND_REMOVED: 'commandRemoved',
        COMMAND_SENT: 'commandSent'
    }

    var DATE_TYPES = {
        arrive: 'add_arrive',
        out: 'add_out'
    }

    var DEFAULT_TAB = 'add'
    var DEFAULT_CATAPULT_TARGET = 'wall'
    var attackableBuildingsList = []
    var unitList = {}
    var officerList = {}

    /**
     * Obtem a lista de unidades porém com a catapulta como o último item.
     *
     * @return {Array}
     */
    var unitNamesCatapultLast = function () {
        var units = orderedUnitNames.filter(function (unit) {
            return unit !== 'catapult'
        })

        units.push('catapult')

        return units
    }

    /**
     * Empties out the value of the given unit if it's a 0
     *
     * @param {string} unit the unit name to check the value from
     */
    var onFocus = function onFocus(unit) {
        if ($scope.addCommand.units[unit] === 0) {
            $scope.addCommand.units[unit] = ''
        }
    }

    /**
     * Reverts the value of the unit to 0 if it's an empty character
     *
     * @param {string} unit the unit name to check the value from
     */
    var onBlur = function onBlur(unit) {
        if ($scope.addCommand.units[unit] === '') {
            $scope.addCommand.units[unit] = 0
        }
    }

    var keyup = function keyup() {
        $scope.showCatapultSelect = !!$scope.addCommand.units.catapult
    }

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    /**
     * Returns the translated name of an action.
     * @param {String} actionType The type of an action ($scope.DATE_TYPES)
     * @return {String} The translated name.
     */
    var getActionName = function (actionType) {
        return $filter('i18n')(actionType, rootScope.loc.ale, textObject)
    }

    var init = function () {
        var attackableBuildingsMap = $gameData.getAttackableBuildings()

        for (var i in attackableBuildingsMap) {
            attackableBuildingsList.push({
                name: $filter('i18n')(i, rootScope.loc.ale, 'building_names'),
                value: i
            })
        }

        orderedUnitNames.forEach(function (unit) {
            unitList[unit] = 0
        })

        orderedOfficerNames.forEach(function (unit) {
            officerList[unit] = false
        })

        opener = new FrontButton('Commander', {
            classHover: false,
            classBlur: false,
            onClick: buildWindow
        })

        eventQueue.register(eventTypeProvider.COMMAND_QUEUE_START, function () {
            opener.$elem.removeClass('btn-green').addClass('btn-red')
        })

        eventQueue.register(eventTypeProvider.COMMAND_QUEUE_STOP, function () {
            opener.$elem.removeClass('btn-red').addClass('btn-green')
        })

        ui.template('twoverflow_queue_window', `__queue_html_main`)
        ui.css('__queue_css_style')
    }

    var buildWindow = function () {
        $scope = rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.unitNames = 'unit_names'

        $scope.DATE_TYPES = util.toActionList(DATE_TYPES, getActionName)
        $scope.selectedDateType = {
            name: getActionName(DATE_TYPES.out),
            value: DATE_TYPES.out
        }

        $scope.selectedTab = DEFAULT_TAB
        $scope.unitOrder = orderedUnitNames
        $scope.unitOrder.splice($scope.unitOrder.indexOf('catapult'), 1)
        $scope.officers = $gameData.getOrderedOfficerNames()
        $scope.showCatapultSelect = false
        $scope.attackableBuildings = attackableBuildingsList
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.addCommand = {
            units: angular.copy(unitList),
            officers: officerList,
            catapult_target: DEFAULT_CATAPULT_TARGET
        }

        // functions
        $scope.onBlur = onBlur
        $scope.onFocus = onFocus
        $scope.selectTab = selectTab
        $scope.keyup = keyup

        windowManagerService.getScreenWithInjectedScope('!twoverflow_queue_window', $scope)
    }

    init()
})
