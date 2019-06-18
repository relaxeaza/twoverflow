define('two/farmOverflow', [
    'two/Settings',
    'two/farmOverflow/errorTypes',
    'two/farmOverflow/settings',
    'two/farmOverflow/settingsMap',
    'two/farmOverflow/settingsUpdate',
    'two/farmOverflow/logTypes',
    'two/farmOverflow/eventStates',
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
    EVENT_STATES,
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
    var ignoredVillages = []
    var onlyVillages = []
    var selectedPresets = []
    
    var noop = function () {}

    var STORAGE_KEYS = {
        INDEXES: 'farm_overflow_indexes',
        LOGS: 'farm_overflow_logs',
        LAST_ATTACK: 'farm_overflow_last_attack',
        LAST_ACTIVITY: 'farm_overflow_last_activity',
        SETTINGS: 'farm_overflow_settings'
    }

    var villageFilters = {
        ownPlayer: function (target) {
            return target.character_id === $player.getId()
        },
        included: function (target) {
            return target.character_id && !includedVillages.includes(target.id)
        },
        ignored: function (target) {
            return ignoredVillages.includes(target.id)
        },
        distance: function (target, village) {
            var distance = math.actualDistance(village, target)
            var minDistance = settings.getSetting(SETTINGS.MIN_DISTANCE)
            var maxDistance = settings.getSetting(SETTINGS.MAX_DISTANCE)

            return distance < minDistance || distance > maxDistance
        }
    }

    var targetFilters = [
        villageFilters.ownPlayer,
        villageFilters.included,
        villageFilters.ignored,
        villageFilters.distance
    ]

    var filterTargets = function (targets, village) {
        return targets.filter(function (target) {
            return targetFilters.every(function (fn) {
                return !fn(target, village)
            })
        })
    }

    var updateIncludedVillage = function () {
        var groupsInclude = settings.getSetting(SETTINGS.GROUP_INCLUDE)
        var groupVillages

        includedVillages = []

        groupsInclude.forEach(function (groupId) {
            groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)
            includedVillages = includedVillages.concat(groupVillages)
        })
    }

    var updateIgnoredVillage = function () {
        var groupIgnored = settings.getSetting(SETTINGS.GROUP_IGNORE)
        ignoredVillages = modelDataService.getGroupList().getGroupVillageIds(groupIgnored)
    }

    var updateOnlyVillage = function () {
        var groupsOnly = settings.getSetting(SETTINGS.GROUP_ONLY)
        var groupVillages

        onlyVillages = []

        groupsOnly.forEach(function (groupId) {
            groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)
            groupVillages = groupVillages.filter(function (villageId) {
                return !!$player.getVillage(villageId)
            })

            onlyVillages = onlyVillages.concat(groupVillages)
        })
    }

    var updateGroupVillages = function () {
        updateIncludedVillage()
        updateIgnoredVillage()
        updateOnlyVillage()
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

    var villageGroupLink = function (event, data) {
        var groupsInclude = settings.getSetting(SETTINGS.GROUP_INCLUDE)
        var groupIgnore = settings.getSetting(SETTINGS.GROUP_IGNORE)
        var groupsOnly = settings.getSetting(SETTINGS.GROUP_ONLY)
        var isOwnVillage = $player.getVillage(data.village_id)
        var farmer

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                farmer = farmers[data.village_id]

                if (farmer) {
                    farmer.destroy()
                }
            } else {
                angular.forEach(farmers, function (farmer) {
                    farmer.removeTarget(data.village_id)
                })
            }
        }

        if (groupsInclude.includes(data.group_id) && !isOwnVillage) {
            farmers.forEach(function (farmer) {
                farmer.loadedTargets()
            })
        }

        if (groupsOnly.includes(data.group_id) && isOwnVillage) {
            farmer = farmOverflow.create(data.village_id)
            farmer.init(function () {
                if (running) {
                    farmer.start()
                }
            })
        }
    }

    var presetListener = function () {
        updatePresets()

        if (running && !selectedPresets.length) {
            farmOverflow.stop()
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, EVENT_STATES.STOP_NO_PRESETS)
        }
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

        this.loadTargets = function (_callback) {
            var villagePosition = village.getPosition()

            mapData.load(village.getX(), village.getY(), function (loadedTargets) {
                targets = filterTargets(loadedTargets, villagePosition)

                if (typeof _callback === 'function') {
                    _callback(targets)
                }
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

        this.destroy = function () {
            this.stop()
            delete farmers[villageId]
        }

        this.removeTarget = function (targetId) {
            if (typeof targetId !== 'number') {
                return false
            }

            targets = targets.filter(function (target) {
                return target.id !== targetId
            })

            return true
        }

        if (_options.autoStart) {
            this.init(() => {
                this.start()
            })
        }

        return this
    }

    var farmOverflow = {}

    farmOverflow.start = function () {
        if (running) {
            return false
        }

        angular.forEach($player.getVillages(), function (village, villageId) {
            var farmer

            villageId = parseInt(villageId, 10)

            if (ignoredVillages.includes(villageId)) {
                return
            }

            farmer = farmOverflow.create(villageId)

            if (!farmer) {
                return
            }

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
        var groupsOnly = settings.getSetting(SETTINGS.GROUP_ONLY)

        if (groupsOnly.length && !onlyVillages.includes(villageId)) {
            return false
        }

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

        updateGroupVillages()
        updatePresets()

        $rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, presetListener)
        $rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, presetListener)
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_LINKED, villageGroupLink)
    }

    return farmOverflow
})
