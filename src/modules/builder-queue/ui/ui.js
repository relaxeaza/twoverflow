define('two/builder/ui', [
    'two/builder',
    'two/ui2',
    'two/FrontButton',
    'queues/EventQueue',
    'two/utils',
    'conf/buildingTypes',
    'helper/time',
    'two/ready',
    'two/builder/settings',
    'two/builder/settingsMap',
    'two/EventScope'
], function (
    builderQueue,
    interfaceOverflow,
    FrontButton,
    eventQueue,
    utils,
    BUILDING_TYPES,
    $timeHelper,
    ready,
    SETTINGS,
    SETTINGS_MAP,
    EventScope
) {
    var eventScope
    var $scope
    var textObject = 'builder_queue'
    var textObjectCommon = 'common'
    var buildingOrder = {}
    var buildingOrderFinal = {}
    var groupList = modelDataService.getGroupList()
    var groups = []
    var activePresetId = null
    var selectedEditPreset
    var buildingsLevelPoints = {}
    var running = false

    var TAB_TYPES = {
        SETTINGS: 'settings',
        PRESETS: 'presets',
        LOGS: 'logs'
    }

    var parseSettings = function (rawSettings) {
        var settings = angular.copy(rawSettings)
        var selectedGroup = groups[settings[SETTINGS.GROUP_VILLAGES]]

        if (selectedGroup) {
            settings[SETTINGS.GROUP_VILLAGES] = {
                name: groups[settings[SETTINGS.GROUP_VILLAGES]].name,
                value: settings[SETTINGS.GROUP_VILLAGES]
            }
        } else {
            settings[SETTINGS.GROUP_VILLAGES] = {
                name: $filter('i18n')('select_group', $rootScope.loc.ale, textObject),
                value: null
            }
        }

        settings[SETTINGS.BUILDING_PRESET] = {
            name: settings[SETTINGS.BUILDING_PRESET],
            value: settings[SETTINGS.BUILDING_PRESET]
        }

        return settings
    }

    var generatePresetList = function () {
        var presetList = []
        var presets = $scope.settings[SETTINGS.BUILDING_ORDERS]
        var id

        for (id in presets) {
            presetList.push({
                name: id,
                value: id
            })
        }

        $scope.presetList = presetList
    }

    var buildingLevelReached = function (building, level) {
        var buildingData = modelDataService.getSelectedVillage().getBuildingData()
        return buildingData.getBuildingLevel(building) >= level
    }

    var buildingLevelProgress = function (building, level) {
        var queue = modelDataService.getSelectedVillage().getBuildingQueue().getQueue()
        var progress = false

        queue.some(function (job) {
            if (job.building === building && job.level === level) {
                return progress = true
            }
        })

        return progress
    }

    var generateBuildingOrder = function (_presetId) {
        var presetId = _presetId || $scope.settings[SETTINGS.BUILDING_PRESET].value
        var buildingOrderRaw = $scope.settings[SETTINGS.BUILDING_ORDERS][presetId]
        var buildingData = modelDataService.getGameData().getBuildings()
        var buildingLevels = {}
        var building
        var level
        var state
        var price

        activePresetId = presetId

        for (building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        buildingOrder = buildingOrderRaw.map(function (building) {
            level = ++buildingLevels[building]
            price = buildingData[building].individual_level_costs[level]
            state = 'not-reached'

            if (buildingLevelReached(building, level)) {
                state = 'reached'
            } else if (buildingLevelProgress(building, level)) {
                state = 'progress'
            }

            return {
                level: level,
                price: buildingData[building].individual_level_costs[level],
                building: building,
                duration: $timeHelper.readableSeconds(price.build_time),
                levelPoints: buildingsLevelPoints[building][level - 1],
                state: state
            }
        })
    }

    var generateBuildingOrderFinal = function (_presetId) {
        var settings = builderQueue.getSettings()
        var selectedPreset = settings[SETTINGS.BUILDING_PRESET]
        var presetBuildings = settings[SETTINGS.BUILDING_ORDERS][_presetId || selectedPreset]

        buildingOrderFinal = {}

        presetBuildings.forEach(function (building) {
            buildingOrderFinal[building] = (buildingOrderFinal[building] || 0) + 1
        })
    }

    /**
     * Calculate the total of points accumulated ultil the specified level.
     */
    var getLevelScale = function (factor, base, level) {
        return level ? parseInt(Math.round(factor * Math.pow(base, level - 1)), 10) : 0
    }

    var generateBuildingsLevelPoints = function () {
        var $gameData = modelDataService.getGameData()
        var buildingName
        var buildingData
        var buildingTotalPoints
        var levelPoints
        var currentLevelPoints
        var level

        for(buildingName in $gameData.data.buildings) {
            buildingData = $gameData.getBuildingDataForBuilding(buildingName)
            buildingTotalPoints = 0
            buildingsLevelPoints[buildingName] = []

            for (level = 1; level <= buildingData.max_level; level++) {
                currentLevelPoints  = getLevelScale(buildingData.points, buildingData.points_factor, level)
                levelPoints = currentLevelPoints - buildingTotalPoints
                buildingTotalPoints += levelPoints
                buildingsLevelPoints[buildingName].push(levelPoints)
            }
        }
    }

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var saveSettings = function () {
        $scope.presetBuildings = $scope.settings[SETTINGS.BUILDING_ORDERS][SETTINGS.BUILDING_PRESET]
        builderQueue.updateSettings($scope.settings)
    }

    var switchBuilder = function () {
        if (builderQueue.isRunning()) {
            builderQueue.start()
        } else {
            builderQueue.stop()
        }
    }

    var clearLogs = function () {
        builderQueue.clearLogs()
    }

    var moveUp = function () {
        
    }

    var moveDown = function () {
        
    }

    var addBuilding = function () {
        
    }

    var saveBuildingOrder = function () {

    }

    var eventHandlers = {
        updateGroups: function () {
            var id

            groups = utils.obj2selectOptions(groupList.getGroups(), true)

            for (id in groups) {
                $scope.villageGroups.push({
                    name: groups[id].name,
                    value: id,
                    leftIcon: groups[id].icon
                })
            }
        },
        updateBuildingOrder: function () {
            generateBuildingOrder()
            generateBuildingOrderFinal()
        },
        updateLogs: function () {
            $scope.logs = builderQueue.getLogs()
        },
        buildingOrdersUpdate: function (event, presetId) {
            if (activePresetId === presetId) {
                generateBuildingOrder()
                generateBuildingOrderFinal()
            }

            utils.emitNotif('success', $filter('i18n')('preset.updated', $rootScope.loc.ale, textObject, presetId))
        },
        buildingOrdersAdd: function (event, presetId) {
            utils.emitNotif('success', $filter('i18n')('preset.added', $rootScope.loc.ale, textObject, presetId))
        }
    }

    var init = function () {
        var opener = new FrontButton('Builder', {
            classHover: false,
            classBlur: false,
            onClick: buildWindow
        })

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_START, function () {
            running = true
            opener.$elem.removeClass('btn-green').addClass('btn-red')
            utils.emitNotif('success', $filter('i18n')('general.started', $rootScope.loc.ale, textObject))
        })

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_STOP, function () {
            running = false
            opener.$elem.removeClass('btn-red').addClass('btn-green')
            utils.emitNotif('success', $filter('i18n')('general.stopped', $rootScope.loc.ale, textObject))
        })

        generateBuildingsLevelPoints()

        interfaceOverflow.addTemplate('twoverflow_builder_queue_window', `__builder_html_main`)
        interfaceOverflow.addStyle('__builder_css_style')
    }

    var buildWindow = function () {
        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.selectedTab = TAB_TYPES.SETTINGS
        $scope.TAB_TYPES = TAB_TYPES

        $scope.running = running
        $scope.settings = parseSettings(builderQueue.getSettings())
        $scope.logs = builderQueue.getLogs()
        $scope.buildingOrderFinal = buildingOrderFinal
        $scope.buildingOrder = buildingOrder
        $scope.presetBuildings = $scope.settings[SETTINGS.BUILDING_ORDERS][SETTINGS.BUILDING_PRESET]
        $scope.villageGroups = []
        $scope.presetList = []
        $scope.selectedEditPreset = angular.copy($scope.settings[SETTINGS.BUILDING_PRESET])

        $scope.selectTab = selectTab
        $scope.switchBuilder = switchBuilder
        $scope.clearLogs = clearLogs
        $scope.saveSettings = saveSettings
        $scope.moveUp = moveUp
        $scope.moveDown = moveDown
        $scope.addBuilding = addBuilding
        $scope.saveBuildingOrder = saveBuildingOrder

        generatePresetList()
        generateBuildingOrder()
        generateBuildingOrderFinal()

        eventScope = new EventScope('twoverflow_builder_queue_window')
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.VILLAGE_SELECTED_CHANGED, eventHandlers.updateBuildingOrder, true)
        eventScope.register(eventTypeProvider.BUILDING_UPGRADING, eventHandlers.updateBuildingOrder, true)
        eventScope.register(eventTypeProvider.BUILDING_LEVEL_CHANGED, eventHandlers.updateBuildingOrder, true)
        eventScope.register(eventTypeProvider.BUILDING_TEARING_DOWN, eventHandlers.updateBuildingOrder, true)
        eventScope.register(eventTypeProvider.VILLAGE_BUILDING_QUEUE_CHANGED, eventHandlers.updateBuildingOrder, true)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_JOB_STARTED, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_ORDERS_UPDATED, eventHandlers.buildingOrdersUpdate)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_ORDERS_ADDED, eventHandlers.buildingOrdersAdd)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_builder_queue_window', $scope)
    }

    return init
})
