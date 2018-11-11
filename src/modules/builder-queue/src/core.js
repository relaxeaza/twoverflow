define('two/builder', [
    'two/builder/defaultOrders',
    'two/locale',
    'two/utils',
    'two/eventQueue',
    'two/ready',
    'Lockr',
    'conf/upgradeabilityStates',
    'conf/buildingTypes',
    'conf/locationTypes'
], function (
    defaultBuildingOrders,
    Locale,
    utils,
    eventQueue,
    ready,
    Lockr,
    UPGRADEABILITY_STATES,
    BUILDING_TYPES,
    LOCATION_TYPES
) {
    var buildingService = injector.get('buildingService')
    var initialized = false
    var running = false
    var buildingSequeOrder
    var localSettings
    var intervalCheckId
    var ANALYSES_PER_MINUTE = 1
    var VILLAGE_BUILDINGS = {}
    var groupList
    var player
    var buildLog
    var settings = {}

    var settingsMap = {
        groupVillages: {
            default: '',
            inputType: 'select'
        },
        buildingPreset: {
            default: 'Essential',
            inputType: 'select'
        },
        buildingOrders: {
            default: defaultBuildingOrders,
            inputType: 'buildingOrder'
        }
    }

    for (var buildingName in BUILDING_TYPES) {
        VILLAGE_BUILDINGS[BUILDING_TYPES[buildingName]] = 0
    }

    var init = function init () {
        Locale.create('builder', __builder_locale, 'en')

        initialized = true
        localSettings = Lockr.get('builder-settings', {}, true)
        buildLog = Lockr.get('builder-log', [], true)
        player = modelDataService.getSelectedCharacter()
        groupList = modelDataService.getGroupList()

        for (var key in settingsMap) {
            var defaultValue = settingsMap[key].default

            settings[key] = localSettings.hasOwnProperty(key)
                ? localSettings[key]
                : defaultValue
        }

        buildingOrderLimit = getSequenceLimit(settings.buildingPreset)

        rootScope.$on(eventTypeProvider.BUILDING_LEVEL_CHANGED, function (event, data) {
            if (!running) {
                return false
            }

            setTimeout(function () {
                var village = player.getVillage(data.village_id)
                analyseVillageBuildings(village)
            }, 1000)
        })
    }

    /**
     * Loop all player villages, check if ready and init the building analyse
     * for each village.
     */
    var analyseVillages = function analyseVillages () {
        var villageIds = settings.groupVillages
            ? groupList.getGroupVillageIds(settings.groupVillages)
            : getVillageIds()

        villageIds.forEach(function (id) {
            var village = player.getVillage(id)
            var readyState = village.checkReadyState()
            var queue = village.buildingQueue

            if (queue.getAmountJobs() === queue.getUnlockedSlots()) {
                return false
            }

            if (!readyState.buildingQueue || !readyState.buildings) {
                return false
            }

            if (!village.isInitialized()) {
                villageService.initializeVillage(village)
            }

            analyseVillageBuildings(village)
        })
    }

    /**
     * Generate an Array with all player's village IDs.
     *
     * @return {Array}
     */
    var getVillageIds = function () {
        var ids = []
        var villages = player.getVillages()

        for (var id in villages) {
            ids.push(id)
        }

        return ids
    }

    /**
     * Loop all village buildings, start build job if available.
     *
     * @param {VillageModel} village
     */
    var analyseVillageBuildings = function analyseVillageBuildings (village) {
        var buildingLevels = angular.copy(village.buildingData.getBuildingLevels())
        var currentQueue = village.buildingQueue.getQueue()
        var buildingOrder = angular.copy(VILLAGE_BUILDINGS)

        currentQueue.forEach(function (job) {
            buildingLevels[job.building]++
        })

        if (checkVillageBuildingLimit(buildingLevels)) {
            return false
        }

        settings.buildingOrders[settings.buildingPreset].some(function (buildingName) {
            if (++buildingOrder[buildingName] > buildingLevels[buildingName]) {
                buildingService.compute(village)

                upgradeBuilding(village, buildingName, function (jobAdded, data) {
                    if (jobAdded) {
                        var now = Date.now()
                        var logData = [
                            {
                                x: village.getX(),
                                y: village.getY(),
                                name: village.getName(),
                                id: village.getId()
                            },
                            data.job.building,
                            data.job.level,
                            now
                        ]

                        eventQueue.trigger('Builder/jobStarted', logData)
                        buildLog.unshift(logData)
                        Lockr.set('builder-log', buildLog)
                    }
                })

                return true
            }
        })
    }

    /**
     * Init a build job
     *
     * @param {VillageModel} village
     * @param {String} buildingName - Building to be build.
     * @param {Function} callback
     */
    var upgradeBuilding = function upgradeBuilding (village, buildingName, callback) {
        var buildingData = village.getBuildingData().getDataForBuilding(buildingName)

        if (buildingData.upgradeability === UPGRADEABILITY_STATES.POSSIBLE) {
            socketService.emit(routeProvider.VILLAGE_UPGRADE_BUILDING, {
                building: buildingName,
                village_id: village.getId(),
                location: LOCATION_TYPES.MASS_SCREEN,
                premium: false
            }, function (data, event) {
                callback(true, data)
            })
        } else {
            callback(false)
        }
    }

    /**
     * Check if all buildings from the order already reached
     * the specified level.
     *
     * @param {Object} buildingLevels - Current buildings level from the village.
     * @return {Boolean} True if the levels already reached the limit.
     */
    var checkVillageBuildingLimit = function checkVillageBuildingLimit (buildingLevels) {
        for (var buildingName in buildingLevels) {
            if (buildingLevels[buildingName] < buildingOrderLimit[buildingName]) {
                return false
            }
        }

        return true
    }

    /**
     * Check if the building order is valid by analysing if the
     * buildings exceed the maximum level.
     *
     * @param {Array} order
     * @return {Boolean}
     */
    var validSequence = function validSequence (order) {
        var buildingOrder = angular.copy(VILLAGE_BUILDINGS)
        var buildingData = modelDataService.getGameData().getBuildings()
        var invalid = false

        order.some(function (buildingName) {
            if (++buildingOrder[buildingName] > buildingData[buildingName].max_level) {
                invalid = true
                return true
            }
        })

        return invalid
    }

    /**
     * Get the level max for each building.
     *
     * @param {String} buildingPreset
     * @return {Object} Maximum level for each building.
     */
    var getSequenceLimit = function getSequenceLimit (buildingPreset) {
        var buildingOrder = settings.buildingOrders[buildingPreset]
        var orderLimit = angular.copy(VILLAGE_BUILDINGS)

        buildingOrder.forEach(function (buildingName) {
            orderLimit[buildingName]++
        })

        return orderLimit
    }

    /**
     * @param {Object} changes - New settings.
     * @return {Boolean} True if the internal settings changed.
     */
    var updateSettings = function updateSettings (changes) {
        var newValue
        var key

        for (key in changes) {
            if (!settingsMap[key]) {
                eventQueue.trigger('Builder/settings/unknownSetting', [key])

                return false
            }

            newValue = changes[key]

            if (angular.equals(settings[key], newValue)) {
                continue
            }

            settings[key] = newValue
        }

        buildingOrderLimit = getSequenceLimit(changes.buildingPreset)
        Lockr.set('builder-settings', settings)

        return true
    }

    var getSettings = function getSettings () {
        return settings
    }

    var start = function start () {
        running = true
        intervalCheckId = setInterval(analyseVillages, 60000 / ANALYSES_PER_MINUTE)
        ready(analyseVillages, ['all_villages_ready'])
        eventQueue.trigger('Builder/start')
    }

    var stop = function stop () {
        running = false
        clearInterval(intervalCheckId)
        eventQueue.trigger('Builder/stop')
    }

    var isInitialized = function isInitialized () {
        return initialized
    }

    var isRunning = function isRunning () {
        return running
    }

    var getBuildLog = function () {
        return buildLog
    }

    var clearLogs = function () {
        buildLog = []
        Lockr.set('builder-log', buildLog)
        eventQueue.trigger('Builder/clearLogs')
    }

    var updateBuildingOrder = function (id, order) {
        var isUpdate = false

        if (id in settings.buildingOrders) {
            isUpdate = true
        }

        if (!angular.isArray(order)) {
            return false
        }

        settings.buildingOrders[id] = order
        Lockr.set('builder-settings', settings)

        if (isUpdate) {
            eventQueue.trigger('Builder/buildingOrders/updated', [id])
        } else {
            eventQueue.trigger('Builder/buildingOrders/added', [id])
        }

        return true
    }

    return {
        init: init,
        start: start,
        stop: stop,
        updateSettings: updateSettings,
        isRunning: isRunning,
        isInitialized: isInitialized,
        settingsMap: settingsMap,
        getSettings: getSettings,
        getBuildLog: getBuildLog,
        clearLogs: clearLogs,
        updateBuildingOrder: updateBuildingOrder,
        version: '__builder_version'
    }
})
