define('two/farmOverflow', [
    'two/farmOverflow/Village',
    'two/farmOverflow/errorTypes',
    'two/farmOverflow/settings',
    'two/farmOverflow/settingsMap',
    'two/farmOverflow/settingsUpdate',
    'two/farmOverflow/logTypes',
    'two/utils',
    'helper/math',
    'conf/conf',
    'struct/MapData',
    'helper/mapconvert',
    'helper/time',
    'conf/gameStates',
    'Lockr',
    'queues/EventQueue'
], function (
    Village,
    ERROR_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    SETTINGS_UPDATE,
    LOG_TYPES,
    utils,
    math,
    conf,
    mapData,
    convert,
    timeHelper,
    GAME_STATES,
    Lockr,
    eventQueue
) {
    var initialized = false
    var commander = null
    var settings = {}
    var selectedTarget
    var selectedPresets = []
    var groupIgnore = false
    var groupInclude = []
    var groupOnly = []
    var ignoredVillages = []
    var includedVillages = []
    var waitingVillages = {}
    var logs = []
    var $player
    var $gameState
    var textObject = 'farm'
    var textObjectCommon = 'common'
    var STORAGE_KEYS = {
        INDEXES: 'farmoverflow_indexes',
        LOGS: 'farmoverflow_logs',
        LAST_ATTACK: 'farmoverflow_last_attack',
        LAST_ACTIVITY: 'farmoverflow_last_activity',
        SETTINGS: 'farmoverflow_settings'
    }
    var FARM_STATES = {
        ATTACKING: 'attacking',
        PAUSED: 'paused',
        NO_UNITS: 'no_units',
        NO_UNITS_NO_COMMANDS: 'no_units_no_commands',
        ATTACKING: 'attacking',
        PAUSED: 'paused',
        LOADING_TARGETS: 'loading_targets',
        ANALYSE_TARGETS: 'analyse_targets',
        COMMAND_LIMIT: 'command_limit',
        NO_VILLAGES: 'no_villages',
        STEP_CYCLE_END: 'step_cycle_end',
        STEP_CYCLE_END_NO_VILLAGES: 'step_cycle_end_no_villages',
        STEP_CYCLE_NEXT: 'step_cycle_next',
        FULL_STORAGE: 'full_storage'
    }
    var WAITING_STATES = {
        UNITS: 'units',
        COMMANDS: 'commands',
        FULL_STORAGE: 'full_storage'
    }
    var currentStatus = FARM_STATES.PAUSED

    /**
     * Expiration time for temporary data like: targets, priority list..
     * Value in seconds.
     */
    var DATA_EXPIRE_TIME = 1000 * 60 * 30

    /**
     * Interval to check if the farm is still working.
     * @see initPersistentRunning
     */
    var PERSISTENT_INTERVAL = 1000 * 60

    /**
     * Tolerance time after the last attack sent.
     */
    var PERSISTENT_TOLERANCE = 1000 * 60 * 5

    /**
     * Interval between each target renovation cycle.
     */
    var TARGETS_RELOAD_TIME = 1000 * 60 * 5

    /**
     * Villages ready to be used to send attacks.
     *
     * @type {Array<VillageModel>}
     */
    var playerVillages = []

    /**
     * Available villages to be used to farm.
     * Reseted every time that all villages are used.
     * 
     * @type {Array<VillageModel>}
     */
    var leftVillages = []

    /**
     * Current selected village used to send attacks.
     *
     * @type {VillageModel}
     */
    var selectedVillage

    /**
     * Identify if the player have a single village.
     *
     * @type {Boolean}
     */
    var singleVillage

    /**
     * Target list for each village available.
     *
     * @type {Object<Array>}
     */
    var villagesTargets = {}

    /**
     * Indicate if the farm is stopped because there's not a single village
     * avaiable to send attacks.
     */
    var globalWaiting = false

    /**
     * Store the last error event that stopped the farm.
     * Used on the status message whe the farm is manually restarted.
     */
    var lastError = ''

    /**
     * @type {Object<Array>}
     */
    var priorityTargets = {}

    /**
     * @type {Number} timestamp
     */
    var lastActivity

    /**
     * @type {Number} timestamp
     */
    var lastAttack

    /**
     * Store the index positon of the last target attacked for each village.
     *
     * @type {Object<Number>}
     */
    var targetIndexes

    /**
     * Filter loading map villages based on filter options.
     */
    var mapFilters = [
        // Village with negative id are meta villages (invite friend, deposit...)
        function metaVillages (target) {
            return target.id < 0
        },
        function ownPlayer (target) {
            return target.character_id === $player.getId()
        },
        function protectedVillage (target) {
            return !!target.attack_protection
        },
        function includedVillage (target) {
            return target.character_id && !includedVillages.includes(target.id)
        },
        function villagePoints (target) {
            return target.points < settings[SETTINGS.MIN_POINTS] || target.points > settings[SETTINGS.MAX_POINTS]
        },
        function villageDistance (target) {
            var distance = math.actualDistance(selectedVillage.position, target)
            return distance < settings[SETTINGS.MIN_DISTANCE] || distance > settings[SETTINGS.MAX_DISTANCE]
        }
    ]

    /**
     * Allow only values with more than zero units.
     * 
     * @param {Object} units
     */
    var cleanPresetUnits = function (units) {
        var pure = {}
        var unit

        for (unit in units) {
            if (units[unit] > 0) {
                pure[unit] = units[unit]
            }
        }

        return pure
    }

    var updateExceptionGroups = function () {
        if (!angular.isArray(settings[SETTINGS.GROUP_INCLUDE])) {
            console.error('groupInclude must be an Array')
            return false
        }

        if (!angular.isArray(settings[SETTINGS.GROUP_ONLY])) {
            console.error('groupOnly must be an Array')
            return false
        }

        groupIgnore = settings[SETTINGS.GROUP_IGNORE]
        groupInclude = settings[SETTINGS.GROUP_INCLUDE]
        groupOnly = settings[SETTINGS.GROUP_ONLY]
    }

    var updateExceptionVillages = function () {
        var groupList = modelDataService.getGroupList()
        var groups

        ignoredVillages = []
        includedVillages = []

        if (groupIgnore) {
            if (typeof groupIgnore !== 'number') {
                console.error('groupIgnore must be a id number')
            } else {
                ignoredVillages = groupList.getGroupVillageIds(groupIgnore)
            }
        }

        if (groupInclude.length) {
            groupInclude.forEach(function (groupId) {
                groups = groupList.getGroupVillageIds(groupId)
                includedVillages = includedVillages.concat(groups)
            })
        }
    }

    var updatePlayerVillages = function () {
        var villages = $player.getVillageList()
            .map(function (village) {
                return new Village(village)
            })
            .filter(function (village) {
                return !ignoredVillages.includes(village.id)
            })
        var groupList
        var groupVillages

        if (groupOnly.length) {
            groupList = modelDataService.getGroupList()
            groupVillages = []

            groupOnly.forEach(function (groupId) {
                groupVillages = groupVillages.concat(groupList.getGroupVillageIds(groupId))
            })

            villages = villages.filter(function (village) {
                return groupVillages.includes(village.id)
            })
        }

        playerVillages = villages
        singleVillage = playerVillages.length === 1
        selectedVillage = playerVillages[0]

        // If a village that wasn't in the available list before
        // is now included. The farm start the attacks imediatelly.
        if (commander.running && globalWaiting) {
            villages.some(function (village) {
                if (!waitingVillages[village.id]) {
                    globalWaiting = false
                    commander.analyse()

                    return true
                }
            })
        }

        eventQueue.trigger(eventTypeProvider.FARM_VILLAGES_UPDATE)
    }

    var convertListPresets = function (presetsArray) {
        var presets = {}

        presetsArray.forEach(function (preset) {
            presets[preset.id] = preset
        })

        return presets
    }

    /**
     * Get the list of presets (load from the server, if necessary)
     * and update/populate the selectedPresets variable.
     */
    var updatePresets = function (callback) {
        var update = function (presetsObj) {
            selectedPresets = []

            if (!settings[SETTINGS.PRESETS].length) {
                if (callback) {
                    callback()
                }

                return
            }

            settings[SETTINGS.PRESETS].forEach(function (presetId) {
                selectedPresets.push({
                    id: presetId,
                    units: cleanPresetUnits(presetsObj[presetId].units)
                })
            })

            if (callback) {
                callback()
            }
        }

        if (modelDataService.getPresetList().isLoaded()) {
            update(modelDataService.getPresetList().getPresets())
        } else {
            socketService.emit(routeProvider.GET_PRESETS, {}, function (data) {
                eventQueue.trigger(eventTypeProvider.FARM_PRESETS_LOADED)
                update(convertListPresets(data.presets))
            })
        }
    }

    var reportListener = function () {
        var reportQueue = []

        /**
         * Add the target to the ignore list if the village is a
         * active target for some of the player's village that are
         * being used to farm.
         *
         * @param {Object} report
         */
        var ignoredTargetHandler = function (report) {
            var target = targetExists(report.target_village_id)

            if (!target) {
                return false
            }

            ignoreVillage(target)

            return true
        }

        /**
         * Check if the report has full haul and add the target to
         * the priority list.
         *
         * @param {Object} reportInfo
         */
        var priorityHandler = function (reportInfo) {
            getReport(reportInfo.id, function (data) {
                var attack = data.ReportAttack
                var vid = attack.attVillageId
                var tid = attack.defVillageId

                if (!priorityTargets.hasOwnProperty(vid)) {
                    priorityTargets[vid] = []
                }

                if (priorityTargets[vid].includes(tid)) {
                    return false
                }

                priorityTargets[vid].push(tid)

                eventQueue.trigger(eventTypeProvider.FARM_PRIORITY_TARGET_ADDED, {
                    id: tid,
                    name: attack.defVillageName,
                    x: attack.defVillageX,
                    y: attack.defVillageY
                })
            })
        }

        /**
         * Check all delayed priority reports.
         */
        var delayedPriorityHandler = function () {
            reportQueue.forEach(function (report) {
                priorityHandler(report)
            })

            reportQueue = []
        }

        /**
         * Check all attack reports while the farm is running.
         * 
         * @param {Object} data.
         */
        var reportHandler = function (event, data) {
            if (!commander.running || data.type !== 'attack') {
                return false
            }

            // data.result === 1 === 'nocasualties'
            if (settings[SETTINGS.IGNORE_ON_LOSS] && data.result !== 1) {
                ignoredTargetHandler(data)
            }

            if (settings[SETTINGS.PRIORITY_TARGETS] && data.haul === 'full') {
                if (windowManagerService.isTemplateOpen('report')) {
                    reportQueue.push(data)
                } else {
                    priorityHandler(data)
                }
            }
        }

        /**
         * Run all delayed handlers.
         *
         * Some reports are added to the delayed list because
         * the script can't read reports if the the have the 
         * report window opened.
         */
        var delayedReportHandler = function (event, templateName) {
            if (templateName === 'report') {
                delayedPriorityHandler()
            }
        }

        $rootScope.$on(eventTypeProvider.REPORT_NEW, reportHandler)
        $rootScope.$on(eventTypeProvider.WINDOW_CLOSED, delayedReportHandler)
    }

    var messageListener = function () {
        /**
         * Check messages related to the remote controller.
         */
        var remoteHandler = function (event, data) {
            var id = settings[SETTINGS.REMOTE_ID]
            var userMessage

            if (data.participants.length !== 1 || data.title !== id) {
                return false
            }

            userMessage = data.message.content.trim().toLowerCase()

            switch (userMessage) {
            case 'on':
            case 'start':
            case 'init':
            case 'begin':
                farmOverflow.restart()

                sendMessageReply(data.message_id, genStatusReply())
                eventQueue.trigger(eventTypeProvider.FARM_REMOTE_COMMAND, ['on'])

                break
            case 'off':
            case 'stop':
            case 'pause':
            case 'end':
                farmOverflow.pause()

                sendMessageReply(data.message_id, genStatusReply())
                eventQueue.trigger(eventTypeProvider.FARM_REMOTE_COMMAND, ['off'])

                break
            case 'status':
            case 'current':
                sendMessageReply(data.message_id, genStatusReply())
                eventQueue.trigger(eventTypeProvider.FARM_REMOTE_COMMAND, ['status'])

                break
            }

            return false
        }

        $rootScope.$on(eventTypeProvider.MESSAGE_SENT, remoteHandler)
    }

    var presetListener = function () {
        var updatePresetsHandler = function () {
            updatePresets()
            eventQueue.trigger(eventTypeProvider.FARM_PRESETS_CHANGE)

            if (commander.running) {
                var hasPresets = !!selectedPresets.length

                if (hasPresets) {
                    if (globalWaiting) {
                        resetWaitingVillages()
                        farmOverflow.restart()
                    }
                } else {
                    eventQueue.trigger(eventTypeProvider.FARM_NO_PRESET)
                    farmOverflow.pause()
                }
            }
        }

        $rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, updatePresetsHandler)
        $rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, updatePresetsHandler)
    }

    var groupListener = function () {
        var groupChangeHandler = function () {
            updateExceptionGroups()
            updateExceptionVillages()

            eventQueue.trigger(eventTypeProvider.FARM_GROUPS_CHANGED)
        }

        /**
         * Detect groups added to villages and update
         * the included villages list.
         */
        var groupLinkHandler = function (event, data) {
            updatePlayerVillages()

            if (!groupInclude.length) {
                return false
            }

            if (groupInclude.includes(data.group_id)) {
                villagesTargets = {}
            }
        }

        $rootScope.$on(eventTypeProvider.GROUPS_UPDATED, groupChangeHandler)
        $rootScope.$on(eventTypeProvider.GROUPS_CREATED, groupChangeHandler)
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, groupChangeHandler)
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_LINKED, groupLinkHandler)
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_UNLINKED, groupLinkHandler)
    }

    var villageListener = function () {
        /**
         * Remove a village from the wait list and restart the
         * cycle if needed.
         */
        var freeVillage = function (vid) {
            delete waitingVillages[vid]

            if (globalWaiting) {
                globalWaiting = false

                if (settings[SETTINGS.STEP_CYCLE]) {
                    return false
                }

                if (commander.running) {
                    selectVillage(vid)
                    commander.analyse()
                }
            }
        }

        /**
         * Detect village army changes and remove the village
         * of the wait list.
         */
        var armyChangeHandler = function (event, data) {
            var vid = data.village_id
            var reason = waitingVillages[vid] || false

            if (reason === 'units' || reason === 'commands') {
                freeVillage(vid)

                return false
            }
        }

        /**
         * Detect village resource changes and add/remove the village
         * from the wait list depending on if the storage is full.
         */
        var resourceChangeHandler = function (event, data) {
            var vid = data.villageId
            var reason = waitingVillages[vid] || false
            var village

            if (reason === WAITING_STATES.FULL_STORAGE) {
                freeVillage(vid)
            } else {
                village = getVillageById(vid)

                if (isFullStorage(village)) {
                    setWaitingVillage(vid, WAITING_STATES.FULL_STORAGE)
                }
            }
        }

        $rootScope.$on(eventTypeProvider.VILLAGE_ARMY_CHANGED, armyChangeHandler)
        $rootScope.$on(eventTypeProvider.VILLAGE_RESOURCES_CHANGED, resourceChangeHandler)
    }

    var generalListeners = function () {
        var reconnectHandler = function () {
            if (commander.running) {
                setTimeout(function () {
                    farmOverflow.restart()
                }, 5000)
            }
        }

        // Load map data when called.
        // Run when the method mapData.loadTownDataAsync is called.
        //
        // Is it still necessary?
        mapData.setRequestFn(function (args) {
            socketService.emit(routeProvider.MAP_GETVILLAGES, args)
        })

        $rootScope.$on(eventTypeProvider.RECONNECT, reconnectHandler)
    }

    var addEventLog = function (data) {
        if (!data) {
            return false
        }

        logs.unshift(data)
        setLogs(logs)
        eventQueue.trigger(eventTypeProvider.FARM_LOGS_UPDATED)
    }

    var bindEvents = function () {
        eventQueue.register(eventTypeProvider.FARM_SEND_COMMAND, function (event, data) {
            updateLastAttack()
            updateCurrentStatus(FARM_STATES.ATTACKING)

            var origin = data[0]
            var target = data[1]

            addEventLog({
                icon: 'attack-small',
                origin: {id: origin.id, coords: `${origin.x}|${origin.y}`},
                target: {id: target.id, coords: `${target.x}|${target.y}`},
                type: LOG_TYPES.ATTACK,
                time: timeHelper.gameTime()
            })
        })

        eventQueue.register(eventTypeProvider.FARM_NEXT_VILLAGE, function (event, village) {
            addEventLog({
                icon: 'village',
                village: {id: village.id, coords: `${village.x}|${village.y}`},
                type: LOG_TYPES.VILLAGE_SWITCH,
                time: timeHelper.gameTime()
            })
        })

        eventQueue.register(eventTypeProvider.FARM_PRIORITY_TARGET_ADDED, function (event, village) {
            addEventLog({
                icon: 'parallel-recruiting',
                type: LOG_TYPES.PRIORITY_TARGET,
                village: {id: village.id, coords: `${village.x}|${village.y}`},
                time: timeHelper.gameTime()
            })
        })

        eventQueue.register(eventTypeProvider.FARM_IGNORED_VILLAGE, function (event, village) {
            addEventLog({
                icon: 'check-negative',
                type: LOG_TYPES.IGNORED_VILLAGE,
                village: {id: village.id, coords: `${village.x}|${village.y}`},
                time: timeHelper.gameTime()
            })
        })

        eventQueue.register(eventTypeProvider.FARM_NO_PRESET, function () {
            updateCurrentStatus(FARM_STATES.PAUSED)

            addEventLog({
                icon: 'village',
                type: LOG_TYPES.NO_PRESET,
                time: timeHelper.gameTime()
            })
        })

        eventQueue.register(eventTypeProvider.FARM_NO_UNITS, function () {
            updateCurrentStatus(FARM_STATES.NO_UNITS)
        })

        eventQueue.register(eventTypeProvider.FARM_NO_UNITS_NO_COMMANDS, function () {
            updateCurrentStatus(FARM_STATES.NO_UNITS_NO_COMMANDS)
        })

        eventQueue.register(eventTypeProvider.FARM_START, function () {
            updateCurrentStatus(FARM_STATES.ATTACKING)
        })

        eventQueue.register(eventTypeProvider.FARM_PAUSE, function () {
            updateCurrentStatus(FARM_STATES.PAUSED)
        })

        eventQueue.register(eventTypeProvider.FARM_LOADING_TARGETS_START, function () {
            updateCurrentStatus(FARM_STATES.LOADING_TARGETS)
        })

        eventQueue.register(eventTypeProvider.FARM_LOADING_TARGETS_END, function () {
            updateCurrentStatus(FARM_STATES.ANALYSE_TARGETS)
        })

        eventQueue.register(eventTypeProvider.FARM_COMMAND_LIMIT_SINGLE, function () {
            updateCurrentStatus(FARM_STATES.COMMAND_LIMIT)
        })

        eventQueue.register(eventTypeProvider.FARM_COMMAND_LIMIT_MULTI, function () {
            updateCurrentStatus(FARM_STATES.NO_VILLAGES)
        })

        eventQueue.register(eventTypeProvider.FARM_STEP_CYCLE_END, function () {
            updateCurrentStatus(FARM_STATES.STEP_CYCLE_END)
        })

        eventQueue.register(eventTypeProvider.FARM_STEP_CYCLE_END_NO_VILLAGES, function () {
            updateCurrentStatus(FARM_STATES.STEP_CYCLE_END_NO_VILLAGES)
        })

        eventQueue.register(eventTypeProvider.FARM_STEP_CYCLE_NEXT, function () {
            updateCurrentStatus(FARM_STATES.STEP_CYCLE_NEXT)
        })

        eventQueue.register(eventTypeProvider.FARM_FULL_STORAGE, function () {
            updateCurrentStatus(FARM_STATES.FULL_STORAGE)
        })
    }

    var updateLastAttack = function () {
        lastAttack = timeHelper.gameTime()
        Lockr.set(STORAGE_KEYS.LAST_ATTACK, lastAttack)
    }

    var getVillageById = function (vid) {
        var i = playerVillages.indexOf(vid)

        return i !== -1 ? playerVillages[i] : false
    }

    var selectVillage = function (vid) {
        var village = getVillageById(vid)

        if (village) {
            selectedVillage = village

            return true
        }

        return false
    }

    var assignPresets = function (presetIds, callback) {
        socketService.emit(routeProvider.ASSIGN_PRESETS, {
            village_id: selectedVillage.id,
            preset_ids: presetIds
        }, callback)
    }

    /**
     * @param {Object} target
     */
    var ignoreVillage = function (target) {
        if (!groupIgnore) {
            return false
        }

        socketService.emit(routeProvider.GROUPS_LINK_VILLAGE, {
            group_id: groupIgnore,
            village_id: target.id
        }, function () {
            eventQueue.trigger(eventTypeProvider.FARM_IGNORED_VILLAGE, target)
        })
    }

    /**
     * Check if the village is a target of some village
     * being used to farm.
     */
    var targetExists = function (targetId) {
        var vid
        var villageTargets
        var i
        var target

        for (vid in villagesTargets) {
            villageTargets = villagesTargets[vid]

            for (i = 0; i < villageTargets.length; i++) {
                target = villageTargets[i]

                if (target.id === targetId) {
                    return target
                }
            }
        }

        return false
    }

    var resetWaitingVillages = function () {
        waitingVillages = {}
    }

    /*
     * Check if the last attack sent by the farm already is beyond
     * the determined tolerance time. So it can restart the attacks
     * if necessary.
     *
     * This is necessary because sometimes the game stop
     * responding to .emit socket calls and stop the attacks,
     * making the farm freeze in 'started' state.
     *
     * Not sure if it is a problem caused by connection
     * or a internal bug of the game.
     */
    var initPersistentRunning = function () {
        setInterval(function () {
            if (commander.running) {
                var gameTime = timeHelper.gameTime()
                var passedTime = gameTime - lastAttack
                var toleranceTime = PERSISTENT_TOLERANCE

                // If the step cycle setting is enabled, increase
                // the tolerance time with the interval time between
                // the cycles.
                if (settings[SETTINGS.STEP_CYCLE] && cycle.intervalEnabled()) {
                    toleranceTime += (settings[SETTINGS.STEP_CYCLE_INTERVAL] * 60) + (1000 * 60)
                }

                if (passedTime > toleranceTime) {
                    farmOverflow.pause()
                    farmOverflow.start()
                }
            }
        }, PERSISTENT_INTERVAL)
    }

    /**
     * Reset the target list everytime avoiding attack to villages
     * conquered by other players.
     */
    var initTargetsProof = function () {
        setInterval(function () {
            villagesTargets = {}
        }, TARGETS_RELOAD_TIME)
    }

    var getReport = function (reportId, callback) {
        socketService.emit(routeProvider.REPORT_GET, {
            id: reportId
        }, callback)
    }

    var sendMessageReply = function (message_id, message) {
        socketService.emit(routeProvider.MESSAGE_REPLY, {
            message_id: message_id,
            message: message
        })
    }

    /**
     * Generate the message body for the remote control messages.
     *
     * @return {String}
     */
    var genStatusReply = function () {
        var localeStatus = $filter('i18n')('status', $rootScope.loc.ale, textObjectCommon)
        var localeVillage = $filter('i18n')('selected_village', $rootScope.loc.ale, textObject)
        var localeLast = $filter('i18n')('last_attack', $rootScope.loc.ale, textObject)
        var statusReplace = null
        var next
        var farmStatus
        var villageLabel = utils.genVillageLabel(selectedVillage)
        var last = utils.formatDate(lastAttack)
        var vid = selectedVillage.id
        var message = []

        if (currentStatus === FARM_STATES.STEP_CYCLE_NEXT) {
            next = timeHelper.gameTime() + (settings[SETTINGS.STEP_CYCLE_INTERVAL] * 60)
            statusReplace = utils.formatDate(next)
        }

        farmStatus = $filter('i18n')(currentStatus, $rootScope.loc.ale, textObject, statusReplace)
        
        message.push(`[b]${localeStatus}:[/b] ${farmStatus}[br]`)
        message.push(`[b]${localeVillage}:[/b] `)
        message.push(`[village=${vid}]${villageLabel}[/village][br]`)
        message.push(`[b]${localeLast}:[/b] ${last}`)

        return message.join('')
    }

    /**
     * Check if the farm was idle for a determited period of time.
     *
     * @return {Boolean}
     */
    var isExpiredData = function () {
        var now = timeHelper.gameTime()
        var cycleInterval = settings[SETTINGS.STEP_CYCLE_INTERVAL] * 60

        if (settings[SETTINGS.STEP_CYCLE] && cycle.intervalEnabled()) {
            if (now > (lastActivity + cycleInterval + (60 * 1000))) {
                return true
            }
        } else if (now > lastActivity + DATA_EXPIRE_TIME) {
            return true
        }

        return false
    }

    /**
     * @param {Number} x - X-coord.
     * @param {Number} y - Y-coord.
     * @param {Number} w - Width. Limit: 50
     * @param {Number} h - Height. Limit: 50
     * @param {Function} callback
     */
    var loadMapSectors = function (x, y, w, h, chunk, callback) {
        var sectors
        var loads
        var length
        var index

        if (mapData.hasTownDataInChunk(x, y)) {
            sectors = mapData.loadTownData(x, y, w, h, chunk)

            return callback(sectors)
        }

        eventQueue.trigger(eventTypeProvider.FARM_LOADING_TARGETS_START)

        loads = convert.scaledGridCoordinates(x, y, w, h, chunk)
        length = loads.length
        index = 0

        mapData.loadTownDataAsync(x, y, w, h, function () {
            if (++index === length) {
                eventQueue.trigger(eventTypeProvider.FARM_LOADING_TARGETS_END)
                sectors = mapData.loadTownData(x, y, w, h, chunk)

                callback(sectors)
            }
        })
    }

    /**
     * @param {Number} sectors
     * @return {Array} List of all sector villages.
     */
    var parseMapSector = function (sectors) {
        var i = sectors.length
        var villages = []
        var sector
        var sectorDataX
        var sx
        var sectorDataY
        var sy
        var village

        while (i--) {
            sector = sectors[i]
            sectorDataX = sector.data

            for (sx in sectorDataX) {
                sectorDataY = sectorDataX[sx]

                for (sy in sectorDataY) {
                    village = sectorDataY[sy]
                    villages.push(village)
                }
            }
        }

        return villages
    }

    var filterTargets = function (targets) {
        return targets.filter(function (target) {
            return mapFilters.every(function (fn) {
                return !fn(target)
            })
        })
    }

    /**
     * Convert the village in objects with only the necessary data.
     * 
     * @param {Array} targets
     * @return {Array}.
     */
    var parseTargets = function (targets) {
        var processedTargets = []
        var origin = selectedVillage.position
        var target
        var i

        for (i = 0; i < targets.length; i++) {
            target = targets[i]
            
            processedTargets.push({
                x: target.x,
                y: target.y,
                distance: math.actualDistance(origin, target),
                id: target.id,
                name: target.name,
                pid: target.character_id
            })
        }

        return processedTargets
    }

    /**
     * Load the local settings and merge with the defaults.
     */
    var loadSettings = function () {
        var localSettings = Lockr.get(STORAGE_KEYS.SETTINGS, {}, true)
        var key

        for (key in SETTINGS_MAP) {
            settings[key] = localSettings.hasOwnProperty(key)
                ? localSettings[key]
                : SETTINGS_MAP[key].default
        }
    }

    var updateCurrentStatus = function (status) {
        currentStatus = status
        eventQueue.trigger(eventTypeProvider.FARM_STATUS_CHANGE, status)
    }

    var getFreeVillages = function () {
        return playerVillages.filter(function (village) {
            if (waitingVillages[village.id]) {
                return false
            } else if (settings[SETTINGS.IGNORE_FULL_STORAGE]) {
                if (isFullStorage(village)) {
                    waitingVillages[village.id] = WAITING_STATES.FULL_STORAGE
                    return false
                }
            }

            return true
        })
    }

    var setWaitingVillage = function (id, _reason) {
        waitingVillages[id] = _reason || true
    }

    var setLogs = function (newLogs) {
        if (newLogs.length > settings[SETTINGS.LOGS_LIMIT]) {
            newLogs = newLogs.slice(0, settings[SETTINGS.LOGS_LIMIT])
        }

        logs = newLogs
        Lockr.set(STORAGE_KEYS.LOGS, logs)
    }

    var isFullStorage = function (_village) {
        var village = _village || selectedVillage
        var resources
        var computed
        var maxStorage

        if (village.original.isReady()) {
            resources = village.original.getResources()
            computed = resources.getComputed()
            maxStorage = resources.getMaxStorage()

            return ['wood', 'clay', 'iron'].every(function (res) {
                return computed[res].currentStock === maxStorage
            })
        }

        return false
    }

    var createCommander = function () {
        commander = new Commander()
    }

    /**
     * Stop commander without stopping the whole farm.
     */
    var breakCommander = function () {
        clearTimeout(commander.timeoutId)
        commander.running = false
    }

    var updateActivity = function () {
        lastActivity = timeHelper.gameTime()
        Lockr.set(STORAGE_KEYS.LAST_ACTIVITY, lastActivity)
    }

    /**
     * @param {Boolean=} _selectOnly - Only select the current target.
     */
    var nextTarget = function (_selectOnly) {
        var sid = selectedVillage.id
        var villageTargets
        var priorityId
        var i
        var index
        var changed
        var target

        if (!villagesTargets[sid]) {
            commander.analyse()

            return false
        }

        villageTargets = villagesTargets[sid]

        if (settings[SETTINGS.PRIORITY_TARGETS] && priorityTargets[sid]) {
            priorityId

            while (priorityId = priorityTargets[sid].shift()) {
                if (ignoredVillages.includes(priorityId)) {
                    continue
                }

                for (i = 0; i < villageTargets.length; i++) {
                    if (villageTargets[i].id === priorityId) {
                        selectedTarget = villageTargets[i]

                        return true
                    }
                }
            }
        }

        index = targetIndexes[sid]
        changed = false

        if (!_selectOnly) {
            index = ++targetIndexes[sid]
        }

        for (; index < villageTargets.length; index++) {
            target = villageTargets[index]

            if (ignoredVillages.includes(target.id)) {
                eventQueue.trigger(eventTypeProvider.FARM_IGNORED_TARGET, [target])

                continue
            }

            selectedTarget = target
            changed = true

            break
        }

        if (changed) {
            targetIndexes[sid] = index
        } else {
            selectedTarget = villageTargets[0]
            targetIndexes[sid] = 0
        }

        Lockr.set(STORAGE_KEYS.INDEXES, targetIndexes)

        return true
    }

    var hasTarget = function () {
        var sid = selectedVillage.id
        var index = targetIndexes[sid]
        var targets = villagesTargets[sid]

        if (!targets.length) {
            return false
        }

        // Check if the index was not reseted by idleness.
        // Check if the target in the index exists. Happens when
        // the number of targets is reduced by settings when
        // the farm is not running.
        if (index === undefined || index > targets.length) {
            targetIndexes[sid] = index = 0
        }

        return !!targets[index]
    }

    var getTargets = function (callback) {
        var origin = selectedVillage.position
        var sid = selectedVillage.id
        var chunk = conf.MAP_CHUNK_SIZE
        var x = origin.x - chunk
        var y = origin.y - chunk
        var w = chunk * 2
        var h = chunk * 2
        var listedTargets
        var filteredTargets
        var processedTargets
        var hasVillages

        if (sid in villagesTargets) {
            return callback()
        }

        loadMapSectors(x, y, w, h, chunk, function (sectors) {
            listedTargets = parseMapSector(sectors)
            filteredTargets = filterTargets(listedTargets)
            processedTargets = parseTargets(filteredTargets)

            if (processedTargets.length === 0) {
                hasVillages = nextVillage()

                if (hasVillages) {
                    getTargets(callback)
                } else {
                    eventQueue.trigger(eventTypeProvider.FARM_NO_TARGETS)
                }

                return false
            }

            villagesTargets[sid] = processedTargets.sort(function (a, b) {
                return a.distance - b.distance
            })

            if (targetIndexes.hasOwnProperty(sid)) {
                if (targetIndexes[sid] > villagesTargets[sid].length) {
                    targetIndexes[sid] = 0

                    Lockr.set(STORAGE_KEYS.INDEXES, targetIndexes)
                }
            } else {
                targetIndexes[sid] = 0

                Lockr.set(STORAGE_KEYS.INDEXES, targetIndexes)
            }

            callback()
        })
    }

    var nextVillage = function () {
        var next
        var availVillage

        if (singleVillage) {
            return false
        }

        if (settings[SETTINGS.STEP_CYCLE]) {
            return cycle.nextVillage()
        }

        if (next = leftVillages.shift()) {
            availVillage = getFreeVillages().some(function (freeVillage) {
                return freeVillage.id === next.id
            })

            if (availVillage) {
                selectedVillage = next
                eventQueue.trigger(eventTypeProvider.FARM_NEXT_VILLAGE, selectedVillage)
                updateActivity()

                return true
            } else {
                return nextVillage()
            }
        } else {
            leftVillages = getFreeVillages()

            if (leftVillages.length) {
                return nextVillage()
            }

            if (singleVillage) {
                eventQueue.trigger(eventTypeProvider.FARM_NO_UNITS)
            } else {
                eventQueue.trigger(eventTypeProvider.FARM_NO_VILLAGES)
            }

            return false
        }
    }

    var checkPresets = function (callback) {
        if (!selectedPresets.length) {
            farmOverflow.pause()
            eventQueue.trigger(eventTypeProvider.FARM_NO_PRESET)

            return false
        }

        var vid = selectedVillage.id
        var villagePresets = modelDataService.getPresetList().getPresetsByVillageId(vid)
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

            assignPresets(which, callback)
        } else {
            callback()
        }
    }

    var targetsLoaded = function () {
        return villagesTargets.hasOwnProperty(selectedVillage.id)
    }

    var isWaiting = function () {
        return waitingVillages.hasOwnProperty(selectedVillage.id)
    }

    var isIgnored = function () {
        return ignoredVillages.includes(selectedVillage.id)
    }

    var isAllWaiting = function () {
        var i
        var vid

        for (i = 0; i < playerVillages.length; i++) {
            vid = playerVillages[i].id

            if (!waitingVillages.hasOwnProperty(vid)) {
                return false
            }
        }

        return true
    }

    var Commander = (function () {
        var lastCommand = false

        /**
         * Control the cycle of commands, sending attacks, changing village and targets.
         */
        function Commander () {
            /**
             * Store the next event (no_units/command_limit) to prevent the execution
             * of the next command.
             * Needed because the internal values of the game do not sync with the server,
             * causing errors like no_units/command_limit.
             * 
             * @type {String|Boolean}
             */
            this.preventNextCommand = false

            /**
             * Timeout id used on interval of each attack.
             * Needed to stop delayed attacks when the farm is manually stopped.
             * 
             * @type {Number}
             */
            this.timeoutId = null

            /**
             * @type {Boolean}
             */
            this.running = false

            return this
        }

        Commander.prototype.analyse = function () {
            var preset

            if (!this.running) {
                return
            }

            if (!selectedPresets.length) {
                farmOverflow.pause()
                eventQueue.trigger(eventTypeProvider.FARM_NO_PRESET)

                return
            }

            if (!selectedVillage) {
                return eventQueue.trigger(eventTypeProvider.FARM_NO_VILLAGE_SELECTED)
            }

            if (!selectedVillage.loaded()) {
                selectedVillage.load(() => {
                    this.analyse()
                })

                return
            }

            if (isWaiting() || isIgnored()) {
                if (nextVillage()) {
                    this.analyse()
                } else {
                    eventQueue.trigger(lastError)
                }

                return
            }

            if (settings[SETTINGS.IGNORE_FULL_STORAGE] && isFullStorage()) {
                if (nextVillage()) {
                    this.analyse()
                } else {
                    this.handleError(ERROR_TYPES.FULL_STORAGE)
                }

                return
            }

            if (!targetsLoaded()) {
                return getTargets(() => {
                    this.analyse()
                })
            }

            if (hasTarget()) {
                nextTarget(true)
            } else {
                if (nextVillage()) {
                    this.analyse()
                } else {
                    eventQueue.trigger(eventTypeProvider.FARM_NO_TARGETS)
                }

                return
            }

            checkPresets(() => {
                if (selectedVillage.countCommands() >= settings[SETTINGS.COMMANDS_PER_VILLAGE]) {
                    return this.handleError(ERROR_TYPES.COMMAND_LIMIT)
                }

                preset = this.getPreset()

                if (preset.error) {
                    return this.handleError(preset.error)
                }

                this.getPresetNext(preset)
                this.send(preset)
            })
        }

        /**
         * @param {String} error - error id
         */
        Commander.prototype.handleError = function (error) {
            lastError = error || this.preventNextCommand
            this.preventNextCommand = false

            var sid = selectedVillage.id
            var singleVillage
            var allWaiting
            var eventType

            switch (lastError) {
            case ERROR_TYPES.TIME_LIMIT:
                nextTarget()
                this.analyse()

                break
            case ERROR_TYPES.NO_UNITS:
                eventQueue.trigger(eventTypeProvider.FARM_NO_UNITS, [selectedVillage])
                setWaitingVillage(sid, WAITING_STATES.UNITS)

                if (singleVillage) {
                    if (selectedVillage.countCommands() === 0) {
                        eventQueue.trigger(eventTypeProvider.FARM_NO_UNITS_NO_COMMANDS)
                    } else {
                        globalWaiting = true

                        if (settings[SETTINGS.STEP_CYCLE]) {
                            cycle.endStep()
                        }
                    }

                    return
                }

                if (nextVillage()) {
                    this.analyse()
                } else {
                    globalWaiting = true
                }

                break
            case ERROR_TYPES.COMMAND_LIMIT:
                setWaitingVillage(sid, WAITING_STATES.COMMANDS)

                allWaiting = isAllWaiting()

                if (singleVillage || allWaiting) {
                    eventType = singleVillage
                        ? eventTypeProvider.FARM_COMMAND_LIMIT_SINGLE
                        : eventTypeProvider.FARM_COMMAND_LIMIT_MULTI

                    eventQueue.trigger(eventType, [selectedVillage])
                    globalWaiting = true

                    if (settings[SETTINGS.STEP_CYCLE]) {
                        return cycle.endStep()
                    }
                }

                nextVillage()
                this.analyse()

                break
            case ERROR_TYPES.FULL_STORAGE:
                setWaitingVillage(sid, WAITING_STATES.FULL_STORAGE)

                if (singleVillage) {
                    globalWaiting = true

                    if (settings[SETTINGS.STEP_CYCLE]) {
                        return cycle.endStep()
                    }

                    eventQueue.trigger(eventTypeProvider.FARM_FULL_STORAGE)
                }

                break
            }
        }

        /**
         * Get the preset with enough units and with the limits of the max time travel.
         *
         * @param {Object} [_units] Analyse these units instead of the units of the
         *                          selected village.
         * @return {Object} preset or error.
         */
        Commander.prototype.getPreset = function (_units) {
            var timeLimit = false
            var units = _units || selectedVillage.units
            var selectedPreset = false
            var avail
            var unit
            
            selectedPresets.forEach((preset) => {
                if (selectedPreset) {
                    return false
                }

                avail = true

                for (unit in preset.units) {
                    if (units[unit].in_town < preset.units[unit]) {
                        avail = false
                    }
                }

                if (avail) {
                    if (this.checkPresetTime(preset)) {
                        selectedPreset = preset
                    } else {
                        timeLimit = true
                    }
                }
            })

            if (selectedPreset) {
                return selectedPreset
            }

            return {
                error: timeLimit ? ERROR_TYPES.TIME_LIMIT : ERROR_TYPES.NO_UNITS
            }
        }

        /**
         * Verifica a condição das tropas na aldeia do proximo comando.
         * Beforehand check the conditions of the units of the village of the
         * next command.
         *
         * @param {Object} presetUsed
         */
        Commander.prototype.getPresetNext = function (presetUsed) {
            var unitsCopy = angular.copy(selectedVillage.units)
            var unitsUsed = presetUsed.units
            var unit
            var result

            for (unit in unitsUsed) {
                unitsCopy[unit].in_town -= unitsUsed[unit]
            }

            result = this.getPreset(unitsCopy)

            if (result.error) {
                this.preventNextCommand = result.error
            }
        }

        /**
         * Check if the preset's travel time of the origin village all the way to
         * the target do not get max time travel setting.
         *
         * @param {Object} preset
         */
        Commander.prototype.checkPresetTime = function (preset) {
            var limitTime = settings[SETTINGS.MAX_TRAVEL_TIME] * 60
            var villagePosition = selectedVillage.position
            var distance = math.actualDistance(villagePosition, selectedTarget)
            var travelTime = armyService.calculateTravelTime(preset, {
                barbarian: !selectedTarget.pid,
                officers: false
            })
            var totalTravelTime = armyService.getTravelTimeForDistance(
                preset,
                travelTime,
                distance,
                'attack'
            )

            return limitTime > totalTravelTime
        }

        /**
         * @param {Object} preset
         * @param {Function} callback
         */
        Commander.prototype.send = function (preset, callback) {
            var now = Date.now()
            var unbindError
            var unbindSend
            var interval

            if (lastCommand && now - lastCommand < 100) {
                return false
            } else {
                lastCommand = now
            }

            if (!this.running) {
                return false
            }

            this.simulate()

            // For some reason the list of commands of some villages
            // do not sync with the commands registered on the server,
            // so we check by ourselves and update the local commands
            // if needed and restart the analyses.
            unbindError = this.onCommandError(() => {
                unbindSend()

                selectedVillage.updateCommands(() => {
                    this.analyse()
                })
            })

            unbindSend = this.onCommandSend(() => {
                unbindError()
                nextTarget()

                // Minimum of 1 second to allow the interval values get updated.
                interval = utils.randomSeconds(settings[SETTINGS.RANDOM_BASE])
                interval = 100 + (interval * 1000)

                this.timeoutId = setTimeout(() => {
                    if (this.preventNextCommand) {
                        return this.handleError()
                    }

                    this.analyse()
                }, interval)

                updateActivity()
            })

            socketService.emit(routeProvider.SEND_PRESET, {
                start_village: selectedVillage.id,
                target_village: selectedTarget.id,
                army_preset_id: preset.id,
                type: 'attack'
            })

            return true
        }

        /**
         * Called after the confirmation of units changing on the village.
         */
        Commander.prototype.onCommandSend = function (callback) {
            var before = angular.copy(selectedVillage.units)
            var now
            var equals
            var unbind = $rootScope.$on(eventTypeProvider.VILLAGE_UNIT_INFO, function (event, data) {
                if (selectedVillage.id !== data.village_id) {
                    return false
                }

                now = selectedVillage.units
                equals = angular.equals(before, now)

                if (equals) {
                    return false
                }

                eventQueue.trigger(eventTypeProvider.FARM_SEND_COMMAND, [
                    selectedVillage,
                    selectedTarget
                ])

                unbind()
                callback()
            })

            return unbind
        }

        /**
         * Called after an error when trying to send a command.
         */
        Commander.prototype.onCommandError = function (callback) {
            var unbind = $rootScope.$on(eventTypeProvider.MESSAGE_ERROR, function (event, data) {
                if (!data.cause || !data.code) {
                    return false
                }

                if (data.cause !== 'Command/sendPreset') {
                    return false
                }

                if (data.code !== 'Command/attackLimitExceeded') {
                    return false
                }

                eventQueue.trigger(eventTypeProvider.FARM_SEND_COMMAND_ERROR, [data.code])

                unbind()
                callback()
            })

            return unbind
        }

        /**
         * Simulate some requisitions made by the game when commands
         * are sent manually.
         *
         * @param {Function} callback
         */
        Commander.prototype.simulate = function (callback) {
            var attackingFactor = function () {
                socketService.emit(routeProvider.GET_ATTACKING_FACTOR, {
                    target_id: selectedTarget.id
                })
            }

            attackingFactor()

            if (callback) {
                callback()
            }
        }

        return Commander
    })()

    var cycle = (function () {
        var villageList = []

        /**
         * Used to avoid sendind attacks after the farm being
         * manually stopped.
         * 
         * @type {Number}
         */
        var timeoutId = null

        /**
         * Exported object.
         */
        var cycle = {}

        cycle.intervalEnabled = function () {
            return !!settings[SETTINGS.STEP_CYCLE_INTERVAL]
        }

        cycle.startContinuous = function (_manual) {
            commander = new Commander()
            commander.running = true

            eventQueue.trigger(eventTypeProvider.FARM_START, _manual)

            if (!getFreeVillages().length) {
                if (singleVillage) {
                    if (isFullStorage()) {
                        eventQueue.trigger(eventTypeProvider.FARM_FULL_STORAGE)
                    } else {
                        eventQueue.trigger(eventTypeProvider.FARM_NO_UNITS)
                    }
                } else {
                    eventQueue.trigger(eventTypeProvider.FARM_NO_VILLAGES)
                }

                return
            }

            leftVillages = getFreeVillages()
            commander.analyse()
        }

        /**
         * The step cycle mode use all available villages only one time.
         *
         * @param  {Boolean} _manual - if true, the restart notification will
         *      not show.
         */
        cycle.startStep = function (_manual) {
            var freeVillages = getFreeVillages()

            commander = new Commander()
            commander.running = true
            
            eventQueue.trigger(eventTypeProvider.FARM_START, _manual)

            if (freeVillages.length === 0) {
                eventQueue.trigger(eventTypeProvider.FARM_STEP_CYCLE_NEXT_NO_VILLAGES)

                if (cycle.intervalEnabled()) {
                    cycle.setNextCycle()
                } else {
                    farmOverflow.pause(_manual)
                }

                return
            }

            if (!_manual) {
                eventQueue.trigger(eventTypeProvider.FARM_STEP_CYCLE_RESTART)
            }

            villageList = freeVillages
            commander.analyse()
        }

        cycle.endStep = function () {
            if (cycle.intervalEnabled()) {
                eventQueue.trigger(eventTypeProvider.FARM_STEP_CYCLE_NEXT)
                breakCommander()
                cycle.setNextCycle()
            } else {
                eventQueue.trigger(eventTypeProvider.FARM_STEP_CYCLE_END)
                farmOverflow.pause()
            }

            return false
        }

        cycle.setNextCycle = function () {
            timeoutId = setTimeout(function () {
                cycle.startStep()
            }, settings[SETTINGS.STEP_CYCLE_INTERVAL] * 60)
        }

        cycle.nextVillage = function () {
            var next = villageList.shift()
            var availVillage

            if (next) {
                availVillage = getFreeVillages().some(function (free) {
                    return free.id === next.id
                })

                if (!availVillage) {
                    return cycle.nextVillage()
                }
            } else {
                return cycle.endStep()
            }

            selectedVillage = next
            eventQueue.trigger(eventTypeProvider.FARM_NEXT_VILLAGE, next)

            return true
        }

        cycle.getTimeoutId = function () {
            return timeoutId
        }

        return cycle
    })()

    var farmOverflow = {}

    farmOverflow.init = function () {
        initialized = true
        $player = modelDataService.getSelectedCharacter()
        $gameState = modelDataService.getGameState()
        logs = Lockr.get(STORAGE_KEYS.LOGS, [], true)
        lastActivity = Lockr.get(STORAGE_KEYS.LAST_ACTIVITY, timeHelper.gameTime(), true)
        lastAttack = Lockr.get(STORAGE_KEYS.LAST_ATTACK, -1, true)
        targetIndexes = Lockr.get(STORAGE_KEYS.INDEXES, {}, true)
        commander = new Commander()
        loadSettings()
        updateExceptionGroups()
        updateExceptionVillages()
        updatePlayerVillages()
        updatePresets()
        reportListener()
        messageListener()
        groupListener()
        presetListener()
        villageListener()
        generalListeners()
        bindEvents()
        initPersistentRunning()
        initTargetsProof()
    }

    farmOverflow.start = function (_manual) {
        if (!selectedPresets.length) {
            eventQueue.trigger(eventTypeProvider.FARM_ERROR, [ERROR_TYPES.PRESET_FIRST, _manual])
            return ERROR_TYPES.PRESET_FIRST
        }

        if (!selectedVillage) {
            eventQueue.trigger(eventTypeProvider.FARM_ERROR, ERROR_TYPES.NO_SELECTED_VILLAGE, _manual)
            return ERROR_TYPES.NO_SELECTED_VILLAGE
        }

        if (!$gameState.getGameState(GAME_STATES.ALL_VILLAGES_READY)) {
            var unbind = $rootScope.$on(eventTypeProvider.GAME_STATE_ALL_VILLAGES_READY, function () {
                unbind()
                farmOverflow.start(_manual)
            })

            return false
        }

        if (isExpiredData()) {
            priorityTargets = {}
            targetIndexes = {}
        }

        if (settings[SETTINGS.STEP_CYCLE]) {
            cycle.startStep(_manual)
        } else {
            cycle.startContinuous(_manual)
        }

        updateActivity()

        return true
    }

    farmOverflow.pause = function (_manual) {
        breakCommander()

        eventQueue.trigger(eventTypeProvider.FARM_PAUSE, _manual)
        clearTimeout(cycle.getTimeoutId())

        return true
    }

    farmOverflow.restart = function (_manual) {
        farmOverflow.pause(_manual)
        farmOverflow.start(_manual)
    }

    farmOverflow.switchState = function (_manual) {
        if (commander.running) {
            farmOverflow.pause(_manual)
        } else {
            farmOverflow.start(_manual)
        }
    }

    /**
     * Update the internal settings and reload the necessary
     * information.
     *
     * @param {Object} changes
     */
    farmOverflow.updateSettings = function (changes) {
        var modify = {}
        var settingMap
        var newValue
        var vid
        var key

        for (key in changes) {
            settingMap = SETTINGS_MAP[key]
            newValue = changes[key]

            if (!settingMap || newValue === settings[key]) {
                continue
            }

            settingMap.updates.forEach(function (modifier) {
                modify[modifier] = true
            })

            settings[key] = newValue
        }

        Lockr.set(STORAGE_KEYS.SETTINGS, settings)

        if (modify[SETTINGS_UPDATE.GROUPS]) {
            updateExceptionGroups()
            updateExceptionVillages()
        }

        if (modify[SETTINGS_UPDATE.VILLAGES]) {
            updatePlayerVillages()
        }

        if (modify[SETTINGS_UPDATE.PRESET]) {
            updatePresets()
            resetWaitingVillages()
        }

        if (modify[SETTINGS_UPDATE.TARGETS]) {
            villagesTargets = {}
        }

        if (modify[SETTINGS_UPDATE.LOGS]) {
            // used to slice the event list in case the limit of logs
            // have been reduced.
            setLogs(logs)
            eventQueue.trigger(eventTypeProvider.FARM_RESET_LOGS)
        }

        if (modify[SETTINGS_UPDATE.FULL_STORAGE]) {
            for (vid in waitingVillages) {
                if (waitingVillages[vid] === WAITING_STATES.FULL_STORAGE) {
                    delete waitingVillages[vid]
                }
            }
        }

        if (modify[SETTINGS_UPDATE.WAITING_VILLAGES]) {
            for (vid in waitingVillages) {
                if (waitingVillages[vid] === WAITING_STATES.COMMANDS) {
                    delete waitingVillages[vid]
                }
            }
        }

        if (commander.running) {
            farmOverflow.restart()
        }

        eventQueue.trigger(eventTypeProvider.FARM_SETTINGS_CHANGE, [modify])

        return true
    }

    farmOverflow.isInitialized = function () {
        return initialized
    }

    farmOverflow.isRunning = function () {
        return !!commander.running
    }

    farmOverflow.getLogs = function () {
        return logs
    }

    farmOverflow.clearLogs = function () {
        logs = []
        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.FARM_LOGS_RESETED)
    }

    farmOverflow.getSelectedVillage = function () {
        return selectedVillage
    }

    farmOverflow.getLastAttack = function () {
        return lastAttack
    }

    farmOverflow.getCurrentStatus = function () {
        return currentStatus
    }

    farmOverflow.getSettings = function () {
        return settings
    }

    return farmOverflow
})
