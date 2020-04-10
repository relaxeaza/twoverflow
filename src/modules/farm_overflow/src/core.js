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

    const updatePresets = function () {
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
        const limit = settings.get(SETTINGS.LOGS_LIMIT)

        if (logs.length > limit) {
            logs.splice(logs.length - limit, logs.length)
        }

        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED)
    }

    const getPreset = function (village, target) {
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

    const genPresetList = function (villageId) {
        const villagePresets = modelDataService.getPresetList().getPresetsByVillageId(villageId)
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

        if (reason !== ERROR_TYPES.USER_STOP) {
            this.onCycleEndFn(reason)
        }

        clearTimeout(targetTimeoutId)
        this.onCycleEndFn = noop
    }

    Farmer.prototype.targetStep = async function (options = {}) {
        const commandList = this.village.getCommandListModel()
        const villageCommands = commandList.getOutgoingCommands(true, true)
        let preset
        let delayTime = 0
        let target
        let checkedLocalCommands = false

        const checkCommandLimit = () => {
            const limit = VILLAGE_COMMAND_LIMIT - settings.get(SETTINGS.PRESERVE_COMMAND_SLOTS)

            if (villageCommands.length >= limit) {
                throw STATUS.COMMAND_LIMIT
            }
        }

        const checkStorage = () => {
            if (settings.get(SETTINGS.IGNORE_FULL_STORAGE)) {
                const resources = this.village.getResources()
                const computed = resources.getComputed()
                const maxStorage = resources.getMaxStorage()
                const isFull = ['wood', 'clay', 'iron'].every((type) => computed[type].currentStock === maxStorage)

                if (isFull) {
                    throw STATUS.FULL_STORAGE
                }
            }
        }

        const checkTargets = () => {
            if (!this.targets.length) {
                throw STATUS.NO_TARGETS
            }

            if (this.index > this.targets.length || !this.targets[this.index]) {
                throw STATUS.TARGET_CYCLE_END
            }
        }

        const checkVillagePresets = () => {
            return new Promise((resolve) => {
                const neededPresets = genPresetList(this.villageId)

                if (neededPresets) {
                    assignPresets(this.villageId, neededPresets, resolve)
                } else {
                    resolve()
                }
            })
        }

        const checkPreset = () => {
            target = this.targets[this.index]

            if (!target) {
                throw STATUS.UNKNOWN
            }

            preset = getPreset(this.village, target)

            if (typeof preset === 'string') {
                throw preset
            }
        }

        const checkTarget = () => {
            return new Promise((resolve) => {
                socketService.emit(routeProvider.GET_ATTACKING_FACTOR, {
                    target_id: target.id
                }, (data) => {
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
        }

        const checkLocalCommands = () => {
            let otherVillageAttacking = false

            const multipleFarmers = settings.get(SETTINGS.TARGET_MULTIPLE_FARMERS)
            const singleAttack = settings.get(SETTINGS.TARGET_SINGLE_ATTACK)
            const playerVillages = $player.getVillageList()
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

            const attacking = villageCommands.some((command) => {
                return command.data.target.id === target.id && command.data.direction === 'forward'
            })

            if (isTargetBusy(attacking, otherVillageAttacking, allVillagesLoaded)) {
                throw STATUS.BUSY_TARGET
            }

            if (allVillagesLoaded) {
                checkedLocalCommands = true
            }
        }

        const checkTargetPoints = () => {
            return new Promise((resolve) => {
                $mapData.getTownAtAsync(target.x, target.y, (data) => {
                    if (villageFilters.points(data.points)) {
                        throw STATUS.NOT_ALLOWED_POINTS
                    }

                    resolve()
                })
            })
        }

        const checkLoadedCommands = () => {
            return new Promise((resolve) => {
                if (checkedLocalCommands) {
                    return resolve()
                }

                socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
                    my_village_id: this.villageId,
                    village_id: target.id,
                    num_reports: 0
                }, (data) => {
                    const targetCommands = data.commands.own.filter((command) => command.type === COMMAND_TYPES.TYPES.ATTACK && command.direction === 'forward')
                    const multipleFarmers = settings.get(SETTINGS.TARGET_MULTIPLE_FARMERS)
                    const singleAttack = settings.get(SETTINGS.TARGET_SINGLE_ATTACK)
                    const otherAttacking = targetCommands.some((command) => command.start_village_id !== this.villageId)
                    const attacking = targetCommands.some((command) => command.start_village_id === this.villageId)

                    if (isTargetBusy(attacking, otherAttacking, true)) {
                        throw STATUS.BUSY_TARGET
                    }

                    resolve()
                })
            })
        }

        const prepareAttack = () => {
            if (options.delay) {
                delayTime = settings.get(SETTINGS.ATTACK_INTERVAL) * 1000

                if (delayTime < MINIMUM_ATTACK_INTERVAL) {
                    delayTime = MINIMUM_ATTACK_INTERVAL
                }

                delayTime = utils.randomSeconds(delayTime)
            }

            this.setStatus(STATUS.ATTACKING)

            targetTimeoutId = setTimeout(() => {
                if (!this.running) {
                    return
                }

                sendingCommand = true
                currentTarget = target
                this.index++

                socketService.emit(routeProvider.SEND_PRESET, {
                    start_village: this.villageId,
                    target_village: target.id,
                    army_preset_id: preset.id,
                    type: COMMAND_TYPES.TYPES.ATTACK
                })
            }, delayTime)
        }

        try {
            await checkCommandLimit()
            await checkStorage()
            await checkTargets()
            await checkVillagePresets()
            await checkPreset()
            await checkTarget()
            await checkLocalCommands()
            await checkTargetPoints()
            await checkLoadedCommands()
            await prepareAttack()
        } catch (error) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STEP_ERROR, {
                villageId: this.villageId,
                error: error
            })

            this.index++

            switch (error) {
            case STATUS.TIME_LIMIT:
            case STATUS.BUSY_TARGET:
            case STATUS.ABANDONED_CONQUERED:
            case STATUS.PROTECTED_VILLAGE:
                this.setStatus(error)
                this.targetStep(options)
                break

            case STATUS.NOT_ALLOWED_POINTS:
                this.setStatus(error)
                farmOverflow.removeTarget(target.id)
                this.targetStep(options)
                break

            case STATUS.NO_UNITS:
            case STATUS.NO_TARGETS:
            case STATUS.FULL_STORAGE:
            case STATUS.COMMAND_LIMIT:
                this.setStatus(error)
                this.stop(error)
                break

            case STATUS.TARGET_CYCLE_END:
                this.setStatus(error)
                this.stop(error)
                this.index = 0
                break

            default:
                this.setStatus(STATUS.UNKNOWN)
                this.stop(STATUS.UNKNOWN)
                break
            }
        }
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

        this.targetStep({
            delay: true
        })
    }

    Farmer.prototype.commandError = function (data) {
        sendingCommand = false
        currentTarget = false

        this.stop(STATUS.COMMAND_ERROR)
    }

    Farmer.prototype.onCycleEnd = function (handler) {
        this.onCycleEndFn = handler
    }

    Farmer.prototype.loadTargets = function (callback) {
        const pos = this.village.getPosition()

        mapData.load(pos, (loadedTargets) => {
            this.targets = calcDistances(loadedTargets, pos)
            this.targets = filterTargets(this.targets, pos)
            this.targets = sortTargets(this.targets)

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
            let villageId = farmer.getId()

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
        return farmers.find(function (farmer) {
            return farmer.getId() === farmerId
        })
    }

    farmOverflow.getFarmers = function () {
        return farmers
    }

    farmOverflow.removeFarmer = function (farmerId) {
        for (let i = 0; i < farmers.length; i++) {
            if (farmers[i].getId() === farmerId) {
                farmers[i].stop(ERROR_TYPES.KILL_FARMER)
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

        if (activeFarmer) {
            activeFarmer.onCycleEnd(function () {
                farmerIndex++
                farmOverflow.farmerStep()
            })
            
            activeFarmer.start()
        } else {
            let interval = settings.get(SETTINGS.FARMER_CYCLE_INTERVAL) * 60 * 1000

            if (interval < MINIMUM_ATTACK_INTERVAL) {
                interval = MINIMUM_FARMER_CYCLE_INTERVAL
            }

            farmerTimeoutId = setTimeout(function () {
                farmerTimeoutId = null
                farmerIndex = 0
                farmOverflow.farmerStep()
            }, interval)
        }
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
