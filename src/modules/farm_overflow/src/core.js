define('two/farmOverflow', [
    'two/Settings',
    'two/farmOverflow/errorTypes',
    'two/farmOverflow/settings',
    'two/farmOverflow/settingsMap',
    'two/farmOverflow/settingsUpdate',
    'two/farmOverflow/logTypes',
    'two/farmOverflow/stopReason',
    'two/mapData',
    'two/utils',
    'helper/math',
    'queues/EventQueue',
    'conf/commandTypes'
], function (
    Settings,
    ERROR_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    SETTINGS_UPDATE,
    LOG_TYPES,
    STOP_REASON,
    mapData,
    utils,
    math,
    eventQueue,
    COMMAND_TYPES
) {
    var $player = modelDataService.getSelectedCharacter()
    var initialized = false
    var running = false
    var settings
    var farmers = window.farmers = []
    var includedVillages = []
    var ignoredVillages = []
    var onlyVillages = []
    var selectedPresets = []
    var activeFarmer = false
    var sendingCommand = false
    var currentTarget = false
    var farmerIndex = 0
    var farmerCycle = []
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

    var reloadTargets = function () {
        farmers.forEach(function (farmer) {
            farmer.loadTargets()
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

    var villageGroupLink = function (event, data) {
        var groupsInclude = settings.getSetting(SETTINGS.GROUP_INCLUDE)
        var groupIgnore = settings.getSetting(SETTINGS.GROUP_IGNORE)
        var groupsOnly = settings.getSetting(SETTINGS.GROUP_ONLY)
        var isOwnVillage = $player.getVillage(data.village_id)
        var farmer

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                farmOverflow.destroyFarmerById(data.village_id)
            } else {
                farmers.forEach(function (farmer) {
                    farmer.removeTarget(data.village_id)
                })
            }
        }

        if (groupsInclude.includes(data.group_id) && !isOwnVillage) {
            reloadTargets()
        }

        if (groupsOnly.includes(data.group_id) && isOwnVillage) {
            farmer = farmOverflow.create(data.village_id)
            farmer.init().then(function () {
                if (running) {
                    farmer.start()
                }
            })
        }
    }

    var villageGroupUnlink = function (event, data) {
        var groupsInclude = settings.getSetting(SETTINGS.GROUP_INCLUDE)
        var groupIgnore = settings.getSetting(SETTINGS.GROUP_IGNORE)
        var groupsOnly = settings.getSetting(SETTINGS.GROUP_ONLY)
        var isOwnVillage = $player.getVillage(data.village_id)
        var farmer

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                farmer = farmOverflow.create(data.village_id)
                farmer.init().then(function () {
                    if (running) {
                        farmer.start()
                    }
                })
            } else {
                reloadTargets()
            }
        }

        if (groupsInclude.includes(data.group_id) && !isOwnVillage) {
            reloadTargets()
        }

        if (groupsOnly.includes(data.group_id) && isOwnVillage) {
            farmOverflow.destroyFarmerById(data.village_id)
        }
    }

    var removedGroupListener = function () {
        updateGroupVillages()

        farmOverflow.flush()
        reloadTargets()
        farmOverflow.createAll()
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
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
                reason: STOP_REASON.NO_PRESETS
            })
        }
    }

    var commandSentListener = function (event, data) {
        if (!activeFarmer || !currentTarget) {
            return
        }

        console.log('commandSentListener', data)

        if (data.origin.id !== activeFarmer.getVillage().getId()) {
            return
        }

        if (data.target.id !== currentTarget.id) {
            return
        }

        if (data.direction === 'forward' && data.type === COMMAND_TYPES.TYPES.ATTACK) {
            activeFarmer.commandSent(data)
        }
    }

    var commandErrorListener = function (event, data) {
        if (!activeFarmer || !sendingCommand || !currentTarget) {
            return
        }

        console.log('commandErrorListener', data)

        if (data.cause === routeProvider.SEND_PRESET.type) {
            activeFarmer.commandError(data)
        }
    }

    var assignPresets = function (villageId, presetIds, callback) {
        socketService.emit(routeProvider.ASSIGN_PRESETS, {
            village_id: villageId,
            preset_ids: presetIds
        }, callback)
    }

    var checkPresetTime = function (preset, village, target) {
        var limitTime = settings.getSetting(SETTINGS.MAX_TRAVEL_TIME) * 60
        var position = village.getPosition()
        var distance = math.actualDistance(position, target)
        var travelTime = armyService.calculateTravelTime(preset, {
            barbarian: !target.id,
            officers: false
        })
        var totalTravelTime = armyService.getTravelTimeForDistance(preset, travelTime, distance, COMMAND_TYPES.TYPES.ATTACK)

        return limitTime > totalTravelTime
    }

    var Farmer = function (villageId, _options) {
        var self = this
        var village = $player.getVillage(villageId)
        var index = 0
        var running = false
        var initialized = false
        var ready = false
        var targets = []
        var timeoutId
        var cycleEndHandler = noop

        _options = _options || {}

        if (!village) {
            throw new Error(`new Farmer -> Village ${villageId} doesn't exist.`)
        }

        self.init = function () {
            return new Promise(function (resolve) {
                if (self.isReady()) {
                    return resolve()
                }

                initialized = true

                self.loadTargets(function () {
                    ready = true
                    eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_READY, {
                        villageId: villageId
                    })
                    resolve()
                })
            })
        }

        self.start = function () {
            console.log('farmer.start()', 'ready', ready)

            var interval
            var target

            if (!ready) {
                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NOT_READY, {
                    villageId: villageId
                })
                return false
            }

            if (!targets.length) {
                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NO_TARGETS, {
                    villageId: villageId
                })
                return false
            }

            running = true
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_START, {
                villageId: villageId
            })

            targetStep({
                delay: false
            })

            return true
        }

        self.stop = function (reason, data) {
            console.log('farmer.stop()')

            running = false
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STOP, {
                villageId: villageId,
                reason: reason,
                data: data
            })
            clearTimeout(timeoutId)
            cycleEndHandler(reason)
            cycleEndHandler = noop
        }

        self.commandSent = function (data) {
            sendingCommand = false
            currentTarget = false

            targetStep({
                delay: true
            })
        }

        self.commandError = function (data) {
            sendingCommand = false
            currentTarget = false

            self.stop(STOP_REASON.ERROR, data)
        }

        self.onceCycleEnd = function (handler) {
            cycleEndHandler = handler
        }

        self.loadTargets = function (_callback) {
            var villagePosition = village.getPosition()

            mapData.load(village.getX(), village.getY(), function (loadedTargets) {
                targets = filterTargets(loadedTargets, villagePosition)

                if (typeof _callback === 'function') {
                    _callback(targets)
                }
            })
        }

        self.getTargets = function () {
            return targets
        }

        self.getVillage = function () {
            return village
        }

        self.isRunning = function () {
            return running
        }

        self.isReady = function () {
            return initialized && ready
        }

        self.removeTarget = function (targetId) {
            if (typeof targetId !== 'number') {
                return false
            }

            targets = targets.filter(function (target) {
                return target.id !== targetId
            })

            return true
        }

        // private functions

        var genPresetList = function () {
            var villagePresets = modelDataService.getPresetList().getPresetsByVillageId(village.getId())
            var needAssign = false
            var which = []
            var id

            selectedPresets.forEach(function (preset) {
                if (!villagePresets.hasOwnProperty(preset.id)) {
                    needAssign = true
                    which.push(preset.id)
                }
            })

            if (needAssign) {
                for (id in villagePresets) {
                    which.push(id)
                }

                return which
            }

            return false
        }

        var targetStep = function (_delay) {
            console.log('farmer.targetStep()')

            var preset
            var delayTime = 0
            var target
            var neededPresets
            var checkTargets
            var checkVillagePresets
            var checkPreset
            var checkTarget
            var checkCommands
            var prepareAttack
            var onError

            checkTargets = function() {
                return new Promise(function(resolve) {
                    if (!targets.length) {
                        return onError(ERROR_TYPES.NO_TARGETS)
                    }

                    if (index > targets.length || !targets[index]) {
                        return onError(ERROR_TYPES.TARGET_CYCLE_END)
                    }

                    resolve()
                })
            }

            checkVillagePresets = function() {
                return new Promise(function (resolve) {
                    neededPresets = genPresetList()

                    if (neededPresets) {
                        assignPresets(village.getId(), neededPresets, resolve)
                    } else {
                        resolve()
                    }
                })
            }

            checkPreset = function() {
                return new Promise(function(resolve) {
                    target = getTarget()
                    preset = getPreset(target)

                    if (typeof preset === 'string') {
                        return onError(preset)
                    }

                    resolve()
                })
            }

            checkTarget = function() {
                return new Promise(function(resolve) {
                    socketService.emit(routeProvider.GET_ATTACKING_FACTOR, {
                        target_id: target.id
                    }, function(data) {
                        console.log('GET_ATTACKING_FACTOR', data)

                        // abandoned village conquered by some noob.
                        if (target.character_id === null && data.owner_id !== null && !includedVillages.includes(target.id)) {
                            onError(ERROR_TYPES.ABANDONED_CONQUERED)
                        } else if (target.attack_protection) {
                            onError(ERROR_TYPES.PROTECTED_VILLAGE)
                        } else {
                            resolve()
                        }
                    })
                })
            }

            checkCommands = function() {
                return new Promise(function(resolve) {
                    if (!settings.getSetting(SETTINGS.TARGET_SINGLE_ATTACK)) {
                        return resolve()
                    }

                    socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
                        my_village_id: villageId,
                        village_id: target.id,
                        num_reports: 0
                    }, function(data) {
                        var busy = data.commands.own.some(function(command) {
                            if (command.type === COMMAND_TYPES.TYPES.ATTACK && command.direction === 'forward') {
                                return true
                            }
                        })

                        if (busy) {
                            onError(ERROR_TYPES.SINGLE_COMMAND_FILLED)
                        } else {
                            resolve()
                        }
                    })
                })
            }

            prepareAttack = function() {
                if (_delay) {
                    delayTime = utils.randomSeconds(settings.getSetting(SETTINGS.RANDOM_BASE))
                    delayTime = 100 + (delayTime * 1000)
                }

                timeoutId = setTimeout(function() {
                    attackTarget(target, preset)
                }, delayTime)
            }

            onError = function(error) {
                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STEP_ERROR, {
                    villageId: villageId,
                    error: error
                })

                switch (error) {
                case ERROR_TYPES.TIME_LIMIT:
                case ERROR_TYPES.SINGLE_COMMAND_FILLED:
                    targetStep(_delay)

                    break
                case ERROR_TYPES.NO_UNITS:
                case ERROR_TYPES.NO_TARGETS:
                case ERROR_TYPES.TARGET_CYCLE_END:
                    self.stop(error)

                    break
                }
            }

            checkTargets()
                .then(checkVillagePresets)
                .then(checkPreset)
                .then(checkTarget)
                .then(checkCommands)
                .then(prepareAttack)
        }

        var attackTarget = function (target, preset) {
            console.log('attackTarget()', running)

            if (!running) {
                return false
            }

            sendingCommand = true
            currentTarget = target

            socketService.emit(routeProvider.SEND_PRESET, {
                start_village: village.getId(),
                target_village: target.id,
                army_preset_id: preset.id,
                type: COMMAND_TYPES.TYPES.ATTACK
            })

            console.log('emit routeProvider.SEND_PRESET')
        }

        var getTarget = function () {
            return targets[index++]
        }

        var getPreset = function (target) {
            var timeLimit = false
            var units = village.getUnitInfo().getUnits()
            var selectedPreset = false
            var avail
            var unit
            var i
            var preset

            for (i = 0; i < selectedPresets.length; i++) {
                preset = selectedPresets[i]
                avail = true

                for (unit in preset.units) {
                    if (!preset.units[unit]) {
                        continue
                    }

                    if (units[unit].in_town < preset.units[unit]) {
                        avail = false
                    }
                }

                if (avail) {
                    if (checkPresetTime(preset, village, target)) {
                        return preset
                    } else {
                        return ERROR_TYPES.TIME_LIMIT
                    }
                }
            }

            return ERROR_TYPES.NO_UNITS
        }
    }

    var farmOverflow = {}

    farmOverflow.init = function () {
        initialized = true
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        updateGroupVillages()
        updatePresets()
        farmOverflow.createAll()

        $rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, presetListener)
        $rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, presetListener)
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_LINKED, villageGroupLink)
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_UNLINKED, villageGroupUnlink)
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, removedGroupListener)
        $rootScope.$on(eventTypeProvider.COMMAND_SENT, commandSentListener)
        $rootScope.$on(eventTypeProvider.MESSAGE_ERROR, commandErrorListener)

        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_STOP, function () { console.log('FARM_OVERFLOW_STOP') })
        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_INSTANCE_READY, function () { console.log('FARM_OVERFLOW_INSTANCE_READY') })
        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NOT_READY, function () { console.log('FARM_OVERFLOW_INSTANCE_ERROR_NOT_READY') })
        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NO_TARGETS, function () { console.log('FARM_OVERFLOW_INSTANCE_ERROR_NO_TARGETS') })
        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_INSTANCE_START, function () { console.log('FARM_OVERFLOW_INSTANCE_START') })
        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STOP, function (event, data) { console.log('FARM_OVERFLOW_INSTANCE_STOP', data.reason) })
        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_START, function () { console.log('FARM_OVERFLOW_START') })
        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STEP_ERROR, function (event, data) { console.log('FARM_OVERFLOW_INSTANCE_STEP_ERROR', data.error) })
    }

    farmOverflow.start = function () {
        var readyFarmers

        if (running) {
            return false
        }

        running = true
        readyFarmers = []

        farmers.forEach(function (farmer) {
            readyFarmers.push(new Promise(function (resolve) {
                farmer.init().then(resolve)
            }))
        })

        if (!readyFarmers.length) {
            return false
        }

        Promise.all(readyFarmers).then(function () {
            farmOverflow.farmerStep()
        })

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_START)
    }

    farmOverflow.stop = function (reason) {
        console.log('farmOverflow.stop()', reason)

        running = false
        reason = reason || STOP_REASON.USER

        if (activeFarmer) {
            activeFarmer.stop(reason)
        }

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
            reason: reason
        })
    }

    farmOverflow.createAll = function () {
        angular.forEach($player.getVillages(), function (village, villageId) {
            farmOverflow.create(villageId)
        })
    }

    farmOverflow.create = function (villageId) {
        var groupsOnly = settings.getSetting(SETTINGS.GROUP_ONLY)

        villageId = parseInt(villageId, 10)

        if (groupsOnly.length && !onlyVillages.includes(villageId)) {
            return false
        }

        if (ignoredVillages.includes(villageId)) {
            return false
        }

        if (!farmOverflow.getFarmerById(villageId)) {
            farmers.push(new Farmer(villageId))
        }

        return farmOverflow.getFarmerById(villageId)
    }

    farmOverflow.flush = function () {
        var groupsOnly = settings.getSetting(SETTINGS.GROUP_ONLY)
        var villageId

        farmers.forEach(function (farmer) {
            villageId = farmer.getVillage().getId()

            if (groupsOnly.length && !onlyVillages.includes(villageId)) {
                farmOverflow.destroyFarmerById(villageId)
            }

            if (ignoredVillages.includes(villageId)) {
                farmOverflow.destroyFarmerById(villageId)
            }
        })
    }

    farmOverflow.getFarmerById = function (farmerId) {
        var i

        for (i = 0; i < farmers.length; i++) {
            if (farmers[i].getVillage().getId() === farmerId) {
                return farmers[i]
            }
        }

        return false
    }

    farmOverflow.destroyFarmerById = function () {
        var i

        for (i = 0; i < farmers.length; i++) {
            if (farmers[i].getVillage().getId() === farmerId) {
                farmers[i].stop()
                farmers.splice(i, i + 1)

                return true
            }
        }

        return false
    }

    farmOverflow.getFarmer = function () {
        if (!farmers.length) {
            return false
        }

        if (farmerIndex >= farmers.length) {
            farmerIndex = 0
            return false
        }

        return farmers[farmerIndex++]
    }

    farmOverflow.farmerStep = function () {
        activeFarmer = farmOverflow.getFarmer()

        if (!activeFarmer) {
            return farmOverflow.stop(STOP_REASON.FARMER_CYCLE_END)
        }

        activeFarmer.onceCycleEnd(function () {
            farmOverflow.farmerStep()
        })

        activeFarmer.start()
    }

    farmOverflow.getSettings = function () {
        return settings
    }

    farmOverflow.isInitialized = function () {
        return initialized
    }

    return farmOverflow
})
