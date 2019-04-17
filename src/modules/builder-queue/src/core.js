define('two/builder', [
    'two/builder/settings',
    'two/builder/settingsMap',
    'two/utils',
    'two/eventQueue',
    'two/ready',
    'Lockr',
    'conf/upgradeabilityStates',
    'conf/buildingTypes',
    'conf/locationTypes',
    'two/builder/events'
], function (
    SETTINGS,
    SETTINGS_MAP,
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
    var $player
    var logs
    var settings = {}
    var STORAGE_ID = {
        LOGS: 'builder_queue_log',
        SETTINGS: 'builder_queue_settings'
    }

    /**
     * Loop all player villages, check if ready and init the building analyse
     * for each village.
     */
    var analyseVillages = function () {
        var villageIds = settings[SETTINGS.GROUP_VILLAGES]
            ? groupList.getGroupVillageIds(settings[SETTINGS.GROUP_VILLAGES])
            : getVillageIds()
        var village
        var readyState
        var queue

        villageIds.forEach(function (id) {
            village = $player.getVillage(id)
            readyState = village.checkReadyState()
            queue = village.buildingQueue

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
        var villages = $player.getVillages()
        var id

        for (id in villages) {
            ids.push(id)
        }

        return ids
    }

    /**
     * Loop all village buildings, start build job if available.
     *
     * @param {VillageModel} village
     */
    var analyseVillageBuildings = function (village) {
        var buildingLevels = angular.copy(village.buildingData.getBuildingLevels())
        var currentQueue = village.buildingQueue.getQueue()
        var buildingOrder = angular.copy(VILLAGE_BUILDINGS)
        var now
        var logData

        currentQueue.forEach(function (job) {
            buildingLevels[job.building]++
        })

        if (checkVillageBuildingLimit(buildingLevels)) {
            return false
        }

        settings[SETTINGS.BUILDING_ORDERS][settings[SETTINGS.BUILDING_PRESET]].some(function (buildingName) {
            if (++buildingOrder[buildingName] > buildingLevels[buildingName]) {
                buildingService.compute(village)

                upgradeBuilding(village, buildingName, function (jobAdded, data) {
                    if (jobAdded) {
                        now = Date.now()
                        logData = [
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

                        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_JOB_STARTED, logData)
                        logs.unshift(logData)
                        Lockr.set(STORAGE_ID.LOGS, logs)
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
    var upgradeBuilding = function (village, buildingName, callback) {
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
    var checkVillageBuildingLimit = function (buildingLevels) {
        for (var buildingName in buildingLevels) {
            if (buildingLevels[buildingName] < buildingOrderLimit[buildingName]) {
                return false
            }
        }

        return true
    }

    // /**
    //  * Check if the building order is valid by analysing if the
    //  * buildings exceed the maximum level.
    //  *
    //  * @param {Array} order
    //  * @return {Boolean}
    //  */
    // var validSequence = function (order) {
    //     var buildingOrder = angular.copy(VILLAGE_BUILDINGS)
    //     var buildingData = modelDataService.getGameData().getBuildings()
    //     var invalid = false

    //     order.some(function (buildingName) {
    //         if (++buildingOrder[buildingName] > buildingData[buildingName].max_level) {
    //             invalid = true
    //             return true
    //         }
    //     })

    //     return invalid
    // }

    /**
     * Get the level max for each building.
     *
     * @param {String} buildingPreset
     * @return {Object} Maximum level for each building.
     */
    var getSequenceLimit = function (buildingPreset) {
        var buildingOrder = settings[SETTINGS.BUILDING_ORDERS][buildingPreset]
        var orderLimit = angular.copy(VILLAGE_BUILDINGS)

        buildingOrder.forEach(function (buildingName) {
            orderLimit[buildingName]++
        })

        return orderLimit
    }

    var builderQueue = {}

    builderQueue.init = function () {
        var key
        var defaultValue
        var buildingName
        var village

        initialized = true
        localSettings = Lockr.get(STORAGE_ID.SETTINGS, {}, true)
        logs = Lockr.get(STORAGE_ID.LOGS, [], true)
        $player = modelDataService.getSelectedCharacter()
        groupList = modelDataService.getGroupList()

        for (key in SETTINGS_MAP) {
            defaultValue = SETTINGS_MAP[key].default
            settings[key] = localSettings.hasOwnProperty(key) ? localSettings[key] : defaultValue
        }

        for (buildingName in BUILDING_TYPES) {
            VILLAGE_BUILDINGS[BUILDING_TYPES[buildingName]] = 0
        }

        buildingOrderLimit = getSequenceLimit(settings[SETTINGS.BUILDING_PRESET])

        rootScope.$on(eventTypeProvider.BUILDING_LEVEL_CHANGED, function (event, data) {
            if (!running) {
                return false
            }

            setTimeout(function () {
                village = $player.getVillage(data.village_id)
                analyseVillageBuildings(village)
            }, 1000)
        })
    }

    builderQueue.start = function () {
        running = true
        intervalCheckId = setInterval(analyseVillages, 60000 / ANALYSES_PER_MINUTE)
        ready(analyseVillages, ['all_villages_ready'])
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_START)
    }

    builderQueue.stop = function () {
        running = false
        clearInterval(intervalCheckId)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_STOP)
    }

    builderQueue.isRunning = function () {
        return running
    }

    builderQueue.isInitialized = function () {
        return initialized
    }

    builderQueue.updateSettings = function (changes) {
        var newValue
        var key

        for (key in changes) {
            if (!SETTINGS_MAP[key]) {
                eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_UNKNOWN_SETTING, [key])

                return false
            }

            newValue = changes[key]

            if (angular.equals(settings[key], newValue)) {
                continue
            }

            settings[key] = newValue
        }

        buildingOrderLimit = getSequenceLimit(changes.buildingPreset)
        Lockr.set(STORAGE_ID.SETTINGS, settings)

        return true
    }

    builderQueue.getSettings = function () {
        return settings
    }

    builderQueue.getLogs = function () {
        return logs
    }

    builderQueue.clearLogs = function () {
        logs = []
        Lockr.set(STORAGE_ID.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS)
    }

    builderQueue.updateBuildingOrder = function (id, order) {
        var isUpdate = false

        if (id in settings[SETTINGS.BUILDING_ORDERS]) {
            isUpdate = true
        }

        if (!angular.isArray(order)) {
            return false
        }

        settings[SETTINGS.BUILDING_ORDERS][id] = order
        Lockr.set(STORAGE_ID.SETTINGS, settings)

        if (isUpdate) {
            eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_ORDERS_UPDATED, [id])
        } else {
            eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_ORDERS_ADDED, [id])
        }

        return true
    }

    return builderQueue
})
