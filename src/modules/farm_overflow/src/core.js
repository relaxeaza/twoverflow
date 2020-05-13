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
    'two/ready',
    'helper/math',
    'helper/time',
    'queues/EventQueue',
    'conf/commandTypes',
    'conf/village',
    'conf/resourceTypes',
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
    twoMapData,
    utils,
    ready,
    math,
    timeHelper,
    eventQueue,
    COMMAND_TYPES,
    VILLAGE_CONFIG,
    RESOURCE_TYPES,
    $mapData,
    Lockr
) {
    let initialized = false
    let running = false
    let settings
    let farmSettings
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
    let cycleTimer = null
    let stepDelayTimer = null
    let commandExpireTimer = null
    let exceptionLogs
    let tempVillageReports = {}
    let $player
    let unitsData
    let persistentRunningLastCheck = timeHelper.gameTime()
    let persistentRunningTimer = null
    let nextCycleDate = null
    const PERSISTENT_RUNNING_CHECK_INTERVAL = 30 * 1000
    const VILLAGE_COMMAND_LIMIT = 50
    const MINIMUM_FARMER_CYCLE_INTERVAL = 1 // minutes
    const MINIMUM_ATTACK_INTERVAL = 0 // seconds
    const STEP_EXPIRE_TIME = 30 * 1000
    const CYCLE_BEGIN = 'cycle_begin'
    const IGNORE_UPDATES = 'ignore_update'
    const STORAGE_KEYS = {
        LOGS: 'farm_overflow_logs',
        SETTINGS: 'farm_overflow_settings',
        EXCEPTION_LOGS: 'farm_overflow_exception_logs'
    }
    const RESOURCES = [
        RESOURCE_TYPES.WOOD,
        RESOURCE_TYPES.CLAY,
        RESOURCE_TYPES.IRON,
    ]

    const villageFilters = {
        distance: function (target) {
            return !target.distance.between(
                farmSettings[SETTINGS.MIN_DISTANCE],
                farmSettings[SETTINGS.MAX_DISTANCE]
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
                farmSettings[SETTINGS.MIN_POINTS],
                farmSettings[SETTINGS.MAX_POINTS]
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

    const reloadTimers = function () {
        if (!running) {
            return
        }

        if (stepDelayTimer) {
            stopTimers()
            activeFarmer.targetStep({
                delay: true
            })
        } else if (cycleTimer) {
            stopTimers()

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN)

            farmerIndex = 0
            farmerStep()
        }
    }

    const updateIncludedVillage = function () {
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]

        includedVillages = []

        groupsInclude.forEach(function (groupId) {
            let groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)
            includedVillages = includedVillages.concat(groupVillages)
        })

        includedVillages = arrayUnique(includedVillages)
    }

    const updateIgnoredVillage = function () {
        const groupIgnored = farmSettings[SETTINGS.GROUP_IGNORE]
        ignoredVillages = modelDataService.getGroupList().getGroupVillageIds(groupIgnored)
    }

    const updateOnlyVillage = function () {
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]

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
            if (!hasOwn.call(exceptionLogs, villageId)) { 
                exceptionLogs[villageId] = {
                    time: timeHelper.gameTime(),
                    report: false
                }
                modified = true
            }
        })

        utils.each(exceptionLogs, function (time, villageId) {
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
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        const isOwnVillage = $player.getVillage(data.village_id)
        let farmerListUpdated = false

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                removeFarmer(data.village_id)
                farmerListUpdated = true
            } else {
                removeTarget(data.village_id)

                addLog(LOG_TYPES.IGNORED_VILLAGE, {
                    villageId: data.village_id
                })
                addExceptionLog(data.village_id)
            }
        }

        if (groupsInclude.includes(data.group_id) && !isOwnVillage) {
            reloadTargets()

            addLog(LOG_TYPES.INCLUDED_VILLAGE, {
                villageId: data.village_id
            })
            addExceptionLog(data.village_id)
        }

        if (groupsOnly.includes(data.group_id) && isOwnVillage) {
            let farmer = createFarmer(data.village_id)
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
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        const isOwnVillage = $player.getVillage(data.village_id)
        let farmerListUpdated = false

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                let farmer = createFarmer(data.village_id)
                farmer.init().then(function () {
                    if (running) {
                        farmer.start()
                    }
                })

                farmerListUpdated = true
            } else {
                reloadTargets()

                addLog(LOG_TYPES.IGNORED_VILLAGE_REMOVED, {
                    villageId: data.village_id
                })
            }
        }

        if (groupsInclude.includes(data.group_id) && !isOwnVillage) {
            reloadTargets()

            addLog(LOG_TYPES.INCLUDED_VILLAGE_REMOVED, {
                villageId: data.village_id
            })
        }

        if (groupsOnly.includes(data.group_id) && isOwnVillage) {
            removeFarmer(data.village_id)
            farmerListUpdated = true
        }

        if (farmerListUpdated) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
        }
    }

    const validGroups = function (_flag) {
        const gameGroups = modelDataService.getGroupList().getGroups()
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]

        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]
        const validedGroupIgnore = hasOwn.call(gameGroups, groupIgnore) ? groupIgnore : settings.getDefault(SETTINGS.GROUP_IGNORE)
        const validedGroupsOnly = groupsOnly.filter(groupId => hasOwn.call(gameGroups, groupId))
        const validedGroupsInclude = groupsInclude.filter(groupId => hasOwn.call(gameGroups, groupId))

        settings.setAll({
            [SETTINGS.GROUP_IGNORE]: validedGroupIgnore,
            [SETTINGS.GROUP_ONLY]: validedGroupsOnly,
            [SETTINGS.GROUP_INCLUDE]: validedGroupsInclude
        }, _flag)
    }

    const removedGroupListener = function () {
        validGroups()
        updateGroupVillages()

        flushFarmers()
        reloadTargets()
        createFarmers()
    }

    const processPresets = function () {
        selectedPresets = []
        const playerPresets = modelDataService.getPresetList().getPresets()
        const activePresets = farmSettings[SETTINGS.PRESETS]

        activePresets.forEach(function (presetId) {
            if (!hasOwn.call(playerPresets, presetId)) {
                return
            }

            let preset = playerPresets[presetId]
            preset.load = getPresetHaul(preset)
            preset.travelTime = armyService.calculateTravelTime(preset, {
                barbarian: false,
                officers: false
            })

            selectedPresets.push(preset)
        })

        selectedPresets = selectedPresets.sort(function (a, b) {
            return a.travelTime - b.travelTime || b.load - a.load
        })
    }

    const ignoreVillage = function (villageId) {
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]

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
        processPresets()

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
        if (!farmSettings[SETTINGS.IGNORE_ON_LOSS] || !farmSettings[SETTINGS.GROUP_IGNORE]) {
            return
        }

        if (!running || data.type !== COMMAND_TYPES.TYPES.ATTACK) {
            return
        }

        // 1 = nocasualties
        // 2 = casualties
        // 3 = defeat
        if (data.result !== 1 && isTarget(data.target_village_id)) {
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

        if (data.origin.id !== activeFarmer.getId()) {
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

    const getPresetHaul = function (preset) {
        let haul = 0

        utils.each(preset.units, function (unitAmount, unitName) {
            if (unitAmount) {
                haul += unitsData[unitName].load * unitAmount
            }
        })

        return haul
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

    const addLog = function (type, data = {}) {
        if (typeof type !== 'string') {
            return false
        }

        if (!angular.isObject(data)) {
            data = {}
        }

        data.time = timeHelper.gameTime()
        data.type = type

        logs.unshift(data)
        trimAndSaveLogs()

        return true
    }

    const trimAndSaveLogs = function () {
        const limit = farmSettings[SETTINGS.LOGS_LIMIT]

        if (logs.length > limit) {
            logs.splice(logs.length - limit, logs.length)
        }

        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED)
    }

    const isTargetBusy = function (attacking, otherAttacking, allVillagesLoaded) {
        const multipleFarmers = farmSettings[SETTINGS.TARGET_MULTIPLE_FARMERS]
        const singleAttack = farmSettings[SETTINGS.TARGET_SINGLE_ATTACK]

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

    const enableRequiredPresets = function (villageId, callback) {
        const villagePresets = modelDataService.getPresetList().getPresetsByVillageId(villageId)
        let missingPresets = []

        selectedPresets.forEach(function (preset) {
            if (!hasOwn.call(villagePresets, preset.id)) {
                missingPresets.push(preset.id)
            }
        })

        if (missingPresets.length) {
            // include already enabled presets because you can't only enable
            // missing ones, you need to emit all you want enabled.
            for (let id in villagePresets) {
                if (hasOwn.call(villagePresets, id)) {
                    missingPresets.push(id)
                }
            }

            socketService.emit(routeProvider.ASSIGN_PRESETS, {
                village_id: villageId,
                preset_ids: missingPresets
            }, callback)

            return
        }

        callback()
    }

    const persistentRunningStart = function () {
        let cycleInterval = getCycleInterval()
        let attackInterval = getAttackInterval()
        let timeLimit = cycleInterval + (cycleInterval / 2) + attackInterval

        persistentRunningTimer = setInterval(function () {
            let now = timeHelper.gameTime()

            if (now - persistentRunningLastCheck > timeLimit) {
                farmOverflow.stop()
                setTimeout(farmOverflow.start, 5000)
            }
        }, PERSISTENT_RUNNING_CHECK_INTERVAL)
    }

    const persistentRunningStop = function () {
        clearInterval(persistentRunningTimer)
    }

    const persistentRunningUpdate = function () {
        persistentRunningLastCheck = timeHelper.gameTime()
    }

    const stopTimers = function () {
        clearTimeout(cycleTimer)
        clearTimeout(stepDelayTimer)
        clearTimeout(commandExpireTimer)

        cycleTimer = null
        stepDelayTimer = null
        commandExpireTimer = null
    }

    const getCycleInterval = function () {
        return Math.max(MINIMUM_FARMER_CYCLE_INTERVAL, farmSettings[SETTINGS.FARMER_CYCLE_INTERVAL] * 60 * 1000)
    }

    const getAttackInterval = function () {
        return Math.max(MINIMUM_ATTACK_INTERVAL, farmSettings[SETTINGS.ATTACK_INTERVAL] * 1000)
    }

    const Farmer = function (villageId) {
        this.villageId = villageId
        this.village = $player.getVillage(villageId)

        if (!this.village) {
            throw new Error(`new Farmer -> Village ${villageId} doesn't exist.`)
        }

        this.index = 0
        this.running = false
        this.initialized = false
        this.targets = false
        this.onCycleEndFn = noop
        this.status = STATUS.WAITING_CYCLE
    }

    Farmer.prototype.init = function () {
        let loadPromises = []

        if (!this.isInitialized()) {
            loadPromises.push(new Promise((resolve) => {
                if (this.isInitialized()) {
                    return resolve()
                }

                villageService.ensureVillageDataLoaded(this.villageId, resolve)
            }))

            loadPromises.push(new Promise((resolve) => {
                if (this.isInitialized()) {
                    return resolve()
                }

                this.loadTargets(() => {
                    eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_READY, {
                        villageId: this.villageId
                    })
                    resolve()
                })
            }))
        }

        return Promise.all(loadPromises).then(() => {
            this.initialized = true
        })
    }

    Farmer.prototype.start = function () {
        persistentRunningUpdate()

        if (this.running) {
            return false
        }

        if (!this.initialized) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NOT_READY, {
                villageId: this.villageId
            })
            return false
        }

        if (!this.targets.length) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NO_TARGETS, {
                villageId: this.villageId
            })
            return false
        }

        activeFarmer = this
        this.running = true
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_START, {
            villageId: this.villageId
        })

        this.targetStep({
            delay: false
        })

        return true
    }

    Farmer.prototype.stop = function (reason) {
        this.running = false

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STOP, {
            villageId: this.villageId,
            reason: reason
        })

        if (reason === ERROR_TYPES.USER_STOP) {
            this.setStatus(STATUS.USER_STOP)
        }

        stopTimers()

        this.onCycleEndFn(reason)
        this.onCycleEndFn = noop
    }

    Farmer.prototype.targetStep = async function (options = {}) {
        if (!this.running) {
            return false
        }

        persistentRunningUpdate()

        const commandList = this.village.getCommandListModel()
        const villageCommands = commandList.getOutgoingCommands(true, true)
        let selectedPreset = false
        let target
        let checkedLocalCommands = false
        let otherVillageAttacking
        let thisVillageAttacking
        let playerVillages

        const delayStep = () => {
            return new Promise((resolve, reject) => {
                if (options.delay) {
                    stepDelayTimer = setTimeout(() => {
                        stepDelayTimer = null

                        if (!this.running) {
                            return reject(STATUS.USER_STOP)
                        }

                        resolve()
                    }, utils.randomSeconds(getAttackInterval()))
                } else {
                    resolve()
                }
            })
        }

        const checkCommandLimit = () => {
            return new Promise((resolve, reject) => {
                const limit = VILLAGE_COMMAND_LIMIT - farmSettings[SETTINGS.PRESERVE_COMMAND_SLOTS]

                if (villageCommands.length >= limit) {
                    reject(STATUS.COMMAND_LIMIT)
                } else {
                    resolve()
                }
            })
        }

        const checkStorage = () => {
            return new Promise((resolve, reject) => {
                if (farmSettings[SETTINGS.IGNORE_FULL_STORAGE]) {
                    const resources = this.village.getResources()
                    const computed = resources.getComputed()
                    const maxStorage = resources.getMaxStorage()
                    const isFull = RESOURCES.every((type) => computed[type].currentStock === maxStorage)

                    if (isFull) {
                        return reject(STATUS.FULL_STORAGE)
                    }
                }

                resolve()
            })
        }

        const selectTarget = () => {
            return new Promise((resolve, reject) => {
                if (!this.targets.length) {
                    return reject(STATUS.NO_TARGETS)
                }

                if (this.index > this.targets.length || !this.targets[this.index]) {
                    return reject(STATUS.TARGET_CYCLE_END)
                }

                target = this.targets[this.index]

                resolve()
            })
        }

        const checkTarget = () => {
            return new Promise((resolve, reject) => {
                $mapData.getTownAtAsync(target.x, target.y, (data) => {
                    if (villageFilters.points(data.points)) {
                        return reject(STATUS.NOT_ALLOWED_POINTS)
                    }

                    socketService.emit(routeProvider.GET_ATTACKING_FACTOR, {
                        target_id: target.id
                    }, (data) => {
                        if (!this.running) {
                            reject(STATUS.USER_STOP)
                        // abandoned village conquered by some noob.
                        } else if (target.character_id === null && data.owner_id !== null && !includedVillages.includes(target.id)) {
                            reject(STATUS.ABANDONED_CONQUERED)
                        } else if (target.attack_protection) {
                            reject(STATUS.PROTECTED_VILLAGE)
                        } else {
                            resolve()
                        }
                    })
                })
            })
        }

        const checkPresets = () => {
            return new Promise((resolve, reject) => {
                enableRequiredPresets(this.villageId, () => {
                    if (this.running) {
                        resolve()
                    } else {
                        reject(STATUS.USER_STOP)
                    }
                })
            })
        }

        const selectPreset = () => {
            return new Promise((resolve, reject) => {
                const villageUnits = this.village.getUnitInfo().getUnits()
                const maxTravelTime = farmSettings[SETTINGS.MAX_TRAVEL_TIME] * 60
                const villagePosition = this.village.getPosition()
                const targetDistance = math.actualDistance(villagePosition, target)

                utils.each(selectedPresets, (preset) => {
                    let enoughUnits = !Object.entries(preset.units).some((unit) => {
                        const name = unit[0]
                        const amount = unit[1]
                        
                        return villageUnits[name].in_town < amount
                    })

                    if (!enoughUnits) {
                        return
                    }

                    const travelTime = armyService.calculateTravelTime(preset, {
                        barbarian: !target.character_id,
                        officers: false
                    })

                    if (maxTravelTime > travelTime * targetDistance) {
                        selectedPreset = preset
                        resolve()
                    } else {
                        // why reject with TIME_LIMIT if there are more presets to check?
                        // because the preset list is sorted by travel time.
                        reject(STATUS.TIME_LIMIT)
                    }

                    return false
                })

                if (!selectedPreset) {
                    reject(STATUS.NO_UNITS)
                }
            })
        }

        const checkLocalCommands = () => {
            return new Promise((resolve, reject) => {
                otherVillageAttacking = false
                playerVillages = $player.getVillageList()
                
                const allVillagesLoaded = playerVillages.every((anotherVillage) => anotherVillage.isInitialized(VILLAGE_CONFIG.READY_STATES.OWN_COMMANDS))

                if (allVillagesLoaded) {
                    otherVillageAttacking = playerVillages.some((anotherVillage) => {
                        if (anotherVillage.getId() === this.villageId) {
                            return false
                        }

                        const otherVillageCommands = anotherVillage.getCommandListModel().getOutgoingCommands(true, true)

                        return otherVillageCommands.some((command) => {
                            return command.targetVillageId === target.id && command.data.direction === 'forward'
                        })
                    })
                }

                thisVillageAttacking = villageCommands.some((command) => {
                    return command.data.target.id === target.id && command.data.direction === 'forward'
                })

                if (isTargetBusy(thisVillageAttacking, otherVillageAttacking, allVillagesLoaded)) {
                    return reject(STATUS.BUSY_TARGET)
                }

                if (allVillagesLoaded) {
                    checkedLocalCommands = true
                }

                resolve()
            })
        }

        const minimumInterval = () => {
            return new Promise((resolve, reject) => {
                if (!thisVillageAttacking && !otherVillageAttacking) {
                    return resolve()
                }

                const multipleAttacksInterval = farmSettings[SETTINGS.MULTIPLE_ATTACKS_INTERVAL] * 60

                if (!multipleAttacksInterval) {
                    return resolve()
                }

                // if TARGET_SINGLE_ATTACK is enabled, and TARGET_MULTIPLE_FARMERS is disabled
                // there's no reason the check, since the target is allowed to receive multiple
                // attacks simultaneously.
                if (farmSettings[SETTINGS.TARGET_SINGLE_ATTACK] && !farmSettings[SETTINGS.TARGET_MULTIPLE_FARMERS]) {
                    return resolve()
                }

                const now = Math.round(timeHelper.gameTime() / 1000)
                const villages = farmSettings[SETTINGS.TARGET_MULTIPLE_FARMERS] ? playerVillages : [this.village]
                const position = this.village.getPosition()
                const distance = math.actualDistance(position, target)
                const singleFieldtravelTime = armyService.calculateTravelTime(selectedPreset, {
                    barbarian: !target.character_id,
                    officers: true,
                    effects: true
                })
                const commandTravelTime = armyService.getTravelTimeForDistance(selectedPreset, singleFieldtravelTime, distance, COMMAND_TYPES.TYPES.ATTACK)

                const busyTarget = villages.some((village) => {
                    const commands = village.getCommandListModel().getOutgoingCommands(true, true)
                    const targetCommands = commands.filter((command) => command.targetVillageId === target.id && command.data.direction === 'forward')

                    if (targetCommands.length) {
                        return targetCommands.some((command) => {
                            return Math.abs((now + commandTravelTime) - command.time_completed) < multipleAttacksInterval
                        })
                    }
                })

                if (busyTarget) {
                    return reject(STATUS.BUSY_TARGET)
                }

                resolve()
            })
        }

        const checkLoadedCommands = () => {
            return new Promise((resolve, reject) => {
                if (checkedLocalCommands) {
                    return resolve()
                }

                socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
                    my_village_id: this.villageId,
                    village_id: target.id,
                    num_reports: 0
                }, (data) => {
                    if (!this.running) {
                        return reject(STATUS.USER_STOP)
                    }

                    const targetCommands = data.commands.own.filter((command) => command.type === COMMAND_TYPES.TYPES.ATTACK && command.direction === 'forward')
                    const otherAttacking = targetCommands.some((command) => command.start_village_id !== this.villageId)
                    const attacking = targetCommands.some((command) => command.start_village_id === this.villageId)

                    if (isTargetBusy(attacking, otherAttacking, true)) {
                        return reject(STATUS.BUSY_TARGET)
                    }

                    resolve()
                })
            })
        }

        const prepareAttack = () => {
            if (!this.running) {
                return false
            }

            this.setStatus(STATUS.ATTACKING)

            sendingCommand = true
            currentTarget = target
            this.index++

            socketService.emit(routeProvider.SEND_PRESET, {
                start_village: this.villageId,
                target_village: target.id,
                army_preset_id: selectedPreset.id,
                type: COMMAND_TYPES.TYPES.ATTACK
            })
        }

        const stepStatus = (status) => {
            stopTimers()

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STEP_STATUS, {
                villageId: this.villageId,
                error: status
            })

            switch (status) {
                case STATUS.TIME_LIMIT:
                case STATUS.BUSY_TARGET:
                case STATUS.ABANDONED_CONQUERED:
                case STATUS.PROTECTED_VILLAGE: {
                    this.index++
                    this.setStatus(status)
                    this.targetStep(options)
                    break
                }
                case STATUS.USER_STOP: {
                    this.setStatus(status)
                    break
                }
                case STATUS.NOT_ALLOWED_POINTS: {
                    this.index++
                    this.setStatus(status)
                    removeTarget(target.id)
                    this.targetStep(options)
                    break
                }
                case STATUS.NO_UNITS:
                case STATUS.NO_TARGETS:
                case STATUS.FULL_STORAGE:
                case STATUS.COMMAND_LIMIT: {
                    this.index++
                    this.setStatus(status)
                    this.stop(status)
                    break
                }
                case STATUS.TARGET_CYCLE_END: {
                    this.index = 0
                    this.setStatus(status)
                    this.stop(status)
                    break
                }
                case STATUS.EXPIRED_STEP: {
                    this.setStatus(status)
                    this.targetStep()
                    break
                }
                default: {
                    console.error('Unknown status:', status)
                    this.index++
                    this.setStatus(STATUS.UNKNOWN)
                    this.stop(STATUS.UNKNOWN)
                    break
                }
            }
        }

        let attackPromise = new Promise((resolve, reject) => {
            delayStep()
                .then(checkCommandLimit)
                .then(checkStorage)
                .then(selectTarget)
                .then(checkTarget)
                .then(checkPresets)
                .then(selectPreset)
                .then(checkLocalCommands)
                .then(minimumInterval)
                .then(checkLoadedCommands)
                .then(resolve)
                .catch(reject)
        })

        let expirePromise = new Promise((resolve, reject) => {
            commandExpireTimer = setTimeout(() => {
                if (this.running) {
                    reject(STATUS.EXPIRED_STEP)
                }
            }, STEP_EXPIRE_TIME)
        })

        Promise.race([attackPromise, expirePromise])
            .then(prepareAttack)
            .catch(stepStatus)
    }

    Farmer.prototype.setStatus = function (newStatus) {
        this.status = newStatus
    }

    Farmer.prototype.getStatus = function () {
        return this.status || STATUS.UNKNOWN
    }

    Farmer.prototype.commandSent = function (data) {
        sendingCommand = false
        currentTarget = false

        stopTimers()

        addLog(LOG_TYPES.ATTACKED_VILLAGE, {
            targetId: data.target.id
        })

        this.targetStep({
            delay: true
        })
    }

    Farmer.prototype.commandError = function () {
        sendingCommand = false
        currentTarget = false

        this.stop(STATUS.COMMAND_ERROR)
    }

    Farmer.prototype.onCycleEnd = function (handler) {
        this.onCycleEndFn = handler
    }

    Farmer.prototype.loadTargets = function (callback) {
        const pos = this.village.getPosition()

        twoMapData.load((loadedTargets) => {
            this.targets = calcDistances(loadedTargets, pos)
            this.targets = filterTargets(this.targets, pos)
            this.targets = sortTargets(this.targets)
            this.targets = this.targets.slice(0, farmSettings[SETTINGS.TARGET_LIMIT_PER_VILLAGE])

            if (typeof callback === 'function') {
                callback(this.targets)
            }
        })
    }

    Farmer.prototype.getTargets = function () {
        return this.targets
    }

    Farmer.prototype.getIndex = function () {
        return this.index
    }

    Farmer.prototype.getVillage = function () {
        return this.village
    }

    Farmer.prototype.isRunning = function () {
        return this.running
    }

    Farmer.prototype.isInitialized = function () {
        return this.initialized
    }

    Farmer.prototype.removeTarget = function (targetId) {
        if (typeof targetId !== 'number' || !this.targets) {
            return false
        }

        this.targets = this.targets.filter(function (target) {
            return target.id !== targetId
        })

        return true
    }

    Farmer.prototype.getId = function () {
        return this.villageId
    }

    const createFarmer = function (villageId) {
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]

        villageId = parseInt(villageId, 10)

        if (groupsOnly.length && !onlyVillages.includes(villageId)) {
            return false
        }

        if (ignoredVillages.includes(villageId)) {
            return false
        }

        let farmer = farmOverflow.getFarmer(villageId)

        if (!farmer) {
            farmer = new Farmer(villageId)
            farmers.push(farmer)
        }

        return farmer
    }

    const createFarmers = function () {
        utils.each($player.getVillages(), function (village, villageId) {
            createFarmer(villageId)
        })

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
    }

    /**
     * Clean farmer instances by removing villages based on
     * groups-only, only-villages and ignore-villages group filters.
     */
    const flushFarmers = function () {
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        let removeIds = []

        farmers.forEach(function (farmer) {
            let villageId = farmer.getId()

            if (groupsOnly.length && !onlyVillages.includes(villageId)) {
                removeIds.push(villageId)
            } else if (ignoredVillages.includes(villageId)) {
                removeIds.push(villageId)
            }
        })

        if (removeIds.length) {
            removeIds.forEach(function (removeId) {
                removeFarmer(removeId)
            })

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
        }
    }

    const removeFarmer = function (farmerId) {
        for (let i = 0; i < farmers.length; i++) {
            if (farmers[i].getId() === farmerId) {
                farmers[i].stop(ERROR_TYPES.KILL_FARMER)
                farmers.splice(i, i + 1)

                return true
            }
        }

        return false
    }

    const farmerStep = function (status) {
        persistentRunningUpdate()

        if (!farmers.length) {
            activeFarmer = false
        } else if (farmerIndex >= farmers.length) {
            farmerIndex = 0
            activeFarmer = false
            nextCycleDate = timeHelper.gameTime() + getCycleInterval()
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_END)
        } else {
            activeFarmer = farmers[farmerIndex]
        }

        if (activeFarmer) {
            activeFarmer.onCycleEnd(function (reason) {
                if (reason !== ERROR_TYPES.USER_STOP) {
                    farmerIndex++
                    farmerStep()
                }
            })

            if (status === CYCLE_BEGIN) {
                nextCycleDate = null
                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN)
            }

            activeFarmer.start()
        } else {
            cycleTimer = setTimeout(function () {
                cycleTimer = null
                farmerIndex = 0
                nextCycleDate = null
                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN)
                farmerStep()
            }, getCycleInterval())
        }
    }

    const isTarget = function (targetId) {
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

    const removeTarget = function (targetId) {
        farmers.forEach(function (farmer) {
            farmer.removeTarget(targetId)
        })
    }

    const reloadTargets = function () {
        twoMapData.load(function () {
            farmers.forEach(function (farmer) {
                farmer.loadTargets()
            })
        }, true)
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

        settings.onChange(function (changes, updates, _flag) {
            console.log('_flag', _flag)
            farmSettings = settings.getAll()

            if (_flag === IGNORE_UPDATES) {
                return
            }

            if (updates[UPDATES.PRESET]) {
                processPresets()
            }

            if (updates[UPDATES.GROUPS]) {
                updateGroupVillages()
            }

            if (updates[UPDATES.TARGETS]) {
                reloadTargets()
            }

            if (updates[UPDATES.VILLAGES]) {
                flushFarmers()
                createFarmers()
            }

            if (updates[UPDATES.LOGS]) {
                trimAndSaveLogs()
            }

            if (updates[UPDATES.INTERVAL_TIMERS]) {
                reloadTimers()
            }
        })

        farmSettings = settings.getAll()

        validGroups(IGNORE_UPDATES)
        updateGroupVillages()
        createFarmers()

        ready(function () {
            processPresets()
        }, 'presets')

        ready(function () {
            farmers.forEach(function (farmer) {
                farmer.loadTargets()
            })
        }, 'minimap_data')

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
            farmerStep(CYCLE_BEGIN)
        })

        persistentRunningUpdate()
        persistentRunningStart()

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_START)

        addLog(LOG_TYPES.FARM_START)
    }

    farmOverflow.stop = function (reason = STATUS.USER_STOP) {
        if (activeFarmer) {
            activeFarmer.stop(reason)
            
            if (reason !== STATUS.USER_STOP) {
                nextCycleDate = timeHelper.gameTime() + getCycleInterval()
            }

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_END, reason)
        } else {
            nextCycleDate = null
        }

        running = false

        stopTimers()

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
            reason: reason
        })

        persistentRunningStop()

        if (reason === STATUS.USER_STOP) {
            addLog(LOG_TYPES.FARM_STOP)
        }
    }

    farmOverflow.getFarmer = function (farmerId) {
        return farmers.find(function (farmer) {
            return farmer.getId() === farmerId
        })
    }

    farmOverflow.getFarmers = function () {
        return farmers
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

    farmOverflow.getNextCycleDate = function () {
        return nextCycleDate
    }

    farmOverflow.getCycleInterval = getCycleInterval

    return farmOverflow
})
