define('two/builderQueue', [
    'two/builderQueue/settings',
    'two/builderQueue/settingsMap',
    'two/builderQueue/errorCodes',
    'two/utils',
    'queues/EventQueue',
    'two/ready',
    'Lockr',
    'conf/upgradeabilityStates',
    'conf/buildingTypes',
    'conf/locationTypes',
    'two/builderQueue/events'
], function (
    SETTINGS,
    SETTINGS_MAP,
    ERROR_CODES,
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
    var localSettings
    var intervalCheckId
    var buildingSequenceLimit
    var ANALYSES_PER_MINUTE = 1
    var VILLAGE_BUILDINGS = {}
    var groupList
    var $player
    var logs
    var sequencesAvail = true
    var settings = {}
    var STORAGE_KEYS = {
        LOGS: 'builder_queue_log',
        SETTINGS: 'builder_queue_settings'
    }
    var builderQueue = {}

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

        if (!sequencesAvail) {
            builderQueue.stop()
            return false
        }

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
        var sequence = angular.copy(VILLAGE_BUILDINGS)
        var now
        var logData

        currentQueue.forEach(function (job) {
            buildingLevels[job.building]++
        })

        if (checkVillageBuildingLimit(buildingLevels)) {
            return false
        }

        settings[SETTINGS.BUILDING_SEQUENCES][settings[SETTINGS.ACTIVE_SEQUENCE]].some(function (buildingName) {
            if (++sequence[buildingName] > buildingLevels[buildingName]) {
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
                        Lockr.set(STORAGE_KEYS.LOGS, logs)
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
     * Check if all buildings from the sequence already reached
     * the specified level.
     *
     * @param {Object} buildingLevels - Current buildings level from the village.
     * @return {Boolean} True if the levels already reached the limit.
     */
    var checkVillageBuildingLimit = function (buildingLevels) {
        for (var buildingName in buildingLevels) {
            if (buildingLevels[buildingName] < buildingSequenceLimit[buildingName]) {
                return false
            }
        }

        return true
    }

    /**
     * Check if the building sequence is valid by analysing if the
     * buildings exceed the maximum level.
     *
     * @param {Array} sequence
     * @return {Boolean}
     */
    var validSequence = function (sequence) {
        var sequence = angular.copy(VILLAGE_BUILDINGS)
        var buildingData = modelDataService.getGameData().getBuildings()
        var building
        var i

        for (i = 0; i < sequence.length; i++) {
            building = sequence[i]

            if (++sequence[building] > buildingData[building].max_level) {
                return false
            }
        }

        return true
    }

    /**
     * Get the level max for each building.
     *
     * @param {String} sequenceId
     * @return {Object} Maximum level for each building.
     */
    var getSequenceLimit = function (sequenceId) {
        var sequence = settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]
        var sequenceLimit = angular.copy(VILLAGE_BUILDINGS)

        sequence.forEach(function (buildingName) {
            sequenceLimit[buildingName]++
        })

        return sequenceLimit
    }

    builderQueue.init = function () {
        var key
        var defaultValue
        var buildingName
        var village

        initialized = true
        localSettings = Lockr.get(STORAGE_KEYS.SETTINGS, {}, true)
        logs = Lockr.get(STORAGE_KEYS.LOGS, [], true)
        $player = modelDataService.getSelectedCharacter()
        groupList = modelDataService.getGroupList()

        for (key in SETTINGS_MAP) {
            defaultValue = SETTINGS_MAP[key].default
            settings[key] = localSettings.hasOwnProperty(key) ? localSettings[key] : defaultValue
        }

        for (buildingName in BUILDING_TYPES) {
            VILLAGE_BUILDINGS[BUILDING_TYPES[buildingName]] = 0
        }

        sequencesAvail = Object.keys(settings[SETTINGS.BUILDING_SEQUENCES]).length
        buildingSequenceLimit = sequencesAvail ? getSequenceLimit(settings[SETTINGS.ACTIVE_SEQUENCE]) : false

        $rootScope.$on(eventTypeProvider.BUILDING_LEVEL_CHANGED, function (event, data) {
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
        if (!sequencesAvail) {
            eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_NO_SEQUENCES)
            return false
        }

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

    builderQueue.updateSettings = function (changes, _quiet) {
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

        sequencesAvail = Object.keys(settings[SETTINGS.BUILDING_SEQUENCES]).length
        buildingSequenceLimit = sequencesAvail ? getSequenceLimit(settings[SETTINGS.ACTIVE_SEQUENCE]) : false
        Lockr.set(STORAGE_KEYS.SETTINGS, settings)

        if (!_quiet) {
            eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_SETTINGS_CHANGE)
        }

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
        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS)
    }

    builderQueue.addBuildingSequence = function (id, sequence) {
        if (id in settings[SETTINGS.BUILDING_SEQUENCES]) {
            return ERROR_CODES.SEQUENCE_EXISTS
        }

        if (!angular.isArray(sequence)) {
            return ERROR_CODES.SEQUENCE_INVALID
        }

        settings[SETTINGS.BUILDING_SEQUENCES][id] = sequence
        Lockr.set(STORAGE_KEYS.SETTINGS, settings)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED, id)

        return true
    }

    builderQueue.updateBuildingSequence = function (id, sequence) {
        if (!(id in settings[SETTINGS.BUILDING_SEQUENCES])) {
            return ERROR_CODES.SEQUENCE_NO_EXISTS
        }

        if (!angular.isArray(sequence) || !validSequence(sequence)) {
            return ERROR_CODES.SEQUENCE_INVALID
        }

        settings[SETTINGS.BUILDING_SEQUENCES][id] = sequence
        Lockr.set(STORAGE_KEYS.SETTINGS, settings)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED, id)

        return true
    }

    builderQueue.removeSequence = function (id) {
        if (!(id in settings[SETTINGS.BUILDING_SEQUENCES])) {
            return ERROR_CODES.SEQUENCE_NO_EXISTS
        }

        delete settings[SETTINGS.BUILDING_SEQUENCES][id]
        Lockr.set(STORAGE_KEYS.SETTINGS, settings)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED, id)
    }

    return builderQueue
})
