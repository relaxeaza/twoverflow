define('two/farmOverflow/ui', [
    'two/ui',
    'two/farmOverflow',
    'two/farmOverflow/errorTypes',
    'two/farmOverflow/logTypes',
    'two/farmOverflow/settings',
    'two/Settings',
    'two/EventScope',
    'two/utils',
    'queues/EventQueue',
    'struct/MapData',
    'helper/time',
], function (
    interfaceOverflow,
    farmOverflow,
    ERROR_TYPES,
    LOG_TYPES,
    SETTINGS,
    Settings,
    EventScope,
    utils,
    eventQueue,
    $mapData,
    timeHelper
) {
    var textObject = 'farm_overflow'
    var textObjectCommon = 'common'
    var $scope
    var settings
    var presetList = modelDataService.getPresetList()
    var groupList = modelDataService.getGroupList()
    var $opener

    var TAB_TYPES = {
        SETTINGS: 'settings',
        LOGS: 'logs'
    }

    var updateVisibleLogs = function () {
        var offset = $scope.pagination.offset
        var limit = $scope.pagination.limit

        $scope.visibleLogs = $scope.logs.slice(offset, offset + limit)
        $scope.pagination.count = $scope.logs.length
    }

    var villageLabel = function (log) {
        if (log.villageX) {
            return `#${log.villageId} (${log.villageX}|${log.villageY})`
        } else {
            return '#' + log.villageId
        }
    }

    var switchFarm = function () {
        if (farmOverflow.isRunning()) {
            farmOverflow.stop()
        } else {
            farmOverflow.start()
        }
    }

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))

        $rootScope.$broadcast(eventTypeProvider.MESSAGE_SUCCESS, {
            message: $filter('i18n')('settings_saved', $rootScope.loc.ale, textObject)
        })
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
        start: function () {
            $scope.running = true

            $rootScope.$broadcast(eventTypeProvider.MESSAGE_SUCCESS, {
                message: $filter('i18n')('farm_started', $rootScope.loc.ale, textObject)
            })
        },
        stop: function (event, data) {
            $scope.running = false

            switch (data.reason) {
            case ERROR_TYPES.NO_PRESETS:
                $rootScope.$broadcast(eventTypeProvider.MESSAGE_SUCCESS, {
                    message: $filter('i18n')('no_preset', $rootScope.loc.ale, textObject)
                })
                break

            default:
            case ERROR_TYPES.USER_STOP:
                $rootScope.$broadcast(eventTypeProvider.MESSAGE_SUCCESS, {
                    message: $filter('i18n')('farm_stopped', $rootScope.loc.ale, textObject)
                })
                break
            }
        },
        updateLogs: function () {
            $scope.logs = angular.copy(farmOverflow.getLogs())
            updateVisibleLogs()

            if (!$scope.logs.length) {
                $rootScope.$broadcast(eventTypeProvider.MESSAGE_SUCCESS, {
                    message: $filter('i18n')('reseted_logs', $rootScope.loc.ale, textObject)
                })
            }
        }
    }

    var init = function () {
        settings = farmOverflow.getSettings()
        $opener = interfaceOverflow.addMenuButton('Farmer', 10)

        $opener.addEventListener('click', function () {
            buildWindow()
        })

        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_START, function () {
            $opener.classList.remove('btn-green')
            $opener.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_STOP, function () {
            $opener.classList.remove('btn-red')
            $opener.classList.add('btn-green')
        })

        interfaceOverflow.addTemplate('twoverflow_farm_overflow_window', `__farm_overflow_html_main`)
        interfaceOverflow.addStyle('__farm_overflow_css_style')
    }

    var buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.LOG_TYPES = LOG_TYPES
        $scope.running = farmOverflow.isRunning()
        $scope.selectedTab = TAB_TYPES.SETTINGS
        $scope.logs = farmOverflow.getLogs()
        $scope.visibleLogs = []
        $scope.pagination = {
            count: $scope.logs.length,
            offset: 0,
            loader: updateVisibleLogs,
            limit: storageService.getPaginationLimit()
        }

        settings.injectScope($scope)
        eventHandlers.updatePresets()
        eventHandlers.updateGroups()
        updateVisibleLogs()

        // scope functions
        $scope.switchFarm = switchFarm
        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.clearLogs = farmOverflow.clearLogs
        $scope.jumpToVillage = mapService.jumpToVillage
        $scope.openVillageInfo = windowDisplayService.openVillageInfo
        $scope.villageLabel = villageLabel

        eventScope = new EventScope('twoverflow_farm_overflow_window')
        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_STOP, eventHandlers.stop)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED, eventHandlers.updateLogs)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_farm_overflow_window', $scope)
    }

    return init
})
