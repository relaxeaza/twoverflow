define('two/queue/ui', [
    'two/queue',
    'two/locale',
    'two/ui2',
    'two/FrontButton',
    'two/utils',
    'queues/EventQueue',
    'helper/time',
    'helper/util',
    'two/utils'
], function (
    commandQueue,
    Locale,
    interfaceOverflow,
    FrontButton,
    utils,
    eventQueue,
    $timeHelper,
    util,
    utils
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
    var travelTimesId
    var unitOrder
    var commandData

    /**
     * @type {Object}
     */
    var EVENT_CODES = {
        NOT_OWN_VILLAGE: 'not_own_village',
        NOT_ENOUGH_UNITS: 'not_enough_units',
        TIME_LIMIT: 'time_limit',
        COMMAND_REMOVED: 'command_removed',
        COMMAND_SENT: 'command_ent'
    }
    var DATE_TYPES = {
        ARRIVE: 'add_arrive',
        OUT: 'add_out'
    }
    var COMMAND_TYPES = ['attack', 'support', 'relocate']
    var DEFAULT_TAB = 'add'
    var DEFAULT_CATAPULT_TARGET = 'wall'
    var attackableBuildingsList = []
    var unitList = {}
    var officerList = {}
    var timeOffset = utils.getTimeOffset()
    /**
     * Name of one unity for each speed category.
     * Used to generate travel times.
     */
    var UNITS_BY_SPEED = [
        'light_cavalry',
        'heavy_cavalry',
        'archer',
        'sword',
        'ram',
        'snob',
        'trebuchet'
    ]

    var updatePresets = function () {
        var presetList = modelDataService.getPresetList()
        $scope.presets = utils.obj2selectOptions(presetList.getPresets())
        $scope.presets.unshift({
            name: $filter('i18n')('disabled', rootScope.loc.ale, textObjectCommon),
            value: false
        })
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

        stopTravelTimesWatcher()
    }

    var registerEvents = function () {
        registerEvent(eventTypeProvider.ARMY_PRESET_UPDATE, updatePresets, true)
        registerEvent(eventTypeProvider.ARMY_PRESET_DELETED, updatePresets, true)

        var windowListener = $rootScope.$on(eventTypeProvider.WINDOW_CLOSED, function (event, templateName) {
            if (templateName === '!twoverflow_queue_window') {
                unregisterEvents()
                windowListener()
            }
        })
    }

    var setMapSelectedVillage = function (event, menu) {
        mapSelectedVillage = menu.data
    }

    var unsetMapSelectedVillage = function () {
        mapSelectedVillage = false
    }

    /**
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

    var updateTravelTimes = function () {
        validDate()
        calcTravelTimes()
    }

    var calcTravelTimes = function () {
        if (!$scope.commandData.origin || !$scope.commandData.target) {
            return false
        }

        var date
        var arriveTime
        var travelTime
        var sendTime
        var valueType

        COMMAND_TYPES.forEach(function (commandType) {
            $scope.travelTimes[commandType] = {}

            UNITS_BY_SPEED.forEach(function (unit) {
                travelTime = commandQueue.getTravelTime(
                    $scope.commandData.origin,
                    $scope.commandData.target,
                    {[unit]: 1},
                    commandType,
                    $scope.commandData.officers
                )

                if ($scope.selectedDateType.value === DATE_TYPES.OUT) {
                    if ($scope.isValidDate) {
                        date = utils.fixDate($scope.commandData.date)
                        outTime = utils.getTimeFromString(date)
                        valueType = isValidSendTime(outTime) ? 'valid' : 'invalid'
                    } else {
                        valueType = 'neutral'
                    }
                } else if ($scope.selectedDateType.value === DATE_TYPES.ARRIVE) {
                    if ($scope.isValidDate) {
                        date = utils.fixDate($scope.commandData.date)
                        arriveTime = utils.getTimeFromString(date)
                        sendTime = arriveTime - travelTime
                        valueType = isValidSendTime(sendTime) ? 'valid' : 'invalid'
                    } else {
                        valueType = 'invalid'
                    }
                }

                $scope.travelTimes[commandType][unit] = {
                    value: $filter('readableMillisecondsFilter')(travelTime),
                    valueType: valueType
                }
            })
        })
    }

    var validDate = function () {
        $scope.isValidDate = utils.isValidDateTime($scope.commandData.date)
    }

    /**
     * @param  {Number}  time - Command date input in milliseconds.
     * @return {Boolean}
     */
    var isValidSendTime = function (time) {
        if (!$scope.isValidDate) {
            return false
        }

        return ($timeHelper.gameTime() + timeOffset) < time
    }

    var updateDateType = function () {
        $scope.commandData.dateType = $scope.selectedDateType.value
        updateTravelTimes()
    }

    var travelTimesWatcher = function () {
        travelTimesId = setInterval(function () {
            if ($scope.selectedTab === 'add' && $scope.commandData.origin && $scope.commandData.target) {
                calcTravelTimes()
            }
        }, 2000)
    }

    var stopTravelTimesWatcher = function () {
        clearInterval(travelTimesId)
    }

    var onBlur = function (unit) {
        if ($scope.commandData.units[unit] === '') {
            $scope.commandData.units[unit] = 0
        }
    }

    var onFocus = function (unit) {
        if ($scope.commandData.units[unit] === 0) {
            $scope.commandData.units[unit] = ''
        }
    }

    var onKeyup = function onKeyup() {
        $scope.showCatapultSelect = !!$scope.commandData.units.catapult
    }

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var addSelected = function () {
        var village = modelDataService.getSelectedVillage().data
        
        $scope.commandData.origin = {
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
            $scope.commandData.target = {
                id: data.id,
                x: data.x,
                y: data.y,
                name: data.name
            }
        })
    }

    var addCurrentDate = function () {
        $scope.commandData.date = formatedDate()
    }

    var incrementDate = function () {
        if (!$scope.commandData.date) {
            return false
        }

        $scope.commandData.date = addDateDiff($scope.commandData.date, 100)
    }

    var reduceDate = function () {
        if (!$scope.commandData.date) {
            return false
        }

        $scope.commandData.date = addDateDiff($scope.commandData.date, -100)
    }

    var cleanUnitInputs = function () {
        $scope.commandData.units = angular.copy(unitList)
        $scope.commandData.officers = angular.copy(officerList)
        $scope.commandData.catapultTarget = DEFAULT_CATAPULT_TARGET
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.showCatapultSelect = false
    }

    var init = function () {
        var attackableBuildingsMap = $gameData.getAttackableBuildings()
        var building

        for (building in attackableBuildingsMap) {
            attackableBuildingsList.push({
                name: $filter('i18n')(building, rootScope.loc.ale, 'building_names'),
                value: building
            })
        }

        unitOrder = orderedUnitNames
        unitOrder.splice(unitOrder.indexOf('catapult'), 1)

        orderedUnitNames.forEach(function (unit) {
            unitList[unit] = 0
        })

        orderedOfficerNames.forEach(function (unit) {
            officerList[unit] = false
        })

        commandData = {
            origin: false,
            target: false,
            date: '',
            dateType: DATE_TYPES.OUT,
            units: angular.copy(unitList),
            officers: angular.copy(officerList),
            catapultTarget: DEFAULT_CATAPULT_TARGET
        }

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

        $rootScope.$on(eventTypeProvider.SHOW_CONTEXT_MENU, setMapSelectedVillage)
        $rootScope.$on(eventTypeProvider.DESTROY_CONTEXT_MENU, unsetMapSelectedVillage)

        interfaceOverflow.template('twoverflow_queue_window', `__queue_html_main`)
        interfaceOverflow.css('__queue_css_style')
    }

    var buildWindow = function () {
        listeners = []
        $scope = window.$scope = rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.textObjectVillageInfo = 'screen_village_info'
        $scope.textObjectUnitNames = 'unit_names'
        $scope.textObjectMilitaryOperations = 'military_operations'
        $scope.selectedTab = DEFAULT_TAB
        $scope.inventory = inventory
        $scope.presets = []
        $scope.travelTimes = {}
        $scope.unitOrder = unitOrder
        $scope.officers = $gameData.getOrderedOfficerNames()
        $scope.isValidDate = false
        $scope.dateTypes = util.toActionList(DATE_TYPES, function (actionType) {
            return $filter('i18n')(actionType, rootScope.loc.ale, textObject)
        })
        $scope.selectedDateType = {
            name: $filter('i18n')(DATE_TYPES.OUT, rootScope.loc.ale, textObject),
            value: DATE_TYPES.OUT
        }
        $scope.selectedInsertPreset = {
            name: $filter('i18n')('add_insert_preset', rootScope.loc.ale, textObject),
            value: null
        }
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.showCatapultSelect = false
        $scope.attackableBuildings = attackableBuildingsList
        $scope.commandData = commandData

        // functions
        $scope.onBlur = onBlur
        $scope.onFocus = onFocus
        $scope.onKeyup = onKeyup
        $scope.selectTab = selectTab
        $scope.addSelected = addSelected
        $scope.addMapSelected = addMapSelected
        $scope.addCurrentDate = addCurrentDate
        $scope.incrementDate = incrementDate
        $scope.reduceDate = reduceDate
        $scope.cleanUnitInputs = cleanUnitInputs

        $scope.$watch('commandData.origin', updateTravelTimes)
        $scope.$watch('commandData.target', updateTravelTimes)
        $scope.$watch('commandData.date', updateTravelTimes)
        $scope.$watch('selectedDateType.value', updateDateType)

        registerEvents()
        updatePresets()
        travelTimesWatcher()

        windowManagerService.getScreenWithInjectedScope('!twoverflow_queue_window', $scope)
    }

    init()
})
