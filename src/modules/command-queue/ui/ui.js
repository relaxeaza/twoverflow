define('two/queue/ui', [
    'two/queue',
    'two/locale',
    'two/ui2',
    'two/FrontButton',
    'two/utils',
    'queues/EventQueue',
    'helper/time',
    'helper/util',
    'two/utils',
    'two/EventScope',
    'two/ui/autoComplete',
    'two/queue/dateTypes',
    'two/queue/eventCodes'
], function (
    commandQueue,
    Locale,
    interfaceOverflow,
    FrontButton,
    utils,
    eventQueue,
    $timeHelper,
    util,
    utils,
    EventScope,
    autoComplete,
    DATE_TYPES,
    EVENT_CODES
) {
    var textObject = 'queue'
    var textObjectCommon = 'common'
    var eventScope
    var $scope
    var $gameData = modelDataService.getGameData()
    var orderedUnitNames = $gameData.getOrderedUnitNames()
    var orderedOfficerNames = $gameData.getOrderedOfficerNames()
    var presetList = modelDataService.getPresetList()
    var inventory = modelDataService.getInventory()
    var mapSelectedVillage = false
    var unitOrder
    var commandData
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
        $scope.presets = utils.obj2selectOptions(presetList.getPresets())
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
        $scope.isValidDate = utils.isValidDateTime(commandData.date)

        if (!commandData.origin || !commandData.target) {
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
                    commandData.origin,
                    commandData.target,
                    {[unit]: 1},
                    commandType,
                    commandData.officers
                )

                if ($scope.selectedDateType.value === DATE_TYPES.OUT) {
                    if ($scope.isValidDate) {
                        date = utils.fixDate(commandData.date)
                        outTime = utils.getTimeFromString(date)
                        valueType = isValidSendTime(outTime) ? 'valid' : 'invalid'
                    } else {
                        valueType = 'neutral'
                    }
                } else if ($scope.selectedDateType.value === DATE_TYPES.ARRIVE) {
                    if ($scope.isValidDate) {
                        date = utils.fixDate(commandData.date)
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
        commandData.dateType = $scope.selectedDateType.value
        updateTravelTimes()
    }

    var insertPreset = function () {
        var selectedPreset = $scope.selectedInsertPreset.value

        if (!selectedPreset) {
            return false
        }

        var presets = modelDataService.getPresetList().getPresets()
        var preset = presets[selectedPreset]

        // reset displayed value
        $scope.selectedInsertPreset = {
            name: $filter('i18n')('add_insert_preset', $rootScope.loc.ale, textObject),
            value: null
        }

        commandData.units = angular.copy(preset.units)
        commandData.officers = angular.copy(preset.officers)

        if (preset.catapult_target) {
            commandData.catapultTarget = preset.catapult_target
            $scope.catapultTarget = {
                name: $filter('i18n')(preset.catapult_target, $rootScope.loc.ale, 'building_names'),
                value: preset.catapult_target
            }
            $scope.showCatapultSelect = true

        }
    }

    var onUnitInputFocus = function (unit) {
        if (commandData.units[unit] === 0) {
            commandData.units[unit] = ''
        }
    }

    var onUnitInputBlur = function (unit) {
        if (commandData.units[unit] === '') {
            commandData.units[unit] = 0
        }
    }

    var catapultTargetVisibility = function () {
        $scope.showCatapultSelect = !!commandData.units.catapult
    }

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var addSelected = function () {
        var village = modelDataService.getSelectedVillage().data
        
        commandData.origin = {
            id: village.villageId,
            x: village.x,
            y: village.y,
            name: village.name
        }
    }

    var addMapSelected = function () {
        if (!mapSelectedVillage) {
            return utils.emitNotif('error', $filter('i18n')('error_no_map_selected_village', $rootScope.loc.ale, textObject))
        }

        commandQueue.getVillageByCoords(mapSelectedVillage.x, mapSelectedVillage.y, function (data) {
            commandData.target = {
                id: data.id,
                x: data.x,
                y: data.y,
                name: data.name
            }
        })
    }

    var addCurrentDate = function () {
        commandData.date = formatedDate()
    }

    var incrementDate = function () {
        if (!commandData.date) {
            return false
        }

        commandData.date = addDateDiff(commandData.date, 100)
    }

    var reduceDate = function () {
        if (!commandData.date) {
            return false
        }

        commandData.date = addDateDiff(commandData.date, -100)
    }

    var cleanUnitInputs = function () {
        commandData.units = angular.copy(unitList)
        commandData.officers = angular.copy(officerList)
        commandData.catapultTarget = DEFAULT_CATAPULT_TARGET
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, $rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.showCatapultSelect = false
    }

    var searchVillage = function (type) {
        var $elem
        var model
        var type

        switch (type) {
        case 'origin':
            $elem = document.querySelector('#two-commandqueue .village-origin')
            model = 'originQuery'

            break
        case 'target':
            $elem = document.querySelector('#two-commandqueue .village-target')
            model = 'targetQuery'

            break
        default:
            return false
            break
        }

        if ($scope[model].length < 2) {
            return autoComplete.hide()
        }

        autoComplete.search($scope[model], function (data) {
            if (data.length) {
                autoComplete.show(data, $elem, 'commandqueue_village_search', type)
            }
        }, ['village'])
    }

    var autoCompleteSelected = function (event, id, data, type) {
        if (id !== 'commandqueue_village_search') {
            return false
        }

        commandData[type] = {
            id: data.raw.id,
            x: data.raw.x,
            y: data.raw.y,
            name: data.raw.name
        }

        $scope[type + 'Query'] = ''
    }

    var addCommand = function (type) {
        var copy = angular.copy(commandData)
        copy.type = type

        commandQueue.addCommand(copy)
    }

    var switchCommandQueue = function () {
        if (commandQueue.isRunning()) {
            commandQueue.stop()
        } else {
            commandQueue.start()
        }
    }

    var updateWaitingCommands = function () {
        $scope.waitingCommands = commandQueue.getWaitingCommands()
    }

    var updateSentCommands = function () {
        $scope.sentCommands = commandQueue.getSentCommands()
    }

    var updateExpiredCommands = function () {
        $scope.expiredCommands = commandQueue.getExpiredCommands()
    }

    /**
     * Gera um texto de notificação com as traduções.
     *
     * @param  {String} key
     * @param  {String} key2
     * @param  {String=} prefix
     * @return {String}
     */
    var genNotifText = function (key, key2, prefix) {
        if (prefix) {
            key = prefix + '.' + key
        }

        var a = $filter('i18n')(key, $rootScope.loc.ale, textObject)
        var b = $filter('i18n')(key2, $rootScope.loc.ale, textObject)

        return a + ' ' + b
    }

    var onAddInvalidOrigin = function (event) {
        utils.emitNotif('error', $filter('i18n')('error_origin', $rootScope.loc.ale, textObject))
    }

    var onAddInvalidTarget = function (event) {
        utils.emitNotif('error', $filter('i18n')('error_target', $rootScope.loc.ale, textObject))
    }

    var onAddInvalidDate = function (event) {
        utils.emitNotif('error', $filter('i18n')('error_invalid_date', $rootScope.loc.ale, textObject))
    }

    var onAddNoUnits = function (event) {
        utils.emitNotif('error', $filter('i18n')('error_no_units', $rootScope.loc.ale, textObject))
    }

    var onAddAlreadySent = function (event, command) {
        var commandType = $filter('i18n')(command.type, $rootScope.loc.ale, textObjectCommon)
        var date = utils.formatDate(command.sendTime)

        utils.emitNotif('error', $filter('i18n')('error_already_sent', $rootScope.loc.ale, textObject, commandType, date))
    }

    var onRemoveCommand = function (event, command) {
        updateWaitingCommands()
        $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
        utils.emitNotif('success', genNotifText(command.type, 'removed'))
    }

    var onRemoveError = function (event, command) {
        utils.emitNotif('error', $filter('i18n')('error_remove_error', $rootScope.loc.ale, textObject))
    }

    var onSendTimeLimit = function (event, command) {
        updateSentCommands()
        updateExpiredCommands()
        utils.emitNotif('error', genNotifText(command.type, 'expired'))
    }

    var onSendNotOwnVillage = function (event, command) {
        updateSentCommands()
        updateExpiredCommands()
        utils.emitNotif('error', $filter('i18n')('error_not_own_village', $rootScope.loc.ale, textObject))
    }

    var onSendNoUnitsEnough = function (event, command) {
        updateSentCommands()
        updateExpiredCommands()
        utils.emitNotif('error', $filter('i18n')('error_no_units_enough', $rootScope.loc.ale, textObject))
    }

    var onAddCommand = function (event, command) {
        updateWaitingCommands()

        utils.emitNotif('success', genNotifText(command.type, 'added'))
    }

    var onSendCommand = function (event, command) {
        updateSentCommands()
        utils.emitNotif('success', genNotifText(command.type, 'sent'))
    }

    var onStart = function (event, data) {
        $scope.running = commandQueue.isRunning()

        if (data.disableNotif) {
            return false
        }

        utils.emitNotif('success', genNotifText('title', 'activated'))
    }

    var onStop = function (event) {
        $scope.running = commandQueue.isRunning()
        utils.emitNotif('success', genNotifText('title', 'deactivated'))
    }

    var init = function () {
        var attackableBuildingsMap = $gameData.getAttackableBuildings()
        var building

        for (building in attackableBuildingsMap) {
            attackableBuildingsList.push({
                name: $filter('i18n')(building, $rootScope.loc.ale, 'building_names'),
                value: building
            })
        }

        unitOrder = angular.copy(orderedUnitNames)
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
            catapultTarget: DEFAULT_CATAPULT_TARGET,
            type: null
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
        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.textObjectVillageInfo = 'screen_village_info'
        $scope.textObjectUnitNames = 'unit_names'
        $scope.textObjectMilitaryOperations = 'military_operations'
        $scope.selectedTab = DEFAULT_TAB
        $scope.inventory = inventory
        $scope.presets = utils.obj2selectOptions(presetList.getPresets())
        $scope.travelTimes = {}
        $scope.unitOrder = unitOrder
        $scope.officers = $gameData.getOrderedOfficerNames()
        $scope.originQuery = ''
        $scope.targetQuery = ''
        $scope.isValidDate = false
        $scope.dateTypes = util.toActionList(DATE_TYPES, function (actionType) {
            return $filter('i18n')('add_' + actionType, $rootScope.loc.ale, textObject)
        })
        $scope.selectedDateType = {
            name: $filter('i18n')('add_out', $rootScope.loc.ale, textObject),
            value: DATE_TYPES.OUT
        }
        $scope.selectedInsertPreset = {
            name: $filter('i18n')('add_insert_preset', $rootScope.loc.ale, textObject),
            value: null
        }
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, $rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.showCatapultSelect = !!commandData.units.catapult
        $scope.attackableBuildings = attackableBuildingsList
        $scope.commandData = commandData
        $scope.running = commandQueue.isRunning()
        $scope.waitingCommands = commandQueue.getWaitingCommands()
        $scope.sentCommands = commandQueue.getSentCommands()
        $scope.expiredCommands = commandQueue.getExpiredCommands()
        $scope.EVENT_CODES = EVENT_CODES

        // functions
        $scope.onUnitInputFocus = onUnitInputFocus
        $scope.onUnitInputBlur = onUnitInputBlur
        $scope.catapultTargetVisibility = catapultTargetVisibility
        $scope.selectTab = selectTab
        $scope.addSelected = addSelected
        $scope.addMapSelected = addMapSelected
        $scope.addCurrentDate = addCurrentDate
        $scope.incrementDate = incrementDate
        $scope.reduceDate = reduceDate
        $scope.cleanUnitInputs = cleanUnitInputs
        $scope.searchVillage = searchVillage
        $scope.addCommand = addCommand
        $scope.switchCommandQueue = switchCommandQueue
        $scope.removeCommand = commandQueue.removeCommand
        $scope.openVillageInfo = windowDisplayService.openVillageInfo

        $scope.$watch('commandData.origin', updateTravelTimes)
        $scope.$watch('commandData.target', updateTravelTimes)
        $scope.$watch('commandData.date', updateTravelTimes)
        $scope.$watch('selectedDateType.value', updateDateType)
        $scope.$watch('selectedInsertPreset.value', insertPreset)

        eventScope = new EventScope('twoverflow_queue_window', function onCloseWindow() {
            // keep it here for future reference
        })

        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, updatePresets, true)
        eventScope.register(eventTypeProvider.SELECT_SELECTED, autoCompleteSelected, true)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_ORIGIN, onAddInvalidOrigin)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_TARGET, onAddInvalidTarget)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_DATE, onAddInvalidDate)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD_NO_UNITS, onAddNoUnits)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD_ALREADY_SENT, onAddAlreadySent)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_REMOVE, onRemoveCommand)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_REMOVE_ERROR, onRemoveError)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_TIME_LIMIT, onSendTimeLimit)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE, onSendNotOwnVillage)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH, onSendNoUnitsEnough)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_ADD, onAddCommand)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND, onSendCommand)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_START, onStart)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_STOP, onStop)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_queue_window', $scope)
    }

    return init
})
