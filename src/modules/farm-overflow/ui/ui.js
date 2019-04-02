define('two/farm/ui', [
    'two/farm',
    'two/ui2',
    'two/FrontButton',
    'queues/EventQueue',
    'struct/MapData',
    'helper/time',
    'two/farm/Events',
    'two/utils',
    'two/EventScope'
], function (
    farmOverflow,
    ui,
    FrontButton,
    eventQueue,
    mapData,
    timeHelper,
    farmEventTypes,
    utils,
    EventScope
) {
    var eventScope
    var $scope
    var textObject = 'farm'
    var textObjectCommon = 'common'
    var SELECT_SETTINGS = ['presets', 'groupIgnore', 'groupInclude' ,'groupOnly']
    var ERROR_TYPES = farmOverflow.ERROR_TYPES

    var buildWindow = function () {
        var disabledSelects = function (settings) {
            SELECT_SETTINGS.forEach(function (item) {
                if (angular.isArray(settings[item])) {
                    if (!settings[item].length) {
                        settings[item] = [disabledOption()]
                    }
                } else if (!settings[item]) {
                    settings[item] = disabledOption()
                }
            })
        }

        var selectTab = function (tabType) {
            $scope.selectedTab = tabType
        }

        var updatePresets = function () {
            var presetList = modelDataService.getPresetList()
            $scope.presets = utils.obj2selectOptions(presetList.getPresets())
        }

        var updateGroups = function () {
            var groupList = modelDataService.getGroupList()
            $scope.groups = utils.obj2selectOptions(groupList.getGroups(), true)
            $scope.groupsWithDisabled = angular.copy($scope.groups)
            $scope.groupsWithDisabled.unshift(disabledOption())
        }

        var clearLogs = function () {
            $scope.logs = []
            $scope.visibleLogs = []
            farmOverflow.clearLogs()
        }

        /**
         * Convert the interface friendly settings data to the internal format
         * and update the farmOverflow settings property.
         */
        var saveSettings = function () {
            var settings = angular.copy($scope.settings)
            
            SELECT_SETTINGS.forEach(function (id) {
                if (angular.isArray(settings[id])) {
                    // check if the selected value is not the "disabled" option
                    if (settings[id].length && settings[id][0].value) {
                        settings[id] = settings[id].map(function (item) {
                            return item.value
                        })
                    } else {
                        settings[id] = []
                    }
                } else {
                    settings[id] = settings[id].value ? settings[id].value : false
                }
            })

            farmOverflow.updateSettings(settings)
        }

        /**
         * Parse the raw settings to be readable by the interface.
         */
        var parseSettings = function (rawSettings) {
            var settings = angular.copy(rawSettings)
            var groupsObject = {}
            var presetsObject = {}
            var groupId
            var value

            $scope.groups.forEach(function (group) {
                groupsObject[group.value] = {
                    name: group.name,
                    leftIcon: group.leftIcon
                }
            })

            $scope.presets.forEach(function (preset) {
                presetsObject[preset.value] = preset.name
            })

            SELECT_SETTINGS.forEach(function (item) {
                value = settings[item]

                if (item === 'presets') {
                    settings[item] = value.map(function (presetId) {
                        return {
                            name: presetsObject[presetId],
                            value: presetId
                        }
                    })
                } else {
                    if (angular.isArray(value)) {
                        settings[item] = value.map(function (groupId) {
                            return {
                                name: groupsObject[groupId].name,
                                value: groupId,
                                leftIcon: groupsObject[groupId].leftIcon
                            }
                        })
                    } else if (value) {
                        groupId = settings[item]
                        settings[item] = {
                            name: groupsObject[groupId].name,
                            value: groupId,
                            leftIcon: groupsObject[groupId].leftIcon
                        }
                    }
                }
            })

            disabledSelects(settings)

            return settings
        }

        /**
         * Used to set the "disabled" option for the select fields.
         * Without these initial values, when all options are uncheck
         * the default value of the select will fallback to the first
         * option of the set.
         *
         * The interface is compiled and only after that,
         * the $scope.settings is populated with the actual values.
         */
        var genInitialSelectValues = function () {
            var obj = {}

            SELECT_SETTINGS.forEach(function (item) {
                obj[item] = item === 'groupIgnore'
                    ? disabledOption()
                    : [disabledOption()]
            })

            return obj
        }

        var disabledOption = function () {
            return {
                name: $filter('i18n')('disabled', $rootScope.loc.ale, textObjectCommon),
                value: false
            }
        }

        var switchFarm = function () {
            farmOverflow.switch(true)
        }

        var startHandler = function (event, _manual) {
            $scope.running = true

            if (_manual) {
                utils.emitNotif('success', $filter('i18n')('farm_started', $rootScope.loc.ale, textObject))
            }
        }

        var pauseHandler = function (event, _manual) {
            $scope.running = false

            if (_manual) {
                utils.emitNotif('success', $filter('i18n')('farm_paused', $rootScope.loc.ale, textObject))
            }
        }

        var stepCycleEndHandler = function () {
            var settings = farmOverflow.getSettings()
            
            if (settings.stepCycleNotifs) {
                utils.emitNotif('error', $filter('i18n')('step_cycle_end', $rootScope.loc.ale, textObject))
            }
        }

        var stepCycleEndNoVillagesHandler = function () {
            utils.emitNotif('error', $filter('i18n')('step_cycle_end_no_villages', $rootScope.loc.ale, textObject))
        }

        var stepCycleNextHandler = function () {
            var settings = farmOverflow.getSettings()

            if (settings.stepCycleNotifs) {
                var next = timeHelper.gameTime() + (settings.stepCycleInterval * 60)

                utils.emitNotif('success', $filter('i18n')('step_cycle_next', $rootScope.loc.ale, textObject, utils.formatDate(next)))
            }
        }

        var errorHandler = function (event, args) {
            var error = args[0]
            var manual = args[1]

            if (!manual) {
                return false
            }

            switch (error) {
            case ERROR_TYPES.PRESET_FIRST:
                utils.emitNotif('error', $filter('i18n')('preset_first', $rootScope.loc.ale, textObject))
                break
            case ERROR_TYPES.NO_SELECTED_VILLAGE:
                utils.emitNotif('error',$filter('i18n')('no_selected_village', $rootScope.loc.ale, textObject))
                break
            }
        }

        var resetLogsHandler = function () {
            utils.emitNotif('success',$filter('i18n')('reseted_logs', $rootScope.loc.ale, textObject))
        }

        var saveSettingsHandler = function () {
            utils.emitNotif('success',$filter('i18n')('settings_saved', $rootScope.loc.ale, textObject))
        }

        var updateSelectedVillage = function () {
            $scope.selectedVillage = farmOverflow.getSelectedVillage()
        }

        var updateLastAttack = function () {
            $scope.lastAttack = farmOverflow.getLastAttack()
        }

        var updateCurrentStatus = function (event, status) {
            $scope.currentStatus = status
        }

        var loadVillagesLabel = function () {
            var load = function (data) {
                if ($scope.villagesLabel[data.coords]) {
                    return false
                }

                var coords = data.coords.split('|')
                var x = parseInt(coords[0], 10)
                var y = parseInt(coords[1], 10)
                
                mapData.getTownAtAsync(x, y, function (village) {
                    $scope.villagesLabel[data.coords] = `${village.name} (${data.coords})`
                })
            }

            $scope.logs.forEach(function (log) {
                if (log.origin) {
                    load(log.origin)
                }

                if (log.target) {
                    load(log.target)
                }

                if (log.village) {
                    load(log.village)
                }
            })
        }

        var updateLogs = function () {
            $scope.logs = angular.copy(farmOverflow.getLogs())

            loadVillagesLabel()
            updateVisibleLogs()
        }

        var updateVisibleLogs = function () {
            var offset = $scope.pagination.offset
            var limit = $scope.pagination.limit

            $scope.visibleLogs = $scope.logs.slice(offset, offset + limit)
        }

        $scope = rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.version = '__farm_version'
        $scope.presets = []
        $scope.groups = []
        $scope.groupsWithDisabled = []
        $scope.selectedTab = 'settings'
        $scope.settings = genInitialSelectValues()
        $scope.selectedVillage = farmOverflow.getSelectedVillage()
        $scope.lastAttack = farmOverflow.getLastAttack()
        $scope.running = farmOverflow.isRunning()
        $scope.currentStatus = farmOverflow.getCurrentStatus()
        $scope.logs = farmOverflow.getLogs()
        $scope.villagesLabel = {}
        $scope.visibleLogs = []
        $scope.pagination = {
            count: $scope.logs.length,
            offset: 0,
            loader: updateVisibleLogs,
            limit: storageService.getPaginationLimit()
        }

        updateVisibleLogs()
        updatePresets()
        updateGroups()
        loadVillagesLabel()
        updateSelectedVillage()
        updateLastAttack()

        // scope functions
        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.clearLogs = clearLogs
        $scope.switchFarm = switchFarm
        $scope.jumpToVillage = mapService.jumpToVillage
        $scope.openVillageInfo = windowDisplayService.openVillageInfo

        eventScope = new EventScope('twoverflow_farm_window')
        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, updatePresets, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, updateGroups, true)
        eventScope.register(eventTypeProvider.FARM_START, startHandler)
        eventScope.register(eventTypeProvider.FARM_PAUSE, pauseHandler)
        eventScope.register(eventTypeProvider.FARM_VILLAGES_UPDATE, updateSelectedVillage)
        eventScope.register(eventTypeProvider.FARM_NEXT_VILLAGE, updateSelectedVillage)
        eventScope.register(eventTypeProvider.FARM_SEND_COMMAND, updateLastAttack)
        eventScope.register(eventTypeProvider.FARM_STATUS_CHANGE, updateCurrentStatus)
        eventScope.register(eventTypeProvider.FARM_RESET_LOGS, updateLogs)
        eventScope.register(eventTypeProvider.FARM_LOGS_RESETED, resetLogsHandler)
        eventScope.register(eventTypeProvider.FARM_LOGS_UPDATED, updateLogs)
        eventScope.register(eventTypeProvider.FARM_STEP_CYCLE_END, stepCycleEndHandler)
        eventScope.register(eventTypeProvider.FARM_STEP_CYCLE_END_NO_VILLAGES, stepCycleEndNoVillagesHandler)
        eventScope.register(eventTypeProvider.FARM_STEP_CYCLE_NEXT, stepCycleNextHandler)
        eventScope.register(eventTypeProvider.FARM_ERROR, errorHandler)
        eventScope.register(eventTypeProvider.FARM_SETTINGS_CHANGE, saveSettingsHandler)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_farm_window', $scope)
        $scope.settings = parseSettings(farmOverflow.getSettings())
    }

    ui.template('twoverflow_farm_window', `__farm_html_main`)
    ui.css('__farm_css_style')

    var opener = new FrontButton('Farmer', {
        classHover: false,
        classBlur: false,
        onClick: buildWindow
    })

    eventQueue.register(eventTypeProvider.FARM_START, function () {
        opener.$elem.removeClass('btn-green').addClass('btn-red')
    })

    eventQueue.register(eventTypeProvider.FARM_PAUSE, function () {
        opener.$elem.removeClass('btn-red').addClass('btn-green')
    })
})
