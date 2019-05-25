define('two/farmOverflow/ui', [
    'two/ui',
    'two/ui/button',
    'two/farmOverflow',
    'two/farmOverflow/errorTypes',
    'two/farmOverflow/logTypes',
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
    SETTINGS,
    Settings,
    utils,
    EventScope,
    eventQueue,
    mapData,
    timeHelper
) {
    var eventScope
    var $scope
    var textObject = 'farm_overflow'
    var textObjectCommon = 'common'
    var SELECT_SETTINGS = [
        SETTINGS.PRESETS,
        SETTINGS.GROUP_IGNORE,
        SETTINGS.GROUP_INCLUDE,
        SETTINGS.GROUP_ONLY
    ]
    var TAB_TYPES = {
        SETTINGS: 'settings',
        LOGS: 'logs'
    }
    var presetList = modelDataService.getPresetList()
    var groupList = modelDataService.getGroupList()
    var settings

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var clearLogs = function () {
        $scope.logs = []
        $scope.visibleLogs = []
        farmOverflow.clearLogs()
    }

    var saveSettings = function () {
        settings.setSettings(settings.decodeSettings($scope.settings))
        utils.emitNotif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, textObject))
    }

    var switchFarm = function () {
        farmOverflow.switchState(true)
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

    var updateVisibleLogs = function () {
        var offset = $scope.pagination.offset
        var limit = $scope.pagination.limit

        $scope.visibleLogs = $scope.logs.slice(offset, offset + limit)
    }

    var eventHandlers = {
        updatePresets: function () {
            $scope.presets = Settings.encodeList(presetList.getPresets(), {
                disabled: false,
                type: 'presets'
            })
        },
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                disabled: false,
                type: 'groups'
            })

            $scope.groupsWithDisabled = Settings.encodeList(groupList.getGroups(), {
                disabled: true,
                type: 'groups'
            })
        },
        start: function (event, _manual) {
            $scope.running = true

            if (_manual) {
                utils.emitNotif('success', $filter('i18n')('farm_started', $rootScope.loc.ale, textObject))
            }
        },
        pause: function (event, _manual) {
            $scope.running = false

            if (_manual) {
                utils.emitNotif('success', $filter('i18n')('farm_paused', $rootScope.loc.ale, textObject))
            }
        },
        updateSelectedVillage: function () {
            $scope.selectedVillage = farmOverflow.getSelectedVillage()
        },
        updateLastAttack: function () {
            $scope.lastAttack = farmOverflow.getLastAttack()
        },
        updateCurrentStatus: function (event, status) {
            $scope.currentStatus = status
        },
        updateLogs: function () {
            $scope.logs = angular.copy(farmOverflow.getLogs())

            loadVillagesLabel()
            updateVisibleLogs()
        },
        resetLogsHandler: function () {
            utils.emitNotif('success', $filter('i18n')('reseted_logs', $rootScope.loc.ale, textObject))
        },
        stepCycleEndHandler: function () {
            if (settings.getSetting(SETTINGS.STEP_CYCLE_NOTIFS)) {
                utils.emitNotif('error', $filter('i18n')('step_cycle_end', $rootScope.loc.ale, textObject))
            }
        },
        stepCycleEndNoVillagesHandler: function () {
            utils.emitNotif('error', $filter('i18n')('step_cycle_end_no_villages', $rootScope.loc.ale, textObject))
        },
        stepCycleNextHandler: function () {
            if (settings.getSetting(SETTINGS.STEP_CYCLE_NOTIFS)) {
                var next = timeHelper.gameTime() + (settings.getSetting(SETTINGS.STEP_CYCLE_INTERVAL) * 60)

                utils.emitNotif('success', $filter('i18n')('step_cycle_next', $rootScope.loc.ale, textObject, utils.formatDate(next)))
            }
        },
        errorHandler: function (event, args) {
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
                utils.emitNotif('error', $filter('i18n')('no_selected_village', $rootScope.loc.ale, textObject))
                break
            }
        }
    }

    var init = function () {
        settings = farmOverflow.getSettings()

        var opener = new FrontButton('Farmer', {
            classHover: false,
            classBlur: false,
            onClick: buildWindow
        })

        eventQueue.register(eventTypeProvider.FARM_START, function () {
            opener.$elem.classList.remove('btn-green')
            opener.$elem.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.FARM_PAUSE, function () {
            opener.$elem.classList.remove('btn-red')
            opener.$elem.classList.add('btn-green')
        })

        interfaceOverflow.addTemplate('twoverflow_farm_window', `__farm_overflow_html_main`)
        interfaceOverflow.addStyle('__farm_overflow_css_style')
    }

    var buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.LOG_TYPES = LOG_TYPES
        $scope.selectedTab = TAB_TYPES.SETTINGS
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

        settings.injectSettings($scope)
        eventHandlers.updatePresets()
        eventHandlers.updateGroups()
        eventHandlers.updateSelectedVillage()
        eventHandlers.updateLastAttack()
        updateVisibleLogs()
        loadVillagesLabel()

        // scope functions
        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.clearLogs = clearLogs
        $scope.switchFarm = switchFarm
        $scope.jumpToVillage = mapService.jumpToVillage
        $scope.openVillageInfo = windowDisplayService.openVillageInfo

        eventScope = new EventScope('twoverflow_farm_window')
        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.FARM_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.FARM_PAUSE, eventHandlers.pause)
        eventScope.register(eventTypeProvider.FARM_VILLAGES_UPDATE, eventHandlers.updateSelectedVillage)
        eventScope.register(eventTypeProvider.FARM_NEXT_VILLAGE, eventHandlers.updateSelectedVillage)
        eventScope.register(eventTypeProvider.FARM_SEND_COMMAND, eventHandlers.updateLastAttack)
        eventScope.register(eventTypeProvider.FARM_STATUS_CHANGE, eventHandlers.updateCurrentStatus)
        eventScope.register(eventTypeProvider.FARM_RESET_LOGS, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.FARM_LOGS_RESETED, eventHandlers.resetLogsHandler)
        eventScope.register(eventTypeProvider.FARM_LOGS_UPDATED, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.FARM_STEP_CYCLE_END, eventHandlers.stepCycleEndHandler)
        eventScope.register(eventTypeProvider.FARM_STEP_CYCLE_END_NO_VILLAGES, eventHandlers.stepCycleEndNoVillagesHandler)
        eventScope.register(eventTypeProvider.FARM_STEP_CYCLE_NEXT, eventHandlers.stepCycleNextHandler)
        eventScope.register(eventTypeProvider.FARM_ERROR, eventHandlers.errorHandler)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_farm_window', $scope)
    }

    return init
})
