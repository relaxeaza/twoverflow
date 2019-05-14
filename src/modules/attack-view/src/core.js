define('two/attackView', [
    'queues/EventQueue',
    'two/ready',
    'two/utils',
    'models/CommandModel',
    'Lockr',
    'helper/math',
    'helper/mapconvert',
    'struct/MapData',
    'conf/unitTypes',
    'two/attackView/columnTypes',
    'two/attackView/commandTypes',
    'two/attackView/filterTypes',
    'two/attackView/unitSpeedOrder'
], function (
    eventQueue,
    ready,
    utils,
    CommandModel,
    Lockr,
    $math,
    $convert,
    $mapData,
    UNIT_TYPES,
    COLUMN_TYPES,
    COMMAND_TYPES,
    FILTER_TYPES,
    UNIT_SPEED_ORDER
) {
    var initialized = false
    var listeners = {}
    var overviewService = injector.get('overviewService')
    var globalInfoModel
    var commands = []
    var commandQueue
    var commandQueueEnabled = false
    var filters = {}
    var filterParams = {}
    var sorting = {
        reverse: false,
        column: COLUMN_TYPES.TIME_COMPLETED
    }
    var COMMAND_ORDER = [
        'ATTACK',
        'SUPPORT',
        'RELOCATE'
    ]
    var STORAGE_ID = {
        FILTERS: 'attack_view_filters'
    }
    var INCOMING_UNITS_FILTER = {}
    var COMMAND_TYPES_FILTER = {}

    var resetFilters = function () {
        filters = {}
        filters[FILTER_TYPES.COMMAND_TYPES] = {}
        filters[FILTER_TYPES.VILLAGE] = angular.copy(COMMAND_TYPES_FILTER)
        filters[FILTER_TYPES.INCOMING_UNITS] = angular.copy(INCOMING_UNITS_FILTER)
    }

    var formatFilters = function () {
        var toArray = [FILTER_TYPES.COMMAND_TYPES]
        var currentVillageId = modelDataService.getSelectedVillage().getId()
        var arrays = {}
        var i
        var j

        // format filters for backend
        for (i = 0; i < toArray.length; i++) {
            for (j in filters[toArray[i]]) {
                if (!arrays[toArray[i]]) {
                    arrays[toArray[i]] = []
                }

                if (filters[toArray[i]][j]) {
                    switch (toArray[i]) {
                    case FILTER_TYPES.COMMAND_TYPES:
                        if (j === COMMAND_TYPES.ATTACK) {
                            arrays[toArray[i]].push(COMMAND_TYPES.ATTACK)
                        } else if (j === COMMAND_TYPES.SUPPORT) {
                            arrays[toArray[i]].push(COMMAND_TYPES.SUPPORT)
                        } else if (j === COMMAND_TYPES.RELOCATE) {
                            arrays[toArray[i]].push(COMMAND_TYPES.RELOCATE)
                        }
                        break
                    }
                }
            }
        }

        filterParams = arrays
        filterParams.village = filters[FILTER_TYPES.VILLAGE] ? [currentVillageId] : []
    }

    /**
     * Command was sent.
     */
    var onCommandIncomming = function () {
        // we can never know if the command is currently visible (because of filters, sorting and stuff) -> reload
        attackView.loadCommands()
    }

    /**
     * Command was cancelled.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    var onCommandCancelled = function (event, data) {
        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_COMMAND_CANCELLED, [data.id || data.command_id])
    }

    /**
     * Command ignored.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    var onCommandIgnored = function (event, data) {
        var i

        for (i = 0; i < commands.length; i++) {
            if (commands[i].command_id === data.command_id) {
                commands.splice(i, 1)
            }
        }

        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_COMMAND_IGNORED, [data.command_id])
    }

    /**
     * Village name changed.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    var onVillageNameChanged = function (event, data) {
        var i

        for (i = 0; i < commands.length; i++) {
            if (commands[i].target_village_id === data.village_id) {
                commands[i].target_village_name = data.name
                commands[i].targetVillage.name = data.name
            } else if (commands[i].origin_village_id === data.village_id) {
                commands[i].origin_village_name = data.name
                commands[i].originVillage.name = data.name
            }
        }

        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_VILLAGE_RENAMED, [data])
    }

    var onVillageSwitched = function (e, newVillageId) {
        if (filterParams[FILTER_TYPES.VILLAGE].length) {
            filterParams[FILTER_TYPES.VILLAGE] = [newVillageId]

            attackView.loadCommands()
        }
    }

    /**
     * @param {CommandModel} command
     * @return {String} Slowest unit
     */
    var getSlowestUnit = function (command) {
        var commandDuration = command.model.duration
        var units = {}
        var origin = { x: command.origin_x, y: command.origin_y }
        var target = { x: command.target_x, y: command.target_y }
        var travelTimes = []

        UNIT_SPEED_ORDER.forEach(function (unit) {
            units[unit] = 1
            
            travelTimes.push({
                unit: unit,
                duration: utils.getTravelTime(origin, target, units, command.command_type, {})
            })
        })

        travelTimes = travelTimes.map(function (travelTime) {
            travelTime.duration = Math.abs(travelTime.duration - commandDuration)
            return travelTime
        }).sort(function (a, b) {
            return a.duration - b.duration
        })

        return travelTimes[0].unit
    }

    /**
     * Sort a set of villages by distance from a specified village.
     *
     * @param {Array[{x: Number, y: Number}]} villages List of village that will be sorted.
     * @param {VillageModel} origin
     * @return {Array} Sorted villages
     */
    var sortByDistance = function (villages, origin) {
        var distA
        var distB

        return villages.sort(function (villageA, villageB) {
            distA = $math.actualDistance(origin, villageA)
            distB = $math.actualDistance(origin, villageB)

            return distA - distB
        })
    }

    /**
     * Order:
     * - Barbarian villages.
     * - Own villages.
     * - Tribe villages.
     *
     * @param {VillageModel} origin
     * @param {Function} callback
     */
    var closestNonHostileVillage = function (origin, callback) {
        var size = 25
        var sectors
        var targets
        var possibleTargets
        var closestTargets
        var barbs
        var own
        var tribe
        var x
        var y
        var tribeId
        var playerId
        var loads
        var index = 0

        if ($mapData.hasTownDataInChunk(origin.x, origin.y)) {
            sectors = $mapData.loadTownData(origin.x, origin.y, size, size, size)
            targets = []
            possibleTargets = []
            closestTargets
            barbs = []
            own = []
            tribe = []
            tribeId = modelDataService.getSelectedCharacter().getTribeId()
            playerId = modelDataService.getSelectedCharacter().getId()

            sectors.forEach(function (sector) {
                for (x in sector.data) {
                    for (y in sector.data[x]) {
                        targets.push(sector.data[x][y])
                    }
                }
            })


            barbs = targets.filter(function (target) {
                return target.character_id === null && target.id > 0
            })

            own = targets.filter(function (target) {
                return target.character_id === playerId && origin.id !== target.id
            })

            if (tribeId) {
                tribe = targets.filter(function (target) {
                    return tribeId && target.tribe_id === tribeId
                })
            }

            if (barbs.length) {
                closestTargets = sortByDistance(barbs, origin)
            } else if (own.length) {
                closestTargets = sortByDistance(own, origin)
            } else if (tribe.length) {
                closestTargets = sortByDistance(tribe, origin)
            } else {
                return callback(false)
            }

            return callback(closestTargets[0])
        }
        
        loads = $convert.scaledGridCoordinates(origin.x, origin.y, size, size, size)

        $mapData.loadTownDataAsync(origin.x, origin.y, size, size, function () {
            if (++index === loads.length) {
                closestNonHostileVillage(origin, callback)
            }
        })
    }

    /**
     * @param {Object} data The data-object from the backend
     */
    var onOverviewIncomming = function (data) {
        var i

        commands = data.commands

        for (i = 0; i < commands.length; i++) {
            overviewService.formatCommand(commands[i])
            commands[i].slowestUnit = getSlowestUnit(commands[i])
        }

        commands = commands.filter(function (command) {
            return filters[FILTER_TYPES.INCOMING_UNITS][command.slowestUnit]
        })

        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_COMMANDS_LOADED, [commands])
    }

    var attackView = {}

    attackView.loadCommands = function () { 
        var incomingCommands = globalInfoModel.getCommandListModel().getIncomingCommands().length
        var count = incomingCommands > 25 ? incomingCommands : 25

        socketService.emit(routeProvider.OVERVIEW_GET_INCOMING, {
            'count': count,
            'offset': 0,
            'sorting': sorting.column,
            'reverse': sorting.reverse ? 1 : 0,
            'groups': [],
            'command_types': filterParams[FILTER_TYPES.COMMAND_TYPES],
            'villages': filterParams[FILTER_TYPES.VILLAGE]
        }, onOverviewIncomming)
    }

    attackView.getCommands = function () {
        return commands
    }

    attackView.getFilters = function () {
        return filters
    }

    attackView.getSortings = function () {
        return sorting
    }

    /**
     * Toggles the given filter.
     *
     * @param {string} type The category of the filter (see FILTER_TYPES)
     * @param {string} opt_filter The filter to be toggled.
     */
    attackView.toggleFilter = function (type, opt_filter) {
        if (!opt_filter) {
            filters[type] = !filters[type]
        } else {
            filters[type][opt_filter] = !filters[type][opt_filter]
        }

        // format filters for the backend
        formatFilters()
        Lockr.set(STORAGE_ID.FILTERS, filters)
        attackView.loadCommands()
    }

    attackView.toggleSorting = function (newColumn) {
        if (newColumn === sorting.column) {
            sorting.reverse = !sorting.reverse
        } else {
            sorting.column = newColumn
            sorting.reverse = false
        }

        attackView.loadCommands()
    }

    /**
     * Set an automatic command with all units from the village
     * and start the CommandQueue module if it's disabled.
     *
     * @param {Object} command Data of the command like origin, target.
     * @param {String} date Date that the command has to leave.
     */
    attackView.setCommander = function (command, date) {
        var origin
        var target
        var type

        closestNonHostileVillage(command.targetVillage, function (closestVillage) {
            origin = command.targetVillage
            target = closestVillage
            type = target.character_id === null ? 'attack' : 'support'
            
            commandQueue.addCommand({
                origin: origin,
                target: target,
                date: date,
                dateType: 'out',
                units: {
                    spear: '*',
                    sword: '*',
                    axe: '*',
                    archer: '*',
                    light_cavalry: '*',
                    mounted_archer: '*',
                    heavy_cavalry: '*',
                    ram: '*',
                    catapult: '*',
                    snob: '*',
                    knight: '*',
                    doppelsoldner: '*',
                    trebuchet: '*'
                },
                officers: {},
                type: type,
                catapultTarget: 'wall'
            })

            if (!commandQueue.isRunning()) {
                commandQueue.start()
            }
        })
    }

    attackView.commandQueueEnabled = function () {
        return commandQueueEnabled
    }

    attackView.init = function () {
        var defaultFilters
        var i

        for (i = 0; i < UNIT_SPEED_ORDER.length; i++) {
            INCOMING_UNITS_FILTER[UNIT_SPEED_ORDER[i]] = true
        }

        for (i in COMMAND_TYPES) {
            COMMAND_TYPES_FILTER[COMMAND_TYPES[i]] = true
        }

        try {
            commandQueue = require('two/queue')
            commandQueueEnabled = !!commandQueue
        } catch (e) {}

        defaultFilters = {}
        defaultFilters[FILTER_TYPES.COMMAND_TYPES] = angular.copy(COMMAND_TYPES_FILTER)
        defaultFilters[FILTER_TYPES.INCOMING_UNITS] = angular.copy(INCOMING_UNITS_FILTER)
        defaultFilters[FILTER_TYPES.VILLAGE] = false

        initialized = true
        globalInfoModel = modelDataService.getSelectedCharacter().getGlobalInfo()
        filters = Lockr.get(STORAGE_ID.FILTERS, defaultFilters, true)

        ready(function () {
            formatFilters()
        }, ['initial_village'])

        $rootScope.$on(eventTypeProvider.COMMAND_INCOMING, onCommandIncomming)
        $rootScope.$on(eventTypeProvider.COMMAND_CANCELLED, onCommandCancelled)
        $rootScope.$on(eventTypeProvider.MAP_SELECTED_VILLAGE, onVillageSwitched)
        $rootScope.$on(eventTypeProvider.VILLAGE_NAME_CHANGED, onVillageNameChanged)
        $rootScope.$on(eventTypeProvider.COMMAND_IGNORED, onCommandIgnored)

        attackView.loadCommands()
    }

    return attackView
})
