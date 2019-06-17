define('two/farmOverflow', [
    'two/Settings',
    'two/farmOverflow/errorTypes',
    'two/farmOverflow/settings',
    'two/farmOverflow/settingsMap',
    'two/farmOverflow/settingsUpdate',
    'two/farmOverflow/logTypes',
    'two/mapData',
    'helper/math',
    'queues/EventQueue'
], function (
    Settings,
    ERROR_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    SETTINGS_UPDATE,
    LOG_TYPES,
    mapData,
    math,
    eventQueue
) {
    var $player = modelDataService.getSelectedCharacter()
    var initialized = false
    var running = false
    var settings
    var farmers = window.farmers = {}
    var includedVillages = []
    var noop = function () {}
    var selectedPresets = []

    var STORAGE_KEYS = {
        INDEXES: 'farm_overflow_indexes',
        LOGS: 'farm_overflow_logs',
        LAST_ATTACK: 'farm_overflow_last_attack',
        LAST_ACTIVITY: 'farm_overflow_last_activity',
        SETTINGS: 'farm_overflow_settings'
    }

    var updateIncludedVillage = function () {
        var groupsInclude = settings.getSetting(SETTINGS.GROUP_INCLUDE)
        var groups

        includedVillages = []

        if (!groupsInclude.length) {
            return
        }

        groupsInclude.forEach(function (groupId) {
            groups = groupList.getGroupVillageIds(groupId)
            includedVillages = includedVillages.concat(groups)
        })
    }

    var updateIgnoredVillage = function () {
        var groupsIgnored = settings.getSetting(SETTINGS.GROUP_IGNORE)
        var groups

        ignoredVillages = []

        if (!groupsIgnored.length) {
            return
        }

        groupsIgnored.forEach(function (groupId) {
            groups = groupList.getGroupVillageIds(groupId)
            ignoredVillages = ignoredVillages.concat(groups)
        })
    }

    var updatePresets = function () {
        var handler = function () {
            selectedPresets = []

            var playerPresets = modelDataService.getPresetList().getPresets()
            var activePresets = settings.getSetting(SETTINGS.PRESETS)

            activePresets.forEach(function (presetId) {
                selectedPresets.push(playerPresets[presetId])
            })
        }

        if (modelDataService.getPresetList().isLoaded()) {
            handler()
        } else {
            socketService.emit(routeProvider.GET_PRESETS, {}, handler)
        }
    }

    var presetListener = function () {
        updatePresets()

        if (running && !selectedPresets.length) {
            farmOverflow.stop()
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, ERROR_TYPES.NO_PRESETS)
        }
    }

    var Farmer = (function () {
        // return true = village filtered
        var targetFilters = [
            function ownPlayer (target) {
                return target.character_id === $player.getId()
            },
            function included (target) {
                return target.character_id && !includedVillages.includes(target.id)
            },
            function ignored (target) {
                return ignoredVillages.includes(target.id)
            },
            function distance (target, village) {
                var distance = math.actualDistance(village.getPosition(), {
                    x: target.x,
                    y: target.y
                })
                var minDistance = settings.getSetting(SETTINGS.MIN_DISTANCE)
                var maxDistance = settings.getSetting(SETTINGS.MAX_DISTANCE)

                return distance < minDistance || distance > maxDistance
            }
        ]

        var filterTargets = function (targets, village) {
            return targets.filter(function (target) {
                return targetFilters.every(function (fn) {
                    return !fn(target, village)
                })
            })
        }

        var Farmer = function (villageId, _options) {
            var village = $player.getVillage(villageId)
            var index = 0
            var running = false
            var initialized = false
            var ready = false
            var targets = []

            _options = _options || {}

            if (!village) {
                throw new Error(`Village ${villageId} does not exist`)
            }

            this.init = function (callback) {
                callback = callback || noop

                if (initialized) {
                    throw new Error(`Farmer ${villageId} already initialized`)
                }

                initialized = true

                this.loadTargets(function () {
                    ready = true
                    eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_READY, villageId)
                    callback()
                })
            }

            this.start = function () {
                if (!ready) {
                    eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NOT_READY, villageId)
                    return false
                }

                if (!targets.length) {
                    eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NO_TARGETS, villageId)
                    return false
                }

                running = true

                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_START, villageId)



                return true
            }

            this.stop = function () {
                running = false

                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STOP, villageId)
            }

            this.loadTargets = function (callback) {
                mapData.load(village.getX(), village.getY(), function (loadedTargets) {
                    targets = filterTargets(loadedTargets, village)
                    callback(targets)
                })
            }

            this.getTargets = function () {
                return targets
            }

            this.isRunning = function () {
                return running
            }

            this.isInitialized = function () {
                return initialized
            }

            if (_options.autoStart) {
                this.init(() => {
                    this.start()
                })
            }

            return this
        }

        return Farmer
    })()

    var farmOverflow = {}

    farmOverflow.start = function () {
        if (running) {
            return false
        }

        var villages = $player.getVillages()

        angular.forEach(villages, function (village, villageId) {
            var farmer = farmOverflow.create(villageId)

            if (farmer.isInitialized()) {
                farmer.start()
            } else {
                farmer.init(function () {
                    farmer.start()
                })
            }
        })

        running = true

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_START)
    }

    farmOverflow.create = function (villageId) {
        if (!farmers.hasOwnProperty(villageId)) {
            farmers[villageId] = new Farmer(villageId)
        }

        return farmers[villageId]
    }

    farmOverflow.stop = function (_reason) {
        running = false

        angular.each(farmers, function (farmer) {
            if(farmer.isRunning()) {
                farmer.stop()
            }
        })

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, _reason)
    }

    farmOverflow.getSettings = function () {
        return settings
    }

    farmOverflow.isInitialized = function () {
        return initialized
    }

    farmOverflow.init = function () {
        initialized = true
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        updateIncludedVillage()
        updateIgnoredVillage()
        updatePresets()

        $rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, presetListener)
        $rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, presetListener)
    }

    return farmOverflow
})
