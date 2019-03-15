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
    interfaceOverflow,
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
    var listeners
    var inventory = modelDataService.getInventory()
    var mapSelectedVillage = false

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

    var disabledOption = function () {
        return {
            name: $filter('i18n')('disabled', rootScope.loc.ale, textObjectCommon),
            value: false
        }
    }

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

    var convertListObjects = function (obj, _includeIcon) {
        var list = []
        var item
        var i

        for (i in obj) {
            item = {
                name: obj[i].name,
                value: obj[i].id
            }

            if (_includeIcon) {
                item.leftIcon = obj[i].icon
            }

            list.push(item)
        }

        return list
    }

    var updatePresets = function () {
        var presetList = modelDataService.getPresetList()
        $scope.presets = convertListObjects(presetList.getPresets())
        $scope.presets.unshift(disabledOption())
    }

    var registerEvent = function (id, handler, _root) {
        if (_root) {
            listeners.push($rootScope.$on(id, handler))
        } else {
            eventQueue.register(id, handler)
            
            listeners.push(function () {
                eventQueue.unregister(id, handler)
            })
        }
    }

    var unregisterEvents = function () {
        listeners.forEach(function (unregister) {
            unregister()
        })
    }

    var registerEvents = function () {
        registerEvent(eventTypeProvider.ARMY_PRESET_UPDATE, updatePresets, true)
        registerEvent(eventTypeProvider.ARMY_PRESET_DELETED, updatePresets, true)
        registerEvent(eventTypeProvider.SHOW_CONTEXT_MENU, setMapSelectedVillage, true)
        registerEvent(eventTypeProvider.DESTROY_CONTEXT_MENU, unsetMapSelectedVillage, true)

        var windowListener = $rootScope.$on(eventTypeProvider.WINDOW_CLOSED, function (event, templateName) {
            if (templateName === '!twoverflow_queue_window') {
                unregisterEvents()
                windowListener()
            }
        })
    }

    var addSelected = function () {
        var village = modelDataService.getSelectedVillage().data
        
        $scope.addCommand.origin = {
            id: village.villageId,
            x: village.x,
            y: village.y,
            name: village.name
        }
    }

    var addMapSelected = function () {
        if (!mapSelectedVillage) {
            return utils.emitNotif('error', $filter('i18n')('error_no_map_selected_village', rootScope.loc.ale, textObject))
        }

        commandQueue.getVillageByCoords(mapSelectedVillage.x, mapSelectedVillage.y, function (data) {
            $scope.addCommand.target = {
                id: data.id,
                x: data.x,
                y: data.y,
                name: data.name
            }
        })
    }

    var setMapSelectedVillage = function (event, menu) {
        mapSelectedVillage = menu.data
    }

    var unsetMapSelectedVillage = function () {
        mapSelectedVillage = false
    }

    var addCurrentDate = function () {
        $scope.addCommand.date = formatedDate()
    }

    var incrementDate = function () {
        if (!$scope.addCommand.date) {
            return false
        }

        $scope.addCommand.date = addDateDiff($scope.addCommand.date, 100)
    }

    var reduceDate = function () {
        if (!$scope.addCommand.date) {
            return false
        }

        $scope.addCommand.date = addDateDiff($scope.addCommand.date, -100)
    }

    /**
     * Obtem a data atual do jogo fomatada para hh:mm:ss:SSS dd/MM/yyyy
     *
     * @param {Number=} _ms - Optional time to be formated instead of the game date.
     * @return {String}
     */
    var formatedDate = function (_ms) {
        var date = new Date(_ms || ($timeHelper.gameTime() + utils.getTimeOffset()))

        var rawMS = date.getMilliseconds()
        var ms = $timeHelper.zerofill(rawMS - (rawMS % 100), 3)
        var sec = $timeHelper.zerofill(date.getSeconds(), 2)
        var min = $timeHelper.zerofill(date.getMinutes(), 2)
        var hour = $timeHelper.zerofill(date.getHours(), 2)
        var day = $timeHelper.zerofill(date.getDate(), 2)
        var month = $timeHelper.zerofill(date.getMonth() + 1, 2)
        var year = date.getFullYear()

        return hour + ':' + min + ':' + sec + ':' + ms + ' ' + day + '/' + month + '/' + year
    }

    var addDateDiff = function (date, diff) {
        if (!utils.isValidDateTime(date)) {
            return ''
        }

        date = utils.fixDate(date)
        date = utils.getTimeFromString(date)
        date += diff

        return formatedDate(date)
    }

    var cleanUnitInputs = function () {
        $scope.addCommand.units = angular.copy(unitList)
        $scope.addCommand.officers = angular.copy(officerList)
        $scope.addCommand.catapult_target = DEFAULT_CATAPULT_TARGET
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.showCatapultSelect = false
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

        interfaceOverflow.template('twoverflow_queue_window', `__queue_html_main`)
        interfaceOverflow.css('__queue_css_style')
    }

    var buildWindow = function () {
        listeners = []

        $scope = window.$scope = rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.unitNames = 'unit_names'

        $scope.inventory = inventory

        $scope.DATE_TYPES = util.toActionList(DATE_TYPES, getActionName)
        $scope.selectedDateType = {
            name: $filter('i18n')(DATE_TYPES.out, rootScope.loc.ale, textObject),
            value: DATE_TYPES.out
        }

        $scope.presets = []
        $scope.selectedInsertPreset = {
            name: $filter('i18n')('add_insert_preset', rootScope.loc.ale, textObject),
            value: null
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
            origin: false,
            target: false,
            date: '',
            units: angular.copy(unitList),
            officers: angular.copy(officerList),
            catapult_target: DEFAULT_CATAPULT_TARGET
        }

        // functions
        $scope.onBlur = onBlur
        $scope.onFocus = onFocus
        $scope.selectTab = selectTab
        $scope.keyup = keyup
        $scope.addSelected = addSelected
        $scope.addMapSelected = addMapSelected
        $scope.addCurrentDate = addCurrentDate
        $scope.incrementDate = incrementDate
        $scope.reduceDate = reduceDate
        $scope.cleanUnitInputs = cleanUnitInputs

        registerEvents()
        updatePresets()

        windowManagerService.getScreenWithInjectedScope('!twoverflow_queue_window', $scope)
    }

    init()
})
