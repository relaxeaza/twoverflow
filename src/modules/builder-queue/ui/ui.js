define('two/builder/ui', [
    'two/builder',
    'two/ui2',
    'two/FrontButton',
    'two/eventQueue',
    'two/utils',
    'conf/buildingTypes',
    'helper/time',
    'two/ready',
    'two/builder/settingsMap'
], function (
    builderQueue,
    interfaceOverflow,
    FrontButton,
    eventQueue,
    utils,
    BUILDING_TYPES,
    $timeHelper,
    ready,
    SETTINGS_MAP
) {
    var eventScope
    var $scope
    var textObject = 'buider'
    var textObjectCommon = 'common'
    var buildingOrder = {}
    var buildingOrderFinal = {}
    var groupList = modelDataService.getGroupList()
    var groups = []
    var groupVillages = []
    var activePresetId = null

    var TAB_TYPES = {
        SETTINGS: 'settings',
        PRESETS: 'presets',
        LOGS: 'logs'
    }
    var DEFAULT_TAB = TAB_TYPES.SETTINGS

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var saveSettings = function () {
        // update var
        $scope.presetBuildings = settings[SETTINGS.BUILDING_ORDERS][SETTINGS.BUILDING_PRESET]
    }

    var parseSettings = function (rawSettings) {
        var settings = angular.copy(rawSettings)

        settings[SETTINGS.GROUP_VILLAGES] = {
            name: groups[settings[SETTINGS.GROUP_VILLAGES]] || 'DISABLED',
            value: settings[SETTINGS.GROUP_VILLAGES]
        }

        settings[SETTINGS.BUILDING_PRESET] = {
            name: settings[SETTINGS.BUILDING_PRESET],
            value: settings[SETTINGS.BUILDING_PRESET]
        }

        return settings
    }

    var generateBuildingOrder = function (_presetId) {
        var settings = builderQueue.getSettings()
        var presetId = _presetId || settings[SETTINGS.BUILDING_PRESET]
        var buildingOrder = settings[SETTINGS.BUILDING_ORDERS][presetId]
        var buildingData = modelDataService.getGameData().getBuildings()
        var buildingLevels = {}
        var building
        var level

        activePresetId = presetId

        for (building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        buildingOrder = buildingOrder.map(function (building) {
            level = ++buildingLevels[building]

            return {
                level: level,
                price: buildingData[building].individual_level_costs[level],
                building: building,
                duration: $timeHelper.readableSeconds(price.build_time),
                levelPoints: buildingsLevelPoints[building][level - 1]
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

    var eventHandlers = {
        updateGroups: function () {
            var id

            groups = utils.obj2selectOptions(groupList.getGroups(), true)

            for (id in groups) {
                groupVillages.push({
                    name: groups[id].name,
                    value: id,
                    leftIcon: groups[id].icon
                })
            }
        }
    }

    var init = function () {
        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.settings = parseSettings(builderQueue.getSettings())
        $scope.buildingOrderFinal = buildingOrderFinal
        $scope.buildingOrder = buildingOrder
        $scope.selectedTab = DEFAULT_TAB
        $scope.selectTab = selectTab
        $scope.presetBuildings = settings[SETTINGS.BUILDING_ORDERS][SETTINGS.BUILDING_PRESET]

        generateBuildingOrder()
        generateBuildingOrderFinal()

        eventScope = new EventScope('twoverflow_builder_queue_window')
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
    }

    return init
})
