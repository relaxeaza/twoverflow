define('two/farmOverflow', [
    'two/Settings',
    'two/farmOverflow/types/errors',
    'two/farmOverflow/types/status',
    'two/farmOverflow/settings',
    'two/farmOverflow/settings/map',
    'two/farmOverflow/settings/updates',
    'two/farmOverflow/types/logs',
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
    STATUS,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
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
    let initialized = false
    let running = false
    let settings
    let farmers = []
    let logs = []
    let includedVillages = []
    let ignoredVillages = []
    let onlyVillages = []
    let selectedPresets = []
    let activeFarmer = false
    let sendingCommand = false
    let currentTarget = false
    let farmerIndex = 0
    let farmerCycle = []
    let farmerTimeoutId = null
    let targetTimeoutId = null
    let exceptionLogs
    let tempVillageReports = {}
    let $player
    let unitsData
    const VILLAGE_COMMAND_LIMIT = 50
    const MINIMUM_FARMER_CYCLE_INTERVAL = 5 * 1000
    const MINIMUM_ATTACK_INTERVAL = 1 * 1000

    const STORAGE_KEYS = {
        LOGS: 'farm_overflow_logs',
        SETTINGS: 'farm_overflow_settings',
        EXCEPTION_LOGS: 'farm_overflow_exception_logs'
    }

    const villageFilters = {
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

    const targetFilters = [
        villageFilters.distance,
        villageFilters.ownPlayer,
        villageFilters.included,
        villageFilters.ignored
    ]

    const calcDistances = function (targets, origin) {
        return targets.map(function (target) {
            target.distance = math.actualDistance(origin, target)
            return target
        })
    }

    const filterTargets = function (targets) {
        return targets.filter(function (target) {
            return targetFilters.every(function (fn) {
                return !fn(target)
            })
        })
    }

    const sortTargets = function (targets) {
        return targets.sort(function (a, b) {
            return a.distance - b.distance
        })
    }

    const arrayUnique = function (array) {
        return array.sort().filter(function (item, pos, ary) {
            return !pos || item != ary[pos - 1]
        })
    }

    const skipStepInterval = function () {
        if (!running) {
            return
        }

        if (activeFarmer && targetTimeoutId) {
            clearTimeout(targetTimeoutId)
            targetTimeoutId = null
            activeFarmer.targetStep({
                delay: true
            })
        }

        if (farmerTimeoutId) {
            clearTimeout(farmerTimeoutId)
            farmerTimeoutId = null
            farmerIndex = 0
            farmOverflow.farmerStep()
        }
    }

    const updateIncludedVillage = function () {
        const groupsInclude = settings.get(SETTINGS.GROUP_INCLUDE)

        includedVillages = []

        groupsInclude.forEach(function (groupId) {
            let groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)
            includedVillages = includedVillages.concat(groupVillages)
        })

        includedVillages = arrayUnique(includedVillages)
    }

    const updateIgnoredVillage = function () {
        const groupIgnored = settings.get(SETTINGS.GROUP_IGNORE)
        ignoredVillages = modelDataService.getGroupList().getGroupVillageIds(groupIgnored)
    }

    const updateOnlyVillage = function () {
        const groupsOnly = settings.get(SETTINGS.GROUP_ONLY)

        onlyVillages = []

        groupsOnly.forEach(function (groupId) {
            let groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)
            groupVillages = groupVillages.filter(function (villageId) {
                return !!$player.getVillage(villageId)
            })

            onlyVillages = onlyVillages.concat(groupVillages)
        })

        onlyVillages = arrayUnique(onlyVillages)
    }

    const updateExceptionLogs = function () {
        const exceptionVillages = ignoredVillages.concat(includedVillages)
        let modified = false

        exceptionVillages.forEach(function (villageId) {
            if (!exceptionLogs.hasOwnProperty(villageId)) { 
                exceptionLogs[villageId] = {
                    time: timeHelper.gameTime(),
                    report: false
                }
                modified = true
            }
        })

        angular.forEach(exceptionLogs, function (time, villageId) {
            villageId = parseInt(villageId, 10)
            
            if (!exceptionVillages.includes(villageId)) {
                delete exceptionLogs[villageId]
                modified = true
            }
        })

        if (modified) {
            Lockr.set(STORAGE_KEYS.EXCEPTION_LOGS, exceptionLogs)
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_LOGS_UPDATED)
        }
    }

    const updateGroupVillages = function () {
        updateIncludedVillage()
        updateIgnoredVillage()
        updateOnlyVillage()
        updateExceptionLogs()

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_VILLAGES_UPDATED)
    }

    const villageGroupLink = function (event, data) {
        const groupsInclude = settings.get(SETTINGS.GROUP_INCLUDE)
        const groupIgnore = settings.get(SETTINGS.GROUP_IGNORE)
        const groupsOnly = settings.get(SETTINGS.GROUP_ONLY)
        const isOwnVillage = $player.getVillage(data.village_id)
        let farmerListUpdated = false

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                farmOverflow.removeFarmer(data.village_id)
                farmerListUpdated = true
            } else {
                farmOverflow.removeTarget(data.village_id)

                addLog(LOG_TYPES.IGNORED_VILLAGE, {
                    villageId: data.village_id
                })
                addExceptionLog(data.village_id)
            }
        }

        if (groupsInclude.includes(data.group_id) && !isOwnVillage) {
            farmOverflow.reloadTargets()

            addLog(LOG_TYPES.INCLUDED_VILLAGE, {
                villageId: data.village_id
            })
            addExceptionLog(data.village_id)
        }

        if (groupsOnly.includes(data.group_id) && isOwnVillage) {
            let farmer = farmOverflow.createFarmer(data.village_id)
            farmer.init().then(function () {
                if (running) {
                    farmer.start()
                }
            })

            farmerListUpdated = true
        }

        if (farmerListUpdated) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
        }
    }

    const villageGroupUnlink = function (event, data) {
        const groupsInclude = settings.get(SETTINGS.GROUP_INCLUDE)
        const groupIgnore = settings.get(SETTINGS.GROUP_IGNORE)
        const groupsOnly = settings.get(SETTINGS.GROUP_ONLY)
        const isOwnVillage = $player.getVillage(data.village_id)
        let farmerListUpdated = false

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                let farmer = farmOverflow.createFarmer(data.village_id)
                farmer.init().then(function () {
                    if (running) {
                        farmer.start()
                    }
                })

                farmerListUpdated = true
            } else {
                farmOverflow.reloadTargets()

                addLog(LOG_TYPES.IGNORED_VILLAGE_REMOVED, {
                    villageId: data.village_id
                })
            }
        }

        if (groupsInclude.includes(data.group_id) && !isOwnVillage) {
            farmOverflow.reloadTargets()

            addLog(LOG_TYPES.INCLUDED_VILLAGE_REMOVED, {
                villageId: data.village_id
            })
        }

        if (groupsOnly.includes(data.group_id) && isOwnVillage) {
            farmOverflow.removeFarmer(data.village_id)
            farmerListUpdated = true
        }

        if (farmerListUpdated) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
        }
    }

    const removedGroupListener = function () {
        updateGroupVillages()

        farmOverflow.flushFarmers()
        farmOverflow.reloadTargets()
        farmOverflow.createFarmers()
    }

    const updatePresets = function () {
        const processPresets = function () {
            selectedPresets = []
            const playerPresets = modelDataService.getPresetList().getPresets()
            const activePresets = settings.get(SETTINGS.PRESETS)

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

    const ignoreVillage = function (villageId) {
        const groupIgnore = settings.get(SETTINGS.GROUP_IGNORE)

        if (!groupIgnore) {
            return false
        }

        socketService.emit(routeProvider.GROUPS_LINK_VILLAGE, {
            group_id: groupIgnore,
            village_id: villageId
        })

        return true
    }

    const presetListener = function () {
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

    const reportListener = function (event, data) {
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
            tempVillageReports[data.target_village_id] = {
                haul: data.haul,
                id: data.id,
                result: data.result,
                title: data.title
            }

            ignoreVillage(data.target_village_id)
        }
    }

    const commandSentListener = function (event, data) {
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

    const commandErrorListener = function (event, data) {
        if (!activeFarmer || !sendingCommand || !currentTarget) {
            return
        }

        if (data.cause === routeProvider.SEND_PRESET.type) {
            activeFarmer.commandError(data)
        }
    }

    const assignPresets = function (villageId, presetIds, callback) {
        socketService.emit(routeProvider.ASSIGN_PRESETS, {
            village_id: villageId,
            preset_ids: presetIds
        }, callback)
    }

    const getPresetHaul = function (preset) {
        let haul = 0

        angular.forEach(preset.units, function (unitAmount, unitName) {
            if (unitAmount) {
                haul += unitsData[unitName].load * unitAmount
            }
        })

        return haul
    }

    const getPresetTimeTravel = function (preset, barbarian) {
        return armyService.calculateTravelTime(preset, {
            barbarian: barbarian,
            officers: false
        })
    }

    const checkPresetTime = function (preset, village, target) {
        const limitTime = settings.get(SETTINGS.MAX_TRAVEL_TIME) * 60
        const position = village.getPosition()
        const distance = math.actualDistance(position, target)
        const travelTime = getPresetTimeTravel(preset, !target.character_id)
        const totalTravelTime = armyService.getTravelTimeForDistance(preset, travelTime, distance, COMMAND_TYPES.TYPES.ATTACK)

        return limitTime > totalTravelTime
    }

    const checkFullStorage = function(village) {
        if (!village.isReady()) {
            return false
        }

        const resources = village.getResources()
        const computed = resources.getComputed()
        const maxStorage = resources.getMaxStorage()

        return ['wood', 'clay', 'iron'].every(function (type) {
            return computed[type].currentStock === maxStorage
        })
    }

    const addExceptionLog = function (villageId) {
        exceptionLogs[villageId] = {
            time: timeHelper.gameTime(),
            report: tempVillageReports[villageId] || false
        }

        delete tempVillageReports[villageId]

        Lockr.set(STORAGE_KEYS.EXCEPTION_LOGS, exceptionLogs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_LOGS_UPDATED)
    }

    const addLog = function(type, _data) {
        if (typeof type !== 'string') {
            return false
        }

        let data = angular.isObject(_data) ? _data : {}

        data.time = timeHelper.gameTime()
        data.type = type

        logs.unshift(data)
        trimAndSaveLogs()

        return true
    }

    const trimAndSaveLogs = function () {
        const limit = settings.get(SETTINGS.LOGS_LIMIT)

        if (logs.length > limit) {
            logs.splice(logs.length - limit, logs.length)
        }

        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED)
    }

    const Farmer = function (villageId) {
        let self = this
        let village = $player.getVillage(villageId)
        let index = 0
        let running = false
        let initialized = false
        let ready = false
        let targets = false
        let cycleEndHandler = noop
        let loadPromises
        let status = STATUS.WAITING_CYCLE

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

            self.targetStep({
                delay: false
            })

            return true
        }

        self.stop = function (reason) {
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

        self.targetStep = async function (_options) {
            const options = _options || {}
            let preset
            let delayTime = 0
            let target
            const commandList = village.getCommandListModel()
            const villageCommands = commandList.getOutgoingCommands(true, true)
            let checkedLocalCommands = false

            const checkCommandLimit = function () {
                const limit = VILLAGE_COMMAND_LIMIT - settings.get(SETTINGS.PRESERVE_COMMAND_SLOTS)

                if (villageCommands.length >= limit) {
                    throw STATUS.COMMAND_LIMIT
                }
            }

            const checkStorage = function () {
                if (settings.get(SETTINGS.IGNORE_FULL_STORAGE) && checkFullStorage(village)) {
                    throw STATUS.FULL_STORAGE
                }
            }

            const checkTargets = function () {
                if (!targets.length) {
                    throw STATUS.NO_TARGETS
                }

                if (index > targets.length || !targets[index]) {
                    throw STATUS.TARGET_CYCLE_END
                }
            }

            const checkVillagePresets = () => new Promise(function (resolve) {
                const neededPresets = genPresetList()

                if (neededPresets) {
                    assignPresets(village.getId(), neededPresets, resolve)
                } else {
                    resolve()
                }
            })

            const checkPreset = function () {
                target = getTarget()

                if (!target) {
                    throw STATUS.UNKNOWN
                }

                preset = getPreset(target)

                if (typeof preset === 'string') {
                    throw preset
                }
            }

            const checkTarget = () => new Promise(function (resolve) {
                socketService.emit(routeProvider.GET_ATTACKING_FACTOR, {
                    target_id: target.id
                }, function(data) {
                    // abandoned village conquered by some noob.
                    if (target.character_id === null && data.owner_id !== null && !includedVillages.includes(target.id)) {
                        throw STATUS.ABANDONED_CONQUERED
                    } else if (target.attack_protection) {
                        throw STATUS.PROTECTED_VILLAGE
                    } else {
                        resolve()
                    }
                })
            })

            const checkLocalCommands = function () {
                let otherAttacking = false

                const multipleFarmers = settings.get(SETTINGS.TARGET_MULTIPLE_FARMERS)
                const singleAttack = settings.get(SETTINGS.TARGET_SINGLE_ATTACK)
                const playerVillages = $player.getVillageList()
                const allVillagesLoaded = playerVillages.every(function (anotherVillage) {
                    return anotherVillage.isReady(VILLAGE_CONFIG.READY_STATES.OWN_COMMANDS)
                })

                if (allVillagesLoaded) {
                    otherAttacking = playerVillages.some(function (anotherVillage) {
                        if (anotherVillage.getId() === village.getId()) {
                            return false
                        }

                        const anotherVillageCommands = anotherVillage.getCommandListModel().getOutgoingCommands(true, true)

                        return anotherVillageCommands.some(function (command) {
                            return command.targetVillageId === target.id && command.data.direction === 'forward'
                        })
                    })
                }

                const attacking = villageCommands.some(function (command) {
                    return command.data.target.id === target.id && command.data.direction === 'forward'
                })

                if (isTargetBusy(attacking, otherAttacking, allVillagesLoaded)) {
                    throw STATUS.BUSY_TARGET
                }

                if (allVillagesLoaded) {
                    checkedLocalCommands = true
                }
            }

            const checkTargetPoints = () => new Promise(function (resolve) {
                $mapData.getTownAtAsync(target.x, target.y, function (data) {
                    if (villageFilters.points(data.points)) {
                        throw STATUS.NOT_ALLOWED_POINTS
                    }

                    resolve()
                })
            })

            const checkLoadedCommands = () => new Promise(function (resolve) {
                if (checkedLocalCommands) {
                    return resolve()
                }

                socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
                    my_village_id: villageId,
                    village_id: target.id,
                    num_reports: 0
                }, function (data) {
                    const targetCommands = data.commands.own.filter(function (command) {
                        return command.type === COMMAND_TYPES.TYPES.ATTACK && command.direction === 'forward'
                    })
                    const multipleFarmers = settings.get(SETTINGS.TARGET_MULTIPLE_FARMERS)
                    const singleAttack = settings.get(SETTINGS.TARGET_SINGLE_ATTACK)
                    const otherAttacking = targetCommands.some(function (command) {
                        return command.start_village_id !== villageId
                    })
                    const attacking = targetCommands.some(function (command) {
                        return command.start_village_id === villageId
                    })

                    if (isTargetBusy(attacking, otherAttacking, true)) {
                        throw STATUS.BUSY_TARGET
                    }

                    resolve()
                })
            })

            const prepareAttack = function () {
                if (options.delay) {
                    delayTime = settings.get(SETTINGS.ATTACK_INTERVAL) * 1000

                    if (delayTime < MINIMUM_ATTACK_INTERVAL) {
                        delayTime = MINIMUM_ATTACK_INTERVAL
                    }

                    delayTime = utils.randomSeconds(delayTime)
                }

                self.setStatus(STATUS.ATTACKING)

                targetTimeoutId = setTimeout(function() {
                    attackTarget(target, preset)
                }, delayTime)
            }

            const onError = function (error) {
                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STEP_ERROR, {
                    villageId: villageId,
                    error: error
                })

                index++

                switch (error) {
                case STATUS.TIME_LIMIT:
                case STATUS.BUSY_TARGET:
                case STATUS.ABANDONED_CONQUERED:
                case STATUS.PROTECTED_VILLAGE:
                    self.setStatus(error)
                    self.targetStep(options)
                    break

                case STATUS.NOT_ALLOWED_POINTS:
                    self.setStatus(error)
                    farmOverflow.removeTarget(target.id)
                    self.targetStep(options)
                    break

                case STATUS.NO_UNITS:
                case STATUS.NO_TARGETS:
                case STATUS.FULL_STORAGE:
                case STATUS.COMMAND_LIMIT:
                    self.setStatus(error)
                    self.stop(error)
                    break

                case STATUS.TARGET_CYCLE_END:
                    self.setStatus(error)
                    self.stop(error)
                    index = 0
                    break

                default:
                    self.setStatus(STATUS.UNKNOWN)
                    self.stop(STATUS.UNKNOWN)
                    break
                }
            }

            try {
                checkCommandLimit()
                checkStorage()
                checkTargets()
                await checkVillagePresets()
                checkPreset()
                await checkTarget()
                checkLocalCommands()
                await checkTargetPoints()
                await checkLoadedCommands()
                prepareAttack()
            } catch (error) {
                onError(error)
            }
        }

        self.setStatus = function (newStatus) {
            status = newStatus
        }

        self.getStatus = function () {
            return status || ''
        }

        self.commandSent = function (data) {
            sendingCommand = false
            currentTarget = false

            self.targetStep({
                delay: true
            })
        }

        self.commandError = function (data) {
            sendingCommand = false
            currentTarget = false

            self.stop(STATUS.COMMAND_ERROR)
        }

        self.onCycleEnd = function (handler) {
            cycleEndHandler = handler
        }

        self.loadTargets = function (_callback) {
            const pos = village.getPosition()

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

        self.getIndex = function () {
            return index
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
            if (typeof targetId !== 'number' || !targets) {
                return false
            }

            targets = targets.filter(function (target) {
                return target.id !== targetId
            })

            return true
        }

        // private functions

        const genPresetList = function () {
            const villagePresets = modelDataService.getPresetList().getPresetsByVillageId(village.getId())
            let needAssign = false
            let which = []

            selectedPresets.forEach(function (preset) {
                if (!villagePresets.hasOwnProperty(preset.id)) {
                    needAssign = true
                    which.push(preset.id)
                }
            })

            if (needAssign) {
                for (let id in villagePresets) {
                    which.push(id)
                }

                return which
            }

            return false
        }

        const isTargetBusy = function (attacking, otherAttacking, allVillagesLoaded) {
            const multipleFarmers = settings.get(SETTINGS.TARGET_MULTIPLE_FARMERS)
            const singleAttack = settings.get(SETTINGS.TARGET_SINGLE_ATTACK)

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

        const attackTarget = function (target, preset) {
            if (!running) {
                return false
            }

            sendingCommand = true
            currentTarget = target
            index++

            socketService.emit(routeProvider.SEND_PRESET, {
                start_village: village.getId(),
                target_village: target.id,
                army_preset_id: preset.id,
                type: COMMAND_TYPES.TYPES.ATTACK
            })
        }

        const getTarget = function () {
            return targets[index]
        }

        const getPreset = function (target) {
            const units = village.getUnitInfo().getUnits()

            for (let i = 0; i < selectedPresets.length; i++) {
                let preset = selectedPresets[i]
                let avail = true

                for (let unit in preset.units) {
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
                        return STATUS.TIME_LIMIT
                    }
                }
            }

            return STATUS.NO_UNITS
        }
    }

    let farmOverflow = {}

    farmOverflow.init = function () {
        initialized = true
        logs = Lockr.get(STORAGE_KEYS.LOGS, [])
        exceptionLogs = Lockr.get(STORAGE_KEYS.EXCEPTION_LOGS, {})
        $player = modelDataService.getSelectedCharacter()
        unitsData = modelDataService.getGameData().getUnitsObject()
        
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates) {
            if (updates[UPDATES.PRESET]) {
                updatePresets()
            }

            if (updates[UPDATES.GROUPS]) {
                updateGroupVillages()
            }

            if (updates[UPDATES.TARGETS]) {
                farmOverflow.reloadTargets()
            }

            if (updates[UPDATES.VILLAGES]) {
                farmOverflow.flushFarmers()
                farmOverflow.createFarmers()
            }

            if (updates[UPDATES.LOGS]) {
                trimAndSaveLogs()
            }

            if (updates[UPDATES.INTERVAL_TIMERS]) {
                skipStepInterval()
            }
        })
        
        updateGroupVillages()
        updatePresets()
        farmOverflow.createFarmers()

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
        let readyFarmers

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
        farmerTimeoutId = null

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
            reason: reason
        })

        if (reason === ERROR_TYPES.USER_STOP) {
            addLog(LOG_TYPES.FARM_STOP)
        }
    }

    farmOverflow.createFarmers = function () {
        angular.forEach($player.getVillages(), function (village, villageId) {
            farmOverflow.createFarmer(villageId)
        })

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
    }

    farmOverflow.createFarmer = function (villageId) {
        const groupsOnly = settings.get(SETTINGS.GROUP_ONLY)

        villageId = parseInt(villageId, 10)

        if (groupsOnly.length && !onlyVillages.includes(villageId)) {
            return false
        }

        if (ignoredVillages.includes(villageId)) {
            return false
        }

        if (!farmOverflow.getFarmer(villageId)) {
            farmers.push(new Farmer(villageId))
        }

        return farmOverflow.getFarmer(villageId)
    }

    /**
     * Clean farmer instances by removing villages based on
     * groups-only, only-villages and ignore-villages group filters.
     */
    farmOverflow.flushFarmers = function () {
        const groupsOnly = settings.get(SETTINGS.GROUP_ONLY)
        let removeIds = []

        farmers.forEach(function (farmer) {
            let villageId = farmer.getVillage().getId()

            if (groupsOnly.length && !onlyVillages.includes(villageId)) {
                removeIds.push(villageId)
            } else if (ignoredVillages.includes(villageId)) {
                removeIds.push(villageId)
            }
        })

        if (removeIds.length) {
            removeIds.forEach(function (removeId) {
                farmOverflow.removeFarmer(removeId)
            })

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
        }
    }

    farmOverflow.getFarmer = function (farmerId) {
        for (let i = 0; i < farmers.length; i++) {
            if (farmers[i].getVillage().getId() === farmerId) {
                return farmers[i]
            }
        }

        return false
    }

    farmOverflow.getFarmers = function () {
        return farmers
    }

    farmOverflow.removeFarmer = function (farmerId) {
        for (let i = 0; i < farmers.length; i++) {
            if (farmers[i].getVillage().getId() === farmerId) {
                farmers[i].stop()
                farmers.splice(i, i + 1)

                return true
            }
        }

        return false
    }

    farmOverflow.farmerStep = function () {
        if (!farmers.length) {
            activeFarmer = false
        } else if (farmerIndex >= farmers.length) {
            farmerIndex = 0
            activeFarmer = false
        } else {
            activeFarmer = farmers[farmerIndex]
        }

        if (!activeFarmer) {
            let interval = settings.get(SETTINGS.FARMER_CYCLE_INTERVAL) * 60 * 1000

            if (interval < MINIMUM_ATTACK_INTERVAL) {
                interval = MINIMUM_FARMER_CYCLE_INTERVAL
            }

            farmerTimeoutId = setTimeout(function() {
                farmerTimeoutId = null
                farmerIndex = 0
                farmOverflow.farmerStep()
            }, interval)

            return
        }

        activeFarmer.onCycleEnd(function () {
            farmerIndex++
            farmOverflow.farmerStep()
        })
        
        activeFarmer.start()
    }

    farmOverflow.isTarget = function (targetId) {
        for (let i = 0; i < farmers.length; i++) {
            let farmer = farmers[i]
            let targets = farmer.getTargets()

            for (let j = 0; j < targets.length; j++) {
                let target = targets[j]

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

    farmOverflow.reloadTargets = function () {
        farmers.forEach(function (farmer) {
            farmer.loadTargets()
        })
    }

    farmOverflow.getSettings = function () {
        return settings
    }

    farmOverflow.getExceptionVillages = function () {
        return {
            included: includedVillages,
            ignored: ignoredVillages
        }
    }

    farmOverflow.getExceptionLogs = function () {
        return exceptionLogs
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
