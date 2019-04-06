define('two/attackView', [
    'two/queue',
    'two/eventQueue',
    'two/ready',
    'models/CommandModel',
    'conf/unitTypes',
    'Lockr',
    'helper/math',
    'helper/mapconvert',
    'struct/MapData'
], function (
    Queue,
    eventQueue,
    ready,
    CommandModel,
    UNIT_TYPES,
    Lockr,
    $math,
    $convert,
    $mapData
) {
    var COLUMN_TYPES = {
        'ORIGIN_VILLAGE'    : 'origin_village_name',
        'COMMAND_TYPE'      : 'command_type',
        'TARGET_VILLAGE'    : 'target_village_name',
        'TIME_COMPLETED'    : 'time_completed',
        'COMMAND_PROGRESS'  : 'command_progress',
        'ORIGIN_CHARACTER'  : 'origin_character_name'
    }
    var COMMAND_TYPES = {
        'ATTACK': 'attack',
        'SUPPORT': 'support',
        'RELOCATE': 'relocate'
    }
    var COMMAND_ORDER = [
        'ATTACK',
        'SUPPORT',
        'RELOCATE'
    ]
    var FILTER_TYPES = {
        'COMMAND_TYPES'     : 'commandTypes',
        'VILLAGE'           : 'village',
        'INCOMING_UNITS'    : 'incomingUnits'
    }
    var UNIT_SPEED_ORDER = [
        UNIT_TYPES.LIGHT_CAVALRY,
        UNIT_TYPES.HEAVY_CAVALRY,
        UNIT_TYPES.AXE,
        UNIT_TYPES.SWORD,
        UNIT_TYPES.RAM,
        UNIT_TYPES.SNOB,
        UNIT_TYPES.TREBUCHET
    ]
    var INCOMING_UNITS_FILTER = {}

    for (var i = 0; i < UNIT_SPEED_ORDER.length; i++) {
        INCOMING_UNITS_FILTER[UNIT_SPEED_ORDER[i]] = true
    }

    var resetFilters = function () {
        filters = {}
        filters[FILTER_TYPES.COMMAND_TYPES] = angular.copy(COMMAND_TYPES)
        filters[FILTER_TYPES.VILLAGE] = false
        filters[FILTER_TYPES.INCOMING_UNITS] = angular.copy(INCOMING_UNITS_FILTER)
    }

    var initialized = false
    var listeners = {}
    var overviewService = injector.get('overviewService')
    var globalInfoModel
    var commands = []
    var filters = {}
    var params = {}
    var sorting = {
        reverse: false,
        column: COLUMN_TYPES.COMMAND_PROGRESS
    }

    var formatFilters = function formatFilters () {
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
                        if (j === 'ATTACK') {
                            arrays[toArray[i]].push(COMMAND_TYPES.ATTACK)
                        } else if (j === 'SUPPORT') {
                            arrays[toArray[i]].push(COMMAND_TYPES.SUPPORT)
                        } else if (j === 'RELOCATE') {
                            arrays[toArray[i]].push(COMMAND_TYPES.RELOCATE)
                        }
                        break
                    }
                }
            }
        }

        params = arrays
        params.village = filters[FILTER_TYPES.VILLAGE] ? [currentVillageId] : []
    }

    /**
     * Toggles the given filter.
     *
     * @param {string} type The category of the filter (see FILTER_TYPES)
     * @param {string} opt_filter The filter to be toggled.
     */
    var toggleFilter = function (type, opt_filter) {
        if (!opt_filter) {
            filters[type] = !filters[type]
        } else {
            filters[type][opt_filter] = !filters[type][opt_filter]
        }

        // format filters for the backend
        formatFilters()

        eventQueue.trigger('attackView/filtersChanged')
    }

    var toggleSorting = function (newColumn) {
        if (!COLUMN_TYPES[newColumn]) {
            return false
        }

        if (COLUMN_TYPES[newColumn] === sorting.column) {
            sorting.reverse = !sorting.reverse
        } else {
            sorting.column = COLUMN_TYPES[newColumn]
            sorting.reverse = false
        }

        eventQueue.trigger('attackView/sortingChanged')
    }

    /**
     * Command was sent.
     */
    var onCommandIncomming = function () {
        // we can never know if the command is currently visible (because of filters, sorting and stuff) -> reload
        loadCommands()
    }

    /**
     * Command was cancelled.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    var onCommandCancelled = function (event, data) {
        eventQueue.trigger('attackView/commandCancelled', [data.id || data.command_id])
    }

    /**
     * Command ignored.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    var onCommandIgnored = function (event, data) {
        for (var i = 0; i < commands.length; i++) {
            if (commands[i].command_id === data.command_id) {
                commands.splice(i, 1)
            }
        }

        eventQueue.trigger('attackView/commandIgnored', [data.command_id])
    }

    /**
     * Village name changed.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    var onVillageNameChanged = function (event, data) {
        for (var i = 0; i < commands.length; i++) {
            if (commands[i].target_village_id === data.village_id) {
                commands[i].target_village_name = data.name
                commands[i].targetVillage.name = data.name
            }
        }

        eventQueue.trigger('attackView/villageRenamed', [data])
    }

    var onVillageSwitched = function (e, newVillageId) {
        if (params[FILTER_TYPES.VILLAGE].length) {
            params[FILTER_TYPES.VILLAGE] = [newVillageId]

            loadCommands()
        }
    }

    var onFiltersChanged = function () {
        Lockr.set('attackView-filters', filters)

        loadCommands()
    }

    var onSortingChanged = function () {
        loadCommands()
    }

    /**
     * @param {Object} data The data-object from the backend
     */
    var onOverviewIncomming = function onOverviewIncomming (data) {
        commands = data.commands

        for (var i = 0; i < commands.length; i++) {
            overviewService.formatCommand(commands[i])
            commands[i].slowestUnit = getSlowestUnit(commands[i])
        }

        commands = commands.filter(function (command) {
            return filters[FILTER_TYPES.INCOMING_UNITS][command.slowestUnit]
        })

        eventQueue.trigger('attackView/commandsLoaded', [commands])
    }

    var loadCommands = function () { 
        var incomingCommands = globalInfoModel.getCommandListModel().getIncomingCommands().length
        var count = incomingCommands > 25 ? incomingCommands : 25

        socketService.emit(routeProvider.OVERVIEW_GET_INCOMING, {
            'count'         : count,
            'offset'        : 0,
            'sorting'       : sorting.column,
            'reverse'       : sorting.reverse ? 1 : 0,
            'groups'        : [],
            'command_types' : params[FILTER_TYPES.COMMAND_TYPES],
            'villages'      : params[FILTER_TYPES.VILLAGE]
        }, onOverviewIncomming)
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
                duration: Queue.getTravelTime(origin, target, units, command.command_type, {})
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

    var getCommands = function () {
        return commands
    }

    var getFilters = function () {
        return filters
    }

    var getSortings = function () {
        return sorting
    }

    var registerListeners = function () {
        listeners[eventTypeProvider.COMMAND_INCOMING] = rootScope.$on(eventTypeProvider.COMMAND_INCOMING, onCommandIncomming)
        listeners[eventTypeProvider.COMMAND_CANCELLED] = rootScope.$on(eventTypeProvider.COMMAND_CANCELLED, onCommandCancelled)
        listeners[eventTypeProvider.MAP_SELECTED_VILLAGE] = rootScope.$on(eventTypeProvider.MAP_SELECTED_VILLAGE, onVillageSwitched)
        listeners[eventTypeProvider.VILLAGE_NAME_CHANGED] = rootScope.$on(eventTypeProvider.VILLAGE_NAME_CHANGED, onVillageNameChanged)
        listeners[eventTypeProvider.COMMAND_IGNORED] = rootScope.$on(eventTypeProvider.COMMAND_IGNORED, onCommandIgnored)
    }

    var unregisterListeners = function () {
        for (var event in listeners) {
            listeners[event]()
        }
    }

    /**
     * Sort a set of villages by distance from a specified village.
     *
     * @param {Array[{x: Number, y: Number}]} villages List of village that will be sorted.
     * @param {VillageModel} origin
     * @return {Array} Sorted villages
     */
    var sortByDistance = function (villages, origin) {
        return villages.sort(function (villageA, villageB) {
            var distA = $math.actualDistance(origin, villageA)
            var distB = $math.actualDistance(origin, villageB)

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

        if ($mapData.hasTownDataInChunk(origin.x, origin.y)) {
            var sectors = $mapData.loadTownData(origin.x, origin.y, size, size, size)
            var targets = []
            var possibleTargets = []
            var closestTargets
            var barbs = []
            var own = []
            var tribe = []
            var x
            var y
            var tribeId = modelDataService.getSelectedCharacter().getTribeId()
            var playerId = modelDataService.getSelectedCharacter().getId()

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
        
        var loads = $convert.scaledGridCoordinates(origin.x, origin.y, size, size, size)
        var index = 0

        $mapData.loadTownDataAsync(origin.x, origin.y, size, size, function () {
            if (++index === loads.length) {
                closestNonHostileVillage(origin, callback)
            }
        })
    }

    /**
     * Set an automatic command with all units from the village
     * and start the CommandQueue module if it's disabled.
     *
     * @param {Object} command Data of the command like origin, target.
     * @param {String} date Date that the command has to leave.
     */
    var setQueueCommand = function (command, date) {
        closestNonHostileVillage(command.targetVillage, function (closestVillage) {
            var origin = command.targetVillage
            var target = closestVillage
            var type = target.character_id === null ? 'attack' : 'support'
            
            Queue.addCommand({
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

            if (!Queue.isRunning()) {
                Queue.start()
            }
        })
    }

    var init = function () {
        Locale.create('attackView', __attackView_locale, 'en')
        
        var defaultFilters = {}
        defaultFilters[FILTER_TYPES.COMMAND_TYPES] = angular.copy(COMMAND_TYPES)
        defaultFilters[FILTER_TYPES.INCOMING_UNITS] = angular.copy(INCOMING_UNITS_FILTER)
        defaultFilters[FILTER_TYPES.VILLAGE] = false

        initialized = true
        globalInfoModel = modelDataService.getSelectedCharacter().getGlobalInfo()
        filters = Lockr.get('attackView-filters', {}, true)
        angular.merge(filters, defaultFilters)

        ready(function () {
            formatFilters()
        }, ['initial_village'])

        eventQueue.bind('attackView/filtersChanged', onFiltersChanged)
        eventQueue.bind('attackView/sortingChanged', onSortingChanged)
    }

    return {
        init: init,
        version: '__attackView_version',
        loadCommands: loadCommands,
        getCommands: getCommands,
        getFilters: getFilters,
        getSortings: getSortings,
        toggleFilter: toggleFilter,
        toggleSorting: toggleSorting,
        FILTER_TYPES: FILTER_TYPES,
        COMMAND_TYPES: COMMAND_TYPES,
        UNIT_SPEED_ORDER: UNIT_SPEED_ORDER,
        COLUMN_TYPES: COLUMN_TYPES,
        registerListeners: registerListeners,
        unregisterListeners: unregisterListeners,
        setQueueCommand: setQueueCommand
    }
})
