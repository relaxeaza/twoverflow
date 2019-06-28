define('two/farmOverflow', [
    'two/Settings',
    'two/farmOverflow/errorTypes',
    'two/farmOverflow/settings',
    'two/farmOverflow/settingsMap',
    'two/farmOverflow/settingsUpdate',
    'two/farmOverflow/logTypes',
    'two/mapData',
    'two/utils',
    'helper/math',
    'helper/time',
    'queues/EventQueue',
    'conf/commandTypes',
    'conf/village',
    'struct/MapData',
    'Lockr'
], function (
    Settings,
    ERROR_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    SETTINGS_UPDATE,
    LOG_TYPES,
    mapData,
    utils,
    math,
    timeHelper,
    eventQueue,
    COMMAND_TYPES,
    VILLAGE_CONFIG,
    $mapData,
    Lockr
) {
    /* debug vars */
    var onlyOneFarmerCycle = false
    // var onlyOneTarget = { character_id: null, distance: 1.7, id: 11161, tribe_id: null, x: 557, y: 576 }
    var onlyOneTarget = false
    /* /debug vars */

    var initialized = false
    var running = false
    var settings
    var farmers = []
    var logs = []
    var includedVillages = []
    var ignoredVillages = []
    var onlyVillages = []
    var selectedPresets = []
    var activeFarmer = false
    var sendingCommand = false
    var currentTarget = false
    var farmerIndex = 0
    var farmerCycle = []
    var farmerTimeoutId

    var $player = modelDataService.getSelectedCharacter()
    var unitsData = modelDataService.getGameData().getUnitsObject()
    var VILLAGE_COMMAND_LIMIT = 50
    var MINIMUM_FARMER_CYCLE_INTERVAL = 5 * 1000
    var MINIMUM_ATTACK_INTERVAL = 1 * 1000

    var STORAGE_KEYS = {
        LOGS: 'farm_overflow_logs',
        SETTINGS: 'farm_overflow_settings'
    }

    var villageFilters = {
        distance: function (target) {
            return !target.distance.between(
                settings.get(SETTINGS.MIN_DISTANCE),
                settings.get(SETTINGS.MAX_DISTANCE)
            )
        },
        ownPlayer: function (target) {
            return target.character_id === $player.getId()
        },
        included: function (target) {
            return target.character_id && !includedVillages.includes(target.id)
        },
        ignored: function (target) {
            return ignoredVillages.includes(target.id)
        },
        points: function (points) {
            return !points.between(
                settings.get(SETTINGS.MIN_POINTS),
                settings.get(SETTINGS.MAX_POINTS)
            )
        }
    }

    var targetFilters = [
        villageFilters.distance,
        villageFilters.ownPlayer,
        villageFilters.included,
        villageFilters.ignored
    ]

    var calcDistances = function (targets, origin) {
        return targets.map(function (target) {
            target.distance = math.actualDistance(origin, target)
            return target
        })
    }

    var filterTargets = function (targets) {
        return targets.filter(function (target) {
            return targetFilters.every(function (fn) {
                return !fn(target)
            })
        })
    }

    var sortTargets = function (targets) {
        return targets.sort(function (a, b) {
            return a.distance - b.distance
        })
    }

    var reloadTargets = function () {
        farmers.forEach(function (farmer) {
            farmer.loadTargets()
        })
    }

    var updateIncludedVillage = function () {
        var groupsInclude = settings.get(SETTINGS.GROUP_INCLUDE)
        var groupVillages

        includedVillages = []

        groupsInclude.forEach(function (groupId) {
            groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)
            includedVillages = includedVillages.concat(groupVillages)
        })
    }

    var updateIgnoredVillage = function () {
        var groupIgnored = settings.get(SETTINGS.GROUP_IGNORE)
        ignoredVillages = modelDataService.getGroupList().getGroupVillageIds(groupIgnored)
    }

    var updateOnlyVillage = function () {
        var groupsOnly = settings.get(SETTINGS.GROUP_ONLY)
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
        var groupsInclude = settings.get(SETTINGS.GROUP_INCLUDE)
        var groupIgnore = settings.get(SETTINGS.GROUP_IGNORE)
        var groupsOnly = settings.get(SETTINGS.GROUP_ONLY)
        var isOwnVillage = $player.getVillage(data.village_id)
        var farmer

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                farmOverflow.removeById(data.village_id)
            } else {
                farmOverflow.removeTarget(data.village_id)
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
        var groupsInclude = settings.get(SETTINGS.GROUP_INCLUDE)
        var groupIgnore = settings.get(SETTINGS.GROUP_IGNORE)
        var groupsOnly = settings.get(SETTINGS.GROUP_ONLY)
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
            farmOverflow.removeById(data.village_id)
        }
    }

    var removedGroupListener = function () {
        updateGroupVillages()

        farmOverflow.flush()
        reloadTargets()
        farmOverflow.createAll()
    }

    var updatePresets = function () {
        var playerPresets
        var activePresets

        function processPresets () {
            selectedPresets = []
            playerPresets = modelDataService.getPresetList().getPresets()
            activePresets = settings.get(SETTINGS.PRESETS)

            activePresets.forEach(function (presetId) {
                if (!playerPresets.hasOwnProperty(presetId)) {
                    return
                }

                preset = playerPresets[presetId]
                preset.load = getPresetHaul(preset)
                preset.travelTime = getPresetTimeTravel(preset, false)
                selectedPresets.push(preset)
            })

            selectedPresets = selectedPresets.sort(function (a, b) {
                return a.travelTime - b.travelTime || b.load - a.load
            })
        }

        if (modelDataService.getPresetList().isLoaded()) {
            processPresets()
        } else {
            socketService.emit(routeProvider.GET_PRESETS, {}, processPresets)
        }
    }

    var ignoreVillage = function (villageId) {
        var groupIgnore = settings.get(SETTINGS.GROUP_IGNORE)

        if (!groupIgnore) {
            return false
        }

        socketService.emit(routeProvider.GROUPS_LINK_VILLAGE, {
            group_id: groupIgnore,
            village_id: villageId
        }, function () {
            addLog(LOG_TYPES.IGNORED_VILLAGE, {
                villageId: villageId
            })

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_VILLAGE_IGNORED, villageId)
        })

        return true
    }

    var presetListener = function () {
        updatePresets()

        if (!selectedPresets.length) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
                reason: ERROR_TYPES.NO_PRESETS
            })

            if (running) {
                farmOverflow.stop()
            }
        }
    }

    var reportListener = function (event, data) {
        if (!settings.get(SETTINGS.IGNORE_ON_LOSS) || !settings.get(SETTINGS.GROUP_IGNORE)) {
            return
        }

        if (!running || data.type !== COMMAND_TYPES.TYPES.ATTACK) {
            return
        }

        // 1 = nocasualties
        // 2 = casualties
        // 3 = defeat
        if (data.result !== 1 && farmOverflow.isTarget(data.target_village_id)) {
            ignoreVillage(data.target_village_id)
        }
    }

    var commandSentListener = function (event, data) {
        if (!activeFarmer || !currentTarget) {
            return
        }

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

    var getPresetHaul = function (preset) {
        var haul = 0

        angular.forEach(preset.units, function (unitAmount, unitName) {
            if (unitAmount) {
                haul += unitsData[unitName].load * unitAmount
            }
        })

        return haul
    }

    var getPresetTimeTravel = function (preset, barbarian) {
        return armyService.calculateTravelTime(preset, {
            barbarian: barbarian,
            officers: false
        })
    }

    var checkPresetTime = function (preset, village, target) {
        var limitTime = settings.get(SETTINGS.MAX_TRAVEL_TIME) * 60
        var position = village.getPosition()
        var distance = math.actualDistance(position, target)
        var travelTime = getPresetTimeTravel(preset, !target.character_id)
        var totalTravelTime = armyService.getTravelTimeForDistance(preset, travelTime, distance, COMMAND_TYPES.TYPES.ATTACK)

        return limitTime > totalTravelTime
    }

    var checkFullStorage = function(village) {
        if (!village.isReady()) {
            return false
        }

        var resources = village.getResources()
        var computed = resources.getComputed()
        var maxStorage = resources.getMaxStorage()

        return ['wood', 'clay', 'iron'].every(function (type) {
            return computed[type].currentStock === maxStorage
        })
    }

    var addLog = function(type, _data) {
        if (typeof type !== 'string') {
            return false
        }

        var data = angular.isObject(_data) ? _data : {}

        data.time = timeHelper.gameTime()
        data.type = type

        logs.unshift(data)
        trimAndSaveLogs()

        return true
    }

    var trimAndSaveLogs = function () {
        var limit = settings.get(SETTINGS.LOGS_LIMIT)

        if (logs.length > limit) {
            logs.splice(logs.length - limit, logs.length)
        }

        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED)
    }

    var Farmer = function (villageId) {
        var self = this
        var village = $player.getVillage(villageId)
        var index = 0
        var running = false
        var initialized = false
        var ready = false
        var targets = []
        var cycleEndHandler = noop
        var loadPromises
        var targetTimeoutId

        if (!village) {
            throw new Error(`new Farmer -> Village ${villageId} doesn't exist.`)
        }

        self.init = function () {
            loadPromises = []
            initialized = true

            if (!self.isReady()) {
                loadPromises.push(new Promise(function(resolve) {
                    if (self.isReady()) {
                        return resolve()
                    }

                    villageService.ensureVillageDataLoaded(village.getId(), resolve)
                }))

                loadPromises.push(new Promise(function (resolve) {
                    if (self.isReady()) {
                        return resolve()
                    }

                    self.loadTargets(function () {
                        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_READY, {
                            villageId: villageId
                        })
                        resolve()
                    })
                }))
            }

            return Promise.all(loadPromises).then(function() {
                ready = true
            })
        }

        self.start = function () {
            console.group('start()', village.getName())

            var interval
            var target

            if (running) {
                return false
            }

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

            activeFarmer = this
            running = true
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_START, {
                villageId: villageId
            })

            targetStep({
                delay: false
            })

            return true
        }

        self.stop = function (reason) {
            console.groupEnd('stop()')

            running = false
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STOP, {
                villageId: villageId,
                reason: reason
            })

            if (reason !== ERROR_TYPES.USER_STOP) {
                cycleEndHandler(reason)
            }

            clearTimeout(targetTimeoutId)
            cycleEndHandler = noop
        }

        self.commandSent = function (data) {
            console.log('targetStep: command_sent')

            sendingCommand = false
            currentTarget = false

            targetStep({
                delay: true
            })
        }

        self.commandError = function (data) {
            sendingCommand = false
            currentTarget = false

            self.stop(ERROR_TYPES.COMMAND_ERROR)
        }

        self.onceCycleEnd = function (handler) {
            cycleEndHandler = handler
        }

        self.loadTargets = function (_callback) {
            var pos = village.getPosition()

            if (onlyOneTarget) {
                targets = [onlyOneTarget]

                if (typeof _callback === 'function') {
                    _callback(targets)
                }

                return
            }

            mapData.load(pos, function (loadedTargets) {
                targets = calcDistances(loadedTargets, pos)
                targets = filterTargets(targets, pos)
                targets = sortTargets(targets)

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

        var isTargetBusy = function (attacking, otherAttacking, allVillagesLoaded) {
            var multipleFarmers = settings.get(SETTINGS.TARGET_MULTIPLE_FARMERS)
            var singleAttack = settings.get(SETTINGS.TARGET_SINGLE_ATTACK)

            if (multipleFarmers && allVillagesLoaded) {
                if (singleAttack && attacking) {
                    return true
                }
            } else if (singleAttack) {
                if (attacking || otherAttacking) {
                    return true
                }
            } else if (otherAttacking) {
                return true
            }

            return false
        }

        var targetStep = function (_options) {
            var options = _options || {}
            var preset
            var delayTime = 0
            var target
            var commandList = village.getCommandListModel()
            var villageCommands = commandList.getOutgoingCommands(true, true)
            var checkedLocalCommands = false

            function checkCommandLimit () {
                return new Promise(function (resolve, reject) {
                    var limit = VILLAGE_COMMAND_LIMIT - settings.get(SETTINGS.PRESERVE_COMMAND_SLOTS)

                    if (villageCommands.length >= limit) {
                        return reject(ERROR_TYPES.COMMAND_LIMIT)
                    }

                    resolve()
                })
            }

            function checkStorage () {
                return new Promise(function (resolve, reject) {
                    if (settings.get(SETTINGS.IGNORE_FULL_STORAGE) && checkFullStorage(village)) {
                        return reject(ERROR_TYPES.FULL_STORAGE)
                    }

                    resolve()
                })
            }

            function checkTargets () {
                return new Promise(function (resolve, reject) {
                    if (!targets.length) {
                        reject(ERROR_TYPES.NO_TARGETS)
                    } else if (index > targets.length || !targets[index]) {
                        reject(ERROR_TYPES.TARGET_CYCLE_END)
                    } else {
                        resolve()
                    }
                })
            }

            function checkVillagePresets () {
                return new Promise(function (resolve) {
                    var neededPresets = genPresetList()

                    if (neededPresets) {
                        assignPresets(village.getId(), neededPresets, resolve)
                    } else {
                        resolve()
                    }
                })
            }

            function checkPreset () {
                return new Promise(function (resolve, reject) {
                    target = getTarget()
                    preset = getPreset(target)

                    if (typeof preset === 'string') {
                        return reject(preset)
                    }

                    resolve()
                })
            }

            function checkTarget () {
                return new Promise(function (resolve, reject) {
                    socketService.emit(routeProvider.GET_ATTACKING_FACTOR, {
                        target_id: target.id
                    }, function(data) {
                        // abandoned village conquered by some noob.
                        if (target.character_id === null && data.owner_id !== null && !includedVillages.includes(target.id)) {
                            reject(ERROR_TYPES.ABANDONED_CONQUERED)
                        } else if (target.attack_protection) {
                            reject(ERROR_TYPES.PROTECTED_VILLAGE)
                        } else {
                            resolve()
                        }
                    })
                })
            }

            function checkLocalCommands () {
                return new Promise(function (resolve, reject) {
                    var multipleFarmers = settings.get(SETTINGS.TARGET_MULTIPLE_FARMERS)
                    var singleAttack = settings.get(SETTINGS.TARGET_SINGLE_ATTACK)
                    var playerVillages = $player.getVillageList()
                    var anotherVillageCommands
                    var otherAttacking = false
                    var attacking
                    var allVillagesLoaded = playerVillages.every(function (anotherVillage) {
                        return anotherVillage.isReady(VILLAGE_CONFIG.READY_STATES.OWN_COMMANDS)
                    })

                    if (allVillagesLoaded) {
                        otherAttacking = playerVillages.some(function (anotherVillage) {
                            if (anotherVillage.getId() === village.getId()) {
                                return false
                            }

                            anotherVillageCommands = anotherVillage.getCommandListModel().getOutgoingCommands(true, true)

                            return anotherVillageCommands.some(function (command) {
                                return command.targetVillageId === target.id && command.data.direction === 'forward'
                            })
                        })
                    }

                    attacking = villageCommands.some(function (command) {
                        return command.data.target.id === target.id && command.data.direction === 'forward'
                    })

                    if (isTargetBusy(attacking, otherAttacking, allVillagesLoaded)) {
                        return reject(ERROR_TYPES.BUSY_TARGET)
                    }

                    if (allVillagesLoaded) {
                        checkedLocalCommands = true
                    }

                    resolve()
                })
            }

            function checkTargetPoints () {
                return new Promise(function (resolve, reject) {
                    $mapData.getTownAtAsync(target.x, target.y, function (data) {
                        if (villageFilters.points(data.points)) {
                            return reject(ERROR_TYPES.NOT_ALLOWED_POINTS)
                        }

                        resolve()
                    })
                })
            }

            function checkLoadedCommands () {
                if (checkedLocalCommands) {
                    return true
                }

                return new Promise(function (resolve, reject) {
                    socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
                        my_village_id: villageId,
                        village_id: target.id,
                        num_reports: 0
                    }, function (data) {
                        var targetCommands = data.commands.own.filter(function (command) {
                            return command.type === COMMAND_TYPES.TYPES.ATTACK && command.direction === 'forward'
                        })
                        var multipleFarmers = settings.get(SETTINGS.TARGET_MULTIPLE_FARMERS)
                        var singleAttack = settings.get(SETTINGS.TARGET_SINGLE_ATTACK)
                        var otherAttacking = targetCommands.some(function (command) {
                            return command.start_village_id !== villageId
                        })
                        var attacking = targetCommands.some(function (command) {
                            return command.start_village_id === villageId
                        })

                        if (isTargetBusy(attacking, otherAttacking, true)) {
                            return reject(ERROR_TYPES.BUSY_TARGET)
                        }

                        resolve()
                    })
                })
            }

            function prepareAttack () {
                if (options.delay) {
                    delayTime = utils.randomSeconds(settings.get(SETTINGS.ATTACK_INTERVAL))
                    delayTime = MINIMUM_ATTACK_INTERVAL + (delayTime * 1000)
                }

                targetTimeoutId = setTimeout(function() {
                    attackTarget(target, preset)
                }, delayTime)
            }

            checkCommandLimit()
            .then(checkStorage)
            .then(checkTargets)
            .then(checkVillagePresets)
            .then(checkPreset)
            .then(checkTarget)
            .then(checkLocalCommands)
            .then(checkTargetPoints)
            .then(checkLoadedCommands)
            .then(prepareAttack)
            .catch(function (error) {
                console.log('targetStep:', error)

                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STEP_ERROR, {
                    villageId: villageId,
                    error: error
                })

                switch (error) {
                case ERROR_TYPES.TIME_LIMIT:
                case ERROR_TYPES.BUSY_TARGET:
                    targetStep(options)
                    break

                case ERROR_TYPES.NOT_ALLOWED_POINTS:
                    farmOverflow.removeTarget(target.id)
                    targetStep(options)
                    break

                case ERROR_TYPES.NO_UNITS:
                case ERROR_TYPES.NO_TARGETS:
                case ERROR_TYPES.FULL_STORAGE:
                case ERROR_TYPES.COMMAND_LIMIT:
                    self.stop(error)
                    break

                case ERROR_TYPES.TARGET_CYCLE_END:
                    self.stop(error)
                    index = 0
                    break

                default:
                    self.stop(ERROR_TYPES.UNKNOWN)
                    break
                }
            })
        }

        var attackTarget = function (target, preset) {
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
        logs = Lockr.get(STORAGE_KEYS.LOGS, [])
        
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, update) {
            var id
            var modify = {}

            for (id in changes) {
                SETTINGS_MAP[id].updates.forEach(function (modifier) {
                    modify[modifier] = true
                })
            }

            if (modify[SETTINGS_UPDATE.PRESET]) {
                updatePresets()
            }

            if (modify[SETTINGS_UPDATE.GROUPS]) {
                updateGroupVillages()
            }

            if (modify[SETTINGS_UPDATE.TARGETS]) {
                reloadTargets()
            }

            if (modify[SETTINGS_UPDATE.VILLAGES]) {
                farmOverflow.flush()
                farmOverflow.createAll()
            }

            if (modify[SETTINGS_UPDATE.LOGS]) {
                trimAndSaveLogs()
            }

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
        $rootScope.$on(eventTypeProvider.REPORT_NEW, reportListener)
    }

    farmOverflow.start = function () {
        var readyFarmers

        if (running) {
            return false
        }

        if (!selectedPresets.length) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
                reason: ERROR_TYPES.NO_PRESETS
            })

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
            running = false
            return false
        }

        Promise.all(readyFarmers).then(function () {
            farmOverflow.farmerStep()
        })

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_START)

        addLog(LOG_TYPES.FARM_START)
    }

    farmOverflow.stop = function (reason) {
        reason = reason || ERROR_TYPES.USER_STOP

        if (activeFarmer) {
            activeFarmer.stop(reason)
        }

        running = false

        clearTimeout(farmerTimeoutId)

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
            reason: reason
        })

        if (reason === ERROR_TYPES.USER_STOP) {
            addLog(LOG_TYPES.FARM_STOP)
        }
    }

    farmOverflow.createAll = function () {
        angular.forEach($player.getVillages(), function (village, villageId) {
            farmOverflow.create(villageId)
        })
    }

    farmOverflow.create = function (villageId) {
        var groupsOnly = settings.get(SETTINGS.GROUP_ONLY)

        villageId = parseInt(villageId, 10)

        if (groupsOnly.length && !onlyVillages.includes(villageId)) {
            return false
        }

        if (ignoredVillages.includes(villageId)) {
            return false
        }

        if (!farmOverflow.getById(villageId)) {
            farmers.push(new Farmer(villageId))
        }

        return farmOverflow.getById(villageId)
    }

    farmOverflow.flush = function () {
        var groupsOnly = settings.get(SETTINGS.GROUP_ONLY)
        var villageId

        farmers.forEach(function (farmer) {
            villageId = farmer.getVillage().getId()

            if (groupsOnly.length && !onlyVillages.includes(villageId)) {
                farmOverflow.removeById(villageId)
            }

            if (ignoredVillages.includes(villageId)) {
                farmOverflow.removeById(villageId)
            }
        })
    }

    farmOverflow.getById = function (farmerId) {
        var i

        for (i = 0; i < farmers.length; i++) {
            if (farmers[i].getVillage().getId() === farmerId) {
                return farmers[i]
            }
        }

        return false
    }

    farmOverflow.removeById = function (farmerId) {
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

    farmOverflow.getOne = function () {
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
        var interval

        activeFarmer = farmOverflow.getOne()

        if (!activeFarmer) {
            if (onlyOneFarmerCycle) {
                return
            }

            interval = settings.get(SETTINGS.FARMER_CYCLE_INTERVAL) * 60 * 1000
            interval += MINIMUM_FARMER_CYCLE_INTERVAL

            console.log('farmerStep: next in', timeHelper.readableMilliseconds(interval))

            farmerTimeoutId = setTimeout(function() {
                farmerIndex = 0
                farmOverflow.farmerStep()
            }, interval)

            return
        }

        activeFarmer.onceCycleEnd(farmOverflow.farmerStep)
        activeFarmer.start()
    }

    farmOverflow.isTarget = function (targetId) {
        var i
        var j
        var farmer
        var targets
        var target

        for (i = 0; i < farmers.length; i++) {
            farmer = farmers[i]
            targets = farmer.getTargets()

            for (j = 0; j < targets.length; j++) {
                target = targets[j]

                if (target.id === targetId) {
                    return true
                }
            }
        }

        return false
    }

    farmOverflow.removeTarget = function (targetId) {
        farmers.forEach(function (farmer) {
            farmer.removeTarget(targetId)
        })
    }

    farmOverflow.getSettings = function () {
        return settings
    }

    farmOverflow.isInitialized = function () {
        return initialized
    }

    farmOverflow.isRunning = function () {
        return running
    }

    farmOverflow.getLogs = function () {
        return logs
    }

    farmOverflow.clearLogs = function () {
        logs = []
        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED)

        return logs
    }

    return farmOverflow
})
