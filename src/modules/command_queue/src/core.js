define('two/commandQueue', [
    'two/utils',
    'two/commandQueue/types/dates',
    'two/commandQueue/types/events',
    'two/commandQueue/types/filters',
    'two/commandQueue/types/commands',
    'two/commandQueue/storageKeys',
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
    STORAGE_KEYS,
    eventQueue,
    timeHelper,
    $math,
    mapData,
    Lockr
) {
    const CHECKS_PER_SECOND = 10
    const ERROR_CODES = {
        INVALID_ORIGIN: 'invalid_rigin',
        INVALID_TARGET: 'invalid_target'
    }
    let waitingCommands = []
    let waitingCommandsObject = {}
    let sentCommands = []
    let expiredCommands = []
    let running = false
    let timeOffset

    const commandFilters = {
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
            let show = true
            const keywords = options[FILTER_TYPES.TEXT_MATCH].toLowerCase().split(/\W/)

            const searchString = [
                command.origin.name,
                command.origin.x + '|' + command.origin.y,
                command.origin.character_name || '',
                command.target.name,
                command.target.x + '|' + command.target.y,
                command.target.character_name || '',
                command.target.tribe_name || '',
                command.target.tribe_tag || ''
            ].join('').toLowerCase()

            keywords.some(function (keyword) {
                if (keyword.length && !searchString.includes(keyword)) {
                    show = false
                    return true
                }
            })

            return show
        }
    }

    const isTimeToSend = function (sendTime) {
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
    const cleanZeroUnits = function (units) {
        let cleanUnits = {}

        for (let unit in units) {
            let amount = units[unit]

            if (amount === '*' || amount !== 0) {
                cleanUnits[unit] = amount
            }
        }

        return cleanUnits
    }

    const sortWaitingQueue = function () {
        waitingCommands = waitingCommands.sort(function (a, b) {
            return a.sendTime - b.sendTime
        })
    }

    const pushWaitingCommand = function (command) {
        waitingCommands.push(command)
    }

    const pushCommandObject = function (command) {
        waitingCommandsObject[command.id] = command
    }

    const pushSentCommand = function (command) {
        sentCommands.push(command)
    }

    const pushExpiredCommand = function (command) {
        expiredCommands.push(command)
    }

    const storeWaitingQueue = function () {
        Lockr.set(STORAGE_KEYS.QUEUE_COMMANDS, waitingCommands)
    }

    const storeSentQueue = function () {
        Lockr.set(STORAGE_KEYS.QUEUE_SENT, sentCommands)
    }

    const storeExpiredQueue = function () {
        Lockr.set(STORAGE_KEYS.QUEUE_EXPIRED, expiredCommands)
    }

    const loadStoredCommands = function () {
        const storedQueue = Lockr.get(STORAGE_KEYS.QUEUE_COMMANDS, [], true)

        if (storedQueue.length) {
            for (let i = 0; i < storedQueue.length; i++) {
                let command = storedQueue[i]

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

    const waitingCommandHelpers = function (command) {
        if (hasOwn.call(command, 'countdown')) {
            return false
        }

        command.countdown = function () {
            return timeHelper.readableMilliseconds((timeHelper.gameTime() + timeOffset) - command.sendTime)
        }
    }

    const parseDynamicUnits = function (command) {
        const playerVillages = modelDataService.getVillages()
        const village = playerVillages[command.origin.id]

        if (!village) {
            return EVENT_CODES.NOT_OWN_VILLAGE
        }

        const villageUnits = village.unitInfo.units
        let parsedUnits = {}

        for (let unit in command.units) {
            let amount = command.units[unit]

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

    const listenCommands = function () {
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

    let commandQueue = {
        initialized: false
    }

    commandQueue.init = function () {
        timeOffset = utils.getTimeOffset()
        commandQueue.initialized = true
        sentCommands = Lockr.get(STORAGE_KEYS.QUEUE_SENT, [], true)
        expiredCommands = Lockr.get(STORAGE_KEYS.QUEUE_EXPIRED, [], true)

        loadStoredCommands()
        listenCommands()

        window.addEventListener('beforeunload', function (event) {
            if (running && waitingCommands.length) {
                event.returnValue = true
            }
        })
    }

    commandQueue.sendCommand = function (command) {
        const units = parseDynamicUnits(command)

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

        let getOriginVillage = new Promise(function (resolve, reject) {
            commandQueue.getVillageByCoords(command.origin.x, command.origin.y, function (data) {
                data ? resolve(data) : reject(ERROR_CODES.INVALID_ORIGIN)
            })
        })

        let getTargetVillage = new Promise(function (resolve, reject) {
            commandQueue.getVillageByCoords(command.target.x, command.target.y, function (data) {
                data ? resolve(data) : reject(ERROR_CODES.INVALID_TARGET)
            })
        })

        let loadVillagesData = Promise.all([
            getOriginVillage,
            getTargetVillage
        ])

        for (let officer in command.officers) {
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
            command.travelTime = utils.getTravelTime(
                command.origin,
                command.target,
                command.units,
                command.type,
                command.officers,
                true
            )

            const inputTime = utils.getTimeFromString(command.date)

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
        let removed = false
        delete waitingCommandsObject[command.id]

        for (let i = 0; i < waitingCommands.length; i++) {
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
        Lockr.set(STORAGE_KEYS.QUEUE_EXPIRED, [])
        Lockr.set(STORAGE_KEYS.QUEUE_SENT, [])
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
        const filterHandler = commandFilters[filterId]
        const commands = _commandsDeepFilter || waitingCommands

        return commands.filter(function (command) {
            return filterHandler(command, _options)
        })
    }

    return commandQueue
})
