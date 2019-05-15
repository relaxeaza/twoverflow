define('two/commandQueue', [
    'two/utils',
    'two/commandQueue/dateTypes',
    'two/commandQueue/eventCodes',
    'two/commandQueue/filterTypes',
    'two/commandQueue/commandTypes',
    'queues/EventQueue',
    'helper/time',
    'helper/math',
    'struct/MapData',
    'Lockr'
], function (
    utils,
    DATE_TYPES,
    EVENT_CODES,
    FILTER_TYPES,
    COMMAND_TYPES,
    eventQueue,
    timeHelper,
    $math,
    mapData,
    Lockr
) {
    var CHECKS_PER_SECOND = 10
    var ERROR_CODES = {
        INVALID_ORIGIN: 'invalid_rigin',
        INVALID_TARGET: 'invalid_target'
    }
    var STORAGE_KEYS = {
        QUEUE_COMMANDS: 'commander_queue_commands',
        QUEUE_SENT: 'commander_queue_sent',
        QUEUE_EXPIRED: 'commander_queue_expired'
    }
    var waitingCommands = []
    var waitingCommandsObject = {}
    var sentCommands = []
    var expiredCommands = []
    var running = false
    var $player
    var timeOffset

    var commandFilters = {
        [FILTER_TYPES.SELECTED_VILLAGE]: function (command) {
            return command.origin.id === modelDataService.getSelectedVillage().getId()
        },
        [FILTER_TYPES.BARBARIAN_TARGET]: function (command) {
            return !command.target.character_id
        },
        [FILTER_TYPES.ALLOWED_TYPES]: function (command, options) {
            return options[FILTER_TYPES.ALLOWED_TYPES][command.type]
        },
        [FILTER_TYPES.ATTACK]: function (command) {
            return command.type !== COMMAND_TYPES.ATTACK
        },
        [FILTER_TYPES.SUPPORT]: function (command) {
            return command.type !== COMMAND_TYPES.SUPPORT
        },
        [FILTER_TYPES.RELOCATE]: function (command) {
            return command.type !== COMMAND_TYPES.RELOCATE
        },
        [FILTER_TYPES.TEXT_MATCH]: function (command, options) {
            var show = true
            var keywords = options[FILTER_TYPES.TEXT_MATCH].toLowerCase().split(/\W/)

            var searchString = [
                command.origin.name,
                command.origin.x + '|' + command.origin.y,
                command.origin.character_name || '',
                command.target.name,
                command.target.x + '|' + command.target.y,
                command.target.character_name || '',
                command.target.tribe_name || '',
                command.target.tribe_tag || ''
            ]

            searchString = searchString.join('').toLowerCase()

            keywords.some(function (keyword) {
                if (keyword.length && !searchString.includes(keyword)) {
                    show = false
                    return true
                }
            })

            return show
        }
    }

    var isTimeToSend = function (sendTime) {
        return sendTime < (timeHelper.gameTime() + timeOffset)
    }

    /**
     * Remove os zeros das unidades passadas pelo jogador.
     * A razão de remover é por que o próprio não os envia
     * quando os comandos são enviados manualmente, então
     * caso seja enviado as unidades com valores zero poderia
     * ser uma forma de detectar os comandos automáticos.
     *
     * @param  {Object} units - Unidades a serem analisadas
     * @return {Object} Objeto sem nenhum valor zero
     */
    var cleanZeroUnits = function (units) {
        var cleanUnits = {}

        for (var unit in units) {
            var amount = units[unit]

            if (amount === '*' || amount !== 0) {
                cleanUnits[unit] = amount
            }
        }

        return cleanUnits
    }

    var sortWaitingQueue = function () {
        waitingCommands = waitingCommands.sort(function (a, b) {
            return a.sendTime - b.sendTime
        })
    }

    var pushWaitingCommand = function (command) {
        waitingCommands.push(command)
    }

    var pushCommandObject = function (command) {
        waitingCommandsObject[command.id] = command
    }

    var pushSentCommand = function (command) {
        sentCommands.push(command)
    }

    var pushExpiredCommand = function (command) {
        expiredCommands.push(command)
    }

    var storeWaitingQueue = function () {
        Lockr.set('queue-commands', waitingCommands)
    }

    var storeSentQueue = function () {
        Lockr.set('queue-sent', sentCommands)
    }

    var storeExpiredQueue = function () {
        Lockr.set('queue-expired', expiredCommands)
    }

    var loadStoredCommands = function () {
        var storedQueue = Lockr.get('queue-commands', [], true)

        if (storedQueue.length) {
            for (var i = 0; i < storedQueue.length; i++) {
                var command = storedQueue[i]

                if (timeHelper.gameTime() > command.sendTime) {
                    commandQueue.expireCommand(command, EVENT_CODES.TIME_LIMIT)
                } else {
                    waitingCommandHelpers(command)
                    pushWaitingCommand(command)
                    pushCommandObject(command)
                }
            }
        }
    }

    var waitingCommandHelpers = function (command) {
        if (command.hasOwnProperty('countdown')) {
            return false
        }

        command.countdown = function () {
            return timeHelper.readableMilliseconds(Date.now() - command.sendTime)
        }
    }

    var parseDynamicUnits = function (command) {
        var playerVillages = modelDataService.getVillages()
        var village = playerVillages[command.origin.id]

        if (!village) {
            return EVENT_CODES.NOT_OWN_VILLAGE
        }

        var villageUnits = village.unitInfo.units
        var parsedUnits = {}

        for (var unit in command.units) {
            var amount = command.units[unit]

            if (amount === '*') {
                amount = villageUnits[unit].available

                if (amount === 0) {
                    continue
                }
            } else if (amount < 0) {
                amount = villageUnits[unit].available - Math.abs(amount)

                if (amount < 0) {
                    return EVENT_CODES.NOT_ENOUGH_UNITS
                }
            } else if (amount > 0) {
                if (amount > villageUnits[unit].available) {
                    return EVENT_CODES.NOT_ENOUGH_UNITS
                }
            }

            parsedUnits[unit] = amount
        }

        if (angular.equals({}, parsedUnits)) {
            return EVENT_CODES.NOT_ENOUGH_UNITS
        }

        return parsedUnits
    }

    var listenCommands = function () {
        setInterval(function () {
            if (!waitingCommands.length) {
                return
            }

            waitingCommands.some(function (command) {
                if (isTimeToSend(command.sendTime)) {
                    if (running) {
                        commandQueue.sendCommand(command)
                    } else {
                        commandQueue.expireCommand(command, EVENT_CODES.TIME_LIMIT)
                    }
                } else {
                    return true
                }
            })
        }, 1000 / CHECKS_PER_SECOND)
    }

    var commandQueue = {
        initialized: false
    }

    commandQueue.init = function () {
        timeOffset = utils.getTimeOffset()
        $player = modelDataService.getSelectedCharacter()

        commandQueue.initialized = true

        sentCommands = Lockr.get('queue-sent', [], true)
        expiredCommands = Lockr.get('queue-expired', [], true)

        loadStoredCommands()
        listenCommands()

        window.addEventListener('beforeunload', function (event) {
            if (running && waitingCommands.length) {
                event.returnValue = true
            }
        })
    }

    commandQueue.sendCommand = function (command) {
        var units = parseDynamicUnits(command)

        // units === EVENT_CODES.*
        if (typeof units === 'string') {
            return commandQueue.expireCommand(command, units)
        }

        command.units = units

        socketService.emit(routeProvider.SEND_CUSTOM_ARMY, {
            start_village: command.origin.id,
            target_village: command.target.id,
            type: command.type,
            units: command.units,
            icon: 0,
            officers: command.officers,
            catapult_target: command.catapultTarget
        })

        pushSentCommand(command)
        storeSentQueue()

        commandQueue.removeCommand(command, EVENT_CODES.COMMAND_SENT)
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND, command)
    }

    commandQueue.expireCommand = function (command, eventCode) {
        pushExpiredCommand(command)
        storeExpiredQueue()

        commandQueue.removeCommand(command, eventCode)
    }

    /**
     * UPDATE THIS SHIT BELOW
     *
     * @param {Object} command
     * @param {String} command.origin - Coordenadas da aldeia de origem.
     * @param {String} command.target - Coordenadas da aldeia alvo.
     * @param {String} command.date - Data e hora que o comando deve chegar.
     * @param {String} command.dateType - Indica se o comando vai sair ou
     *   chegar na data especificada.
     * @param {Object} command.units - Unidades que serão enviados pelo comando.
     * @param {Object} command.officers - Oficiais que serão enviados pelo comando.
     * @param {String} command.type - Tipo de comando.
     * @param {String=} command.catapultTarget - Alvo da catapulta, caso o comando seja um ataque.
     */
    commandQueue.addCommand = function (command) {
        if (!command.origin) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_ORIGIN, command)
        }

        if (!command.target) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_TARGET, command)
        }

        if (!utils.isValidDateTime(command.date)) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_DATE, command)
        }

        if (!command.units || angular.equals(command.units, {})) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_NO_UNITS, command)
        }

        var getOriginVillage = new Promise(function (resolve, reject) {
            commandQueue.getVillageByCoords(command.origin.x, command.origin.y, function (data) {
                data ? resolve(data) : reject(ERROR_CODES.INVALID_ORIGIN)
            })
        })

        var getTargetVillage = new Promise(function (resolve, reject) {
            commandQueue.getVillageByCoords(command.target.x, command.target.y, function (data) {
                data ? resolve(data) : reject(ERROR_CODES.INVALID_TARGET)
            })
        })

        var loadVillagesData = Promise.all([
            getOriginVillage,
            getTargetVillage
        ])

        for (var officer in command.officers) {
            if (command.officers[officer]) {
                command.officers[officer] = 1
            } else {
                delete command.officers[officer]
            }
        }

        loadVillagesData.then(function (villages) {
            command.origin = villages[0]
            command.target = villages[1]
            command.units = cleanZeroUnits(command.units)
            command.date = utils.fixDate(command.date)
            command.travelTime = utils.getTravelTime(
                command.origin,
                command.target,
                command.units,
                command.type,
                command.officers
            )

            var inputTime = utils.getTimeFromString(command.date)

            if (command.dateType === DATE_TYPES.ARRIVE) {
                command.sendTime = inputTime - command.travelTime
                command.arriveTime = inputTime
            } else if (command.dateType === DATE_TYPES.OUT) {
                command.sendTime = inputTime
                command.arriveTime = inputTime + command.travelTime
            } else {
                throw new Error('CommandQueue: wrong dateType:' + command.dateType)
            }

            if (isTimeToSend(command.sendTime)) {
                return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_ALREADY_SENT, command)
            }

            if (command.type === COMMAND_TYPES.ATTACK && 'supporter' in command.officers) {
                delete command.officers.supporter
            }


            if (command.type === COMMAND_TYPES.ATTACK && command.units.catapult) {
                command.catapultTarget = command.catapultTarget || 'headquarter'
            } else {
                command.catapultTarget = null
            }

            command.id = utils.guid()

            waitingCommandHelpers(command)
            pushWaitingCommand(command)
            pushCommandObject(command)
            sortWaitingQueue()
            storeWaitingQueue()

            eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD, command)
        })

        loadVillagesData.catch(function (errorCode) {
            switch (errorCode) {
            case ERROR_CODES.INVALID_ORIGIN:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_ORIGIN, command)
                break
            case ERROR_CODES.INVALID_TARGET:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_TARGET, command)
                break
            }
        })
    }

    /**
     * @param  {Object} command - Dados do comando a ser removido.
     * @param {Number} eventCode - Code indicating the reason of the remotion.
     *
     * @return {Boolean} If the command was successfully removed.
     */
    commandQueue.removeCommand = function (command, eventCode) {
        var removed = false
        delete waitingCommandsObject[command.id]

        for (var i = 0; i < waitingCommands.length; i++) {
            if (waitingCommands[i].id == command.id) {
                waitingCommands.splice(i, 1)
                storeWaitingQueue()
                removed = true

                break
            }
        }

        if (removed) {
            switch (eventCode) {
            case EVENT_CODES.TIME_LIMIT:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_TIME_LIMIT, command)
                break
            case EVENT_CODES.NOT_OWN_VILLAGE:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE, command)
                break
            case EVENT_CODES.NOT_ENOUGH_UNITS:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH, command)
                break
            case EVENT_CODES.COMMAND_REMOVED:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_REMOVE, command)
                break
            }

            return true
        } else {
            eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_REMOVE_ERROR, command)
            return false
        }
    }

    commandQueue.clearRegisters = function () {
        Lockr.set('queue-expired', [])
        Lockr.set('queue-sent', [])
        expiredCommands = []
        sentCommands = []
    }

    commandQueue.start = function (disableNotif) {
        running = true
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_START, {
            disableNotif: !!disableNotif
        })
    }

    commandQueue.stop = function () {
        running = false
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_STOP)
    }

    commandQueue.isRunning = function () {
        return running
    }

    commandQueue.getWaitingCommands = function () {
        return waitingCommands
    }

    commandQueue.getWaitingCommandsObject = function () {
        return waitingCommandsObject
    }

    commandQueue.getSentCommands = function () {
        return sentCommands
    }

    commandQueue.getExpiredCommands = function () {
        return expiredCommands
    }

    commandQueue.getVillageByCoords = function (x, y, callback) {
        mapData.loadTownDataAsync(x, y, 1, 1, callback)
    }

    /**
     * @param  {String} filterId - Identificação do filtro.
     * @param {Array=} _options - Valores a serem passados para os filtros.
     * @param {Array=} _commandsDeepFilter - Usa os comandos passados
     * pelo parâmetro ao invés da lista de comandos completa.
     * @return {Array} Comandos filtrados.
     */
    commandQueue.filterCommands = function (filterId, _options, _commandsDeepFilter) {
        var filterHandler = commandFilters[filterId]
        var commands = _commandsDeepFilter || waitingCommands

        return commands.filter(function (command) {
            return filterHandler(command, _options)
        })
    }

    return commandQueue
})
