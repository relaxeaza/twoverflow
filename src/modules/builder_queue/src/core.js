define('two/builderQueue', [
    'two/ready',
    'two/utils',
    'two/Settings',
    'two/builderQueue/settings',
    'two/builderQueue/settings/map',
    'two/builderQueue/settings/updates',
    'two/builderQueue/types/errors',
    'conf/upgradeabilityStates',
    'conf/buildingTypes',
    'conf/locationTypes',
    'queues/EventQueue',
    'Lockr'
], function (
    ready,
    utils,
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    ERROR_CODES,
    UPGRADEABILITY_STATES,
    BUILDING_TYPES,
    LOCATION_TYPES,
    eventQueue,
    Lockr
) {
    var buildingService = injector.get('buildingService')
    var premiumActionService = injector.get('premiumActionService')
    var buildingQueueService = injector.get('buildingQueueService')
    var initialized = false
    var running = false
    var localSettings
    var intervalCheckId
    var buildingSequenceLimit
    var ANALYSES_PER_MINUTE = 1
    var ANALYSES_PER_MINUTE_INSTANT_FINISH = 10
    var VILLAGE_BUILDINGS = {}
    var groupList
    var $player
    var logs
    var sequencesAvail = true
    var settings
    var STORAGE_KEYS = {
        LOGS: 'builder_queue_log',
        SETTINGS: 'builder_queue_settings'
    }

    /**
     * Loop all player villages, check if ready and init the building analyse
     * for each village.
     */
    var analyseVillages = function () {
        var villageIds = getVillageIds()
        var village
        var readyState
        var queue

        if (!sequencesAvail) {
            builderQueue.stop()
            return false
        }

        villageIds.forEach(function (villageId) {
            village = $player.getVillage(villageId)
            readyState = village.checkReadyState()
            queue = village.buildingQueue
            jobs = queue.getAmountJobs()

            if (jobs === queue.getUnlockedSlots()) {
                return false
            }

            if (!readyState.buildingQueue || !readyState.buildings) {
                return false
            }

            analyseVillageBuildings(village)
        })
    }

    var analyseVillagesInstantFinish = function () {
        var villageIds = getVillageIds()
        var village
        var queue
        var jobs

        villageIds.forEach(function (villageId) {
            village = $player.getVillage(villageId)
            queue = village.buildingQueue

            if (queue.getAmountJobs()) {
                jobs = queue.getQueue()

                jobs.forEach(function (job) {
                    if (buildingQueueService.canBeFinishedForFree(job, village)) {
                        premiumActionService.instantBuild(job, LOCATION_TYPES.MASS_SCREEN, true, villageId)
                    }
                })
            }
        })
    }

    var initializeAllVillages = function () {
        var villageIds = getVillageIds()
        var village

        villageIds.forEach(function (villageId) {
            village = $player.getVillage(villageId)

            if (!village.isInitialized()) {
                villageService.initializeVillage(village)
            }
        })
    }

    /**
     * Generate an Array with all player's village IDs.
     *
     * @return {Array}
     */
    var getVillageIds = function () {
        var ids = []
        var groupVillages = settings.get(SETTINGS.GROUP_VILLAGES)
        var villages = []

        if (groupVillages) {
            villages = groupList.getGroupVillageIds(groupVillages)
            villages = villages.filter(function (vid) {
                return $player.getVillage(vid)
            })
        } else {
            angular.forEach($player.getVillages(), function (village) {
                villages.push(village.getId())
            })
        }

        return villages
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
        var sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
        var activeSequenceId = settings.get(SETTINGS.ACTIVE_SEQUENCE)
        var activeSequence = sequences[activeSequenceId]

        currentQueue.forEach(function (job) {
            buildingLevels[job.building]++
        })

        if (checkVillageBuildingLimit(buildingLevels)) {
            return false
        }

        activeSequence.some(function (buildingName) {
            if (++sequence[buildingName] > buildingLevels[buildingName]) {
                buildingService.compute(village)

                checkAndUpgradeBuilding(village, buildingName, function (jobAdded, data) {
                    if (jobAdded) {
                        if (!data.job) {
                            return false
                        }

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
    var checkAndUpgradeBuilding = function (village, buildingName, callback) {
        var upgradeability = checkBuildingUpgradeability(village, buildingName)
        var limitFarm
        var currentFarm

        if (upgradeability === UPGRADEABILITY_STATES.POSSIBLE) {
            upgradeBuilding(village, buildingName, function (event, data) {
                callback(true, data)
            })
        } else if (upgradeability === UPGRADEABILITY_STATES.NOT_ENOUGH_FOOD) {
            if (settings.get(SETTINGS.PRIORIZE_FARM)) {
                limitFarm = buildingSequenceLimit[BUILDING_TYPES.FARM]
                villageFarm = village.getBuildingData().getDataForBuilding(BUILDING_TYPES.FARM)

                if (villageFarm.level < limitFarm) {
                    upgradeBuilding(village, BUILDING_TYPES.FARM, function (event, data) {
                        callback(true, data)
                    })
                }
            }
        }

        callback(false)
    }

    var upgradeBuilding = function (village, buildingName, callback) {
        socketService.emit(routeProvider.VILLAGE_UPGRADE_BUILDING, {
            building: buildingName,
            village_id: village.getId(),
            location: LOCATION_TYPES.MASS_SCREEN,
            premium: false
        }, callback)
    }

    /**
     * Can't just use the .upgradeability value because of the preserve resources setting.
     */
    var checkBuildingUpgradeability = function (village, buildingName) {
        var buildingData = village.getBuildingData().getDataForBuilding(buildingName)
        var nextLevelCosts
        var resources

        if (buildingData.upgradeability === UPGRADEABILITY_STATES.POSSIBLE) {
            nextLevelCosts = buildingData.nextLevelCosts
            resources = village.getResources().getComputed()

            if (
                resources.clay.currentStock - settings.get(SETTINGS.PRESERVE_CLAY) < nextLevelCosts.clay ||
                resources.iron.currentStock - settings.get(SETTINGS.PRESERVE_IRON) < nextLevelCosts.iron ||
                resources.wood.currentStock - settings.get(SETTINGS.PRESERVE_WOOD) < nextLevelCosts.wood
            ) {
                return UPGRADEABILITY_STATES.NOT_ENOUGH_RESOURCES
            }
        }

        return buildingData.upgradeability
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
        var sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
        var sequence = sequences[sequenceId]
        var sequenceLimit = angular.copy(VILLAGE_BUILDINGS)

        sequence.forEach(function (buildingName) {
            sequenceLimit[buildingName]++
        })

        return sequenceLimit
    }

    var builderQueue = {}

    builderQueue.start = function () {
        if (!sequencesAvail) {
            eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_NO_SEQUENCES)
            return false
        }

        running = true
        intervalCheckId = setInterval(analyseVillages, 60000 / ANALYSES_PER_MINUTE)
        intervalInstantCheckId = setInterval(analyseVillagesInstantFinish, 60000 / ANALYSES_PER_MINUTE_INSTANT_FINISH)
        
        ready(function () {
            initializeAllVillages()
            analyseVillages()
            analyseVillagesInstantFinish()
        }, ['all_villages_ready'])

        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_START)
    }

    builderQueue.stop = function () {
        running = false
        clearInterval(intervalCheckId)
        clearInterval(intervalInstantCheckId)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_STOP)
    }

    builderQueue.isRunning = function () {
        return running
    }

    builderQueue.isInitialized = function () {
        return initialized
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
        var sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)

        if (id in sequences) {
            return ERROR_CODES.SEQUENCE_EXISTS
        }

        if (!angular.isArray(sequence)) {
            return ERROR_CODES.SEQUENCE_INVALID
        }

        sequences[id] = sequence
        settings.set(SETTINGS.BUILDING_SEQUENCES, sequences, {
            quiet: true
        })
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED, id)

        return true
    }

    builderQueue.updateBuildingSequence = function (id, sequence) {
        var sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)

        if (!(id in sequences)) {
            return ERROR_CODES.SEQUENCE_NO_EXISTS
        }

        if (!angular.isArray(sequence) || !validSequence(sequence)) {
            return ERROR_CODES.SEQUENCE_INVALID
        }

        sequences[id] = sequence
        settings.set(SETTINGS.BUILDING_SEQUENCES, sequences, {
            quiet: true
        })
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED, id)

        return true
    }

    builderQueue.removeSequence = function (id) {
        var sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)

        if (!(id in sequences)) {
            return ERROR_CODES.SEQUENCE_NO_EXISTS
        }

        delete sequences[id]
        settings.set(SETTINGS.BUILDING_SEQUENCES, sequences, {
            quiet: true
        })
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED, id)
    }

    builderQueue.init = function () {
        var buildingName
        var village

        initialized = true
        logs = Lockr.get(STORAGE_KEYS.LOGS, [], true)
        $player = modelDataService.getSelectedCharacter()
        groupList = modelDataService.getGroupList()
        
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates, opt) {
            if (updates[UPDATES.ANALYSE]) {
                analyseVillages()
            }

            if (!opt.quiet) {
                eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_SETTINGS_CHANGE)
            }
        })

        for (buildingName in BUILDING_TYPES) {
            VILLAGE_BUILDINGS[BUILDING_TYPES[buildingName]] = 0
        }

        sequencesAvail = Object.keys(settings.get(SETTINGS.BUILDING_SEQUENCES)).length
        buildingSequenceLimit = sequencesAvail ? getSequenceLimit(settings.get(SETTINGS.ACTIVE_SEQUENCE)) : false

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

    return builderQueue
})
