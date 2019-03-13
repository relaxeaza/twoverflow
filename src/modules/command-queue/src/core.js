define('two/queue', [
    'two/locale',
    'two/utils',
    'queues/EventQueue',
    'helper/time',
    'helper/math',
    'struct/MapData',
    'conf/conf',
    'Lockr'
], function (
    Locale,
    utils,
    eventQueue,
    $timeHelper,
    $math,
    $mapData,
    $conf,
    Lockr
) {
    /**
     * Taxa de verificação se há comandos a serem enviados por segundo.
     *
     * @type {Number}
     */
    var CHECKS_PER_SECOND = 10

    /**
     * @type {Object}
     */
    var EVENT_CODES = {
        NOT_OWN_VILLAGE: 'notOwnVillage',
        NOT_ENOUGH_UNITS: 'notEnoughUnits',
        TIME_LIMIT: 'timeLimit',
        COMMAND_REMOVED: 'commandRemoved',
        COMMAND_SENT: 'commandSent'
    }

    /**
     * @type {Object}
     */
    var ERROR_CODES = {
        INVALID_ORIGIN: 'invalidOrigin',
        INVALID_TARGET: 'invalidTarget'
    }

    /**
     * Lista de comandos em espera (ordenado por tempo restante).
     *
     * @type {Array}
     */
    var waitingCommands = []

    /**
     * Lista de comandos em espera.
     *
     * @type {Object}
     */
    var waitingCommandsObject = {}

    /**
     * Lista de comandos que já foram enviados.
     *
     * @type {Array}
     */
    var sentCommands = []

    /**
     * Lista de comandos que se expiraram.
     *
     * @type {Array}
     */
    var expiredCommands = []

    /**
     * Indica se o CommandQueue está ativado.
     *
     * @type {Boolean}
     */
    var running = false

    /**
     * Dados do jogador.
     *
     * @type {Object}
     */
    var $player

    /**
     * Tipos de comandos usados pelo jogo (tipo que usam tropas apenas).
     *
     * @type {Array}
     */
    var commandTypes = ['attack', 'support', 'relocate']

    /**
     * Lista de filtros para comandos.
     *
     * @type {Object}
     */
    var commandFilters = {
        selectedVillage: function (command) {
            return command.origin.id === modelDataService.getSelectedVillage().getId()
        },
        barbarianTarget: function (command) {
            return !command.target.character_id
        },
        allowedTypes: function (command, options) {
            return options.allowedTypes[command.type]
        },
        attack: function (command) {
            return command.type !== 'attack'
        },
        support: function (command) {
            return command.type !== 'support'
        },
        relocate: function (command) {
            return command.type !== 'relocate'
        },
        textMatch: function (command, options) {
            var show = true
            var keywords = options.textMatch.toLowerCase().split(/\W/)

            var searchString = [
                command.origin.name,
                command.originCoords,
                command.originCoords,
                command.origin.character_name || '',
                command.target.name,
                command.targetCoords,
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

    /**
     * Diferença entre o timezone local e do servidor.
     *
     * @type {Number}
     */
    var timeOffset

    /**
     * Verifica se tem um intervalo entre a horario do envio e o horario do jogo.
     *
     * @param  {Number} - sendTime
     * @return {Boolean}
     */
    var isTimeToSend = function (sendTime) {
        return sendTime < ($timeHelper.gameTime() + timeOffset)
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

    /**
     * Ordenada a lista de comandos em espera por tempo de saída.
     */
    var sortWaitingQueue = function () {
        waitingCommands = waitingCommands.sort(function (a, b) {
            return a.sendTime - b.sendTime
        })
    }

    /**
     * Adiciona um comando a lista ordenada de comandos em espera.
     *
     * @param  {Object} command - Comando a ser adicionado
     */
    var pushWaitingCommand = function (command) {
        waitingCommands.push(command)
    }

    /**
     * Adiciona um comando a lista de comandos em espera.
     *
     * @param  {Object} command - Comando a ser adicionado
     */
    var pushCommandObject = function (command) {
        waitingCommandsObject[command.id] = command
    }

    /**
     * Adiciona um comando a lista de comandos enviados.
     *
     * @param  {Object} command - Comando a ser adicionado
     */
    var pushSentCommand = function (command) {
        sentCommands.push(command)
    }

    /**
     * Adiciona um comando a lista de comandos expirados.
     *
     * @param  {Object} command - Comando a ser adicionado
     */
    var pushExpiredCommand = function (command) {
        expiredCommands.push(command)
    }

    /**
     * Salva a lista de comandos em espera no localStorage.
     */
    var storeWaitingQueue = function () {
        Lockr.set('queue-commands', waitingCommands)
    }

    /**
     * Salva a lista de comandos enviados no localStorage.
     */
    var storeSentQueue = function () {
        Lockr.set('queue-sent', sentCommands)
    }

    /**
     * Salva a lista de comandos expirados no localStorage.
     */
    var storeExpiredQueue = function () {
        Lockr.set('queue-expired', expiredCommands)
    }

    /**
     * Carrega a lista de comandos em espera salvos no localStorage
     * e os adiciona ao CommandQueue;
     * Commandos que já deveriam ter saído são movidos para a lista de
     * expirados.
     */
    var loadStoredCommands = function () {
        var storedQueue = Lockr.get('queue-commands', [], true)

        if (storedQueue.length) {
            for (var i = 0; i < storedQueue.length; i++) {
                var command = storedQueue[i]

                if ($timeHelper.gameTime() > command.sendTime) {
                    Queue.expireCommand(command, EVENT_CODES.TIME_LIMIT)
                } else {
                    pushWaitingCommand(command)
                    pushCommandObject(command)
                }
            }
        }
    }

    /**
     * Transforma valores curingas das unidades.
     * - Asteriscos são convetidos para o núrero total de unidades
     *    que se encontram na aldeia.
     * - Números negativos são convertidos núrero total de unidades
     *    menos a quantidade específicada.
     *
     * @param  {Object} command - Dados do comando
     * @return {Object|Number} Parsed units or error code.
     */
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

    /**
     * Inicia a verificação de comandos a serem enviados.
     */
    var listenCommands = function () {
        setInterval(function () {
            if (!waitingCommands.length) {
                return
            }

            waitingCommands.some(function (command) {
                if (isTimeToSend(command.sendTime)) {
                    if (running) {
                        Queue.sendCommand(command)
                    } else {
                        Queue.expireCommand(command, EVENT_CODES.TIME_LIMIT)
                    }
                } else {
                    return true
                }
            })
        }, 1000 / CHECKS_PER_SECOND)
    }

    /**
     * Métodos e propriedades publicas do CommandQueue.
     *
     * @type {Object}
     */
    var Queue = {}

    /**
     * Indica se o CommandQueue já foi inicializado.
     *
     * @type {Boolean}
     */
    Queue.initialized = false

    /**
     * Versão atual do CommandQueue
     *
     * @type {String}
     */
    Queue.version = '__queue_version'

    /**
     * Inicializa o CommandQueue.
     * Adiciona/expira comandos salvos em execuções anteriores.
     */
    Queue.init = function () {
        Locale.create('queue', __queue_locale, 'en')

        timeOffset = utils.getTimeOffset()
        $player = modelDataService.getSelectedCharacter()

        Queue.initialized = true

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

    /**
     * Envia um comando.
     *
     * @param {Object} command - Dados do comando que será enviado.
     */
    Queue.sendCommand = function (command) {
        var units = parseDynamicUnits(command)

        // units === EVENT_CODES.*
        if (typeof units === 'string') {
            return Queue.expireCommand(command, units)
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

        Queue.removeCommand(command, EVENT_CODES.COMMAND_SENT)
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND, [command])
    }

    /**
     * Expira um comando.
     *
     * @param {Object} command - Dados do comando que será expirado.
     * @param {Number} eventCode - Code indicating the reason of the expiration.
     */
    Queue.expireCommand = function (command, eventCode) {
        pushExpiredCommand(command)
        storeExpiredQueue()

        Queue.removeCommand(command, eventCode)
    }

    /**
     * Adiciona um comando a lista de espera.
     *
     * @param {Object} command - Dados do comando que será adicionado.
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
    Queue.addCommand = function (command) {
        if (!command.origin) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_ORIGIN, [command])
        }

        if (!command.target) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_TARGET, [command])
        }

        if (!utils.isValidDateTime(command.date)) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_DATE, [command])
        }

        if (!command.units || angular.equals(command.units, {})) {
            return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_NO_UNITS, [command])
        }

        command.originCoords = command.origin.x + '|' + command.origin.y
        command.targetCoords = command.target.y + '|' + command.target.y

        var getOriginVillage = new Promise(function (resolve, reject) {
            Queue.getVillageByCoords(command.origin.x, command.origin.y, function (data) {
                data ? resolve(data) : reject(ERROR_CODES.INVALID_ORIGIN)
            })
        })

        var getTargetVillage = new Promise(function (resolve, reject) {
            Queue.getVillageByCoords(command.target.x, command.target.y, function (data) {
                data ? resolve(data) : reject(ERROR_CODES.INVALID_TARGET)
            })
        })

        var loadVillagesData = Promise.all([
            getOriginVillage,
            getTargetVillage
        ])

        loadVillagesData.then(function (villages) {
            command.origin = villages[0]
            command.target = villages[1]
            command.units = cleanZeroUnits(command.units)
            command.date = utils.fixDate(command.date)
            command.travelTime = Queue.getTravelTime(
                command.origin,
                command.target,
                command.units,
                command.type,
                command.officers
            )

            var inputTime = utils.getTimeFromString(command.date)

            if (command.dateType === 'arrive') {
                command.sendTime = inputTime - command.travelTime
                command_arriveTime = inputTime
            } else {
                command.sendTime = inputTime
                command_arriveTime = inputTime + command.travelTime
            }

            if (isTimeToSend(command.sendTime)) {
                return eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_ALREADY_SENT, [command])
            }

            if (command.type === 'attack' && 'supporter' in command.officers) {
                delete command.officers.supporter
            }

            for (var officer in command.officers) {
                command.officers[officer] = 1
            }

            if (command.type === 'attack' && command.units.catapult) {
                command.catapultTarget = command.catapultTarget || 'headquarter'
            } else {
                command.catapultTarget = null
            }

            command.id = utils.guid()

            pushWaitingCommand(command)
            pushCommandObject(command)
            sortWaitingQueue()
            storeWaitingQueue()

            eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD, [command])
        })

        loadVillagesData.catch(function (errorCode) {
            switch (errorCode) {
            case ERROR_CODES.INVALID_ORIGIN:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_ORIGIN, [command])
                break
            case ERROR_CODES.INVALID_TARGET:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_TARGET, [command])
                break
            }
        })
    }

    /**
     * Remove um comando da lista de espera.
     *
     * @param  {Object} command - Dados do comando a ser removido.
     * @param {Number} eventCode - Code indicating the reason of the remotion.
     *
     * @return {Boolean} If the command was successfully removed.
     */
    Queue.removeCommand = function (command, eventCode) {
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
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_TIME_LIMIT, [command])
                break
            case EVENT_CODES.NOT_OWN_VILLAGE:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE, [command])
                break
            case EVENT_CODES.NOT_ENOUGH_UNITS:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH, [command])
                break
            case EVENT_CODES.COMMAND_REMOVED:
                eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_REMOVE, [command])
                break
            }

            return true
        } else {
            eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_REMOVE_ERROR, [command])
            return false
        }
    }

    /**
     * Remove todos os comandos já enviados e expirados da lista
     * e do localStorage.
     */
    Queue.clearRegisters = function () {
        Lockr.set('queue-expired', [])
        Lockr.set('queue-sent', [])
        expiredCommands = []
        sentCommands = []
    }

    /**
     * Ativa o CommandQueue. Qualquer comando que chegar no horário
     * de envio, será enviado.
     */
    Queue.start = function (disableNotif) {
        running = true
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_START, [disableNotif])
    }

    /**
     * Desativa o CommandQueue
     */
    Queue.stop = function () {
        running = false
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_STOP)
    }

    /**
     * Verifica se o CommandQueue está ativado.
     *
     * @return {Boolean}
     */
    Queue.isRunning = function () {
        return running
    }

    /**
     * Obtem lista de comandos ordenados na lista de espera.
     *
     * @return {Array}
     */
    Queue.getWaitingCommands = function () {
        return waitingCommands
    }

    /**
     * Obtem lista de comandos em espera.
     *
     * @return {Object}
     */
    Queue.getWaitingCommandsObject = function () {
        return waitingCommandsObject
    }

    /**
     * Obtem lista de comandos enviados;
     *
     * @return {Array}
     */
    Queue.getSentCommands = function () {
        return sentCommands
    }

    /**
     * Obtem lista de comandos expirados;
     *
     * @return {Array}
     */
    Queue.getExpiredCommands = function () {
        return expiredCommands
    }

    /**
     * Calcula o tempo de viagem de uma aldeia a outra
     *
     * @param {Object} origin - Objeto da aldeia origem.
     * @param {Object} target - Objeto da aldeia alvo.
     * @param {Object} units - Exercito usado no ataque como referência
     * para calcular o tempo.
     * @param {String} type - Tipo de comando (attack,support,relocate)
     * @param {Object} officers - Oficiais usados no comando (usados para efeitos)
     *
     * @return {Number} Tempo de viagem
     */
    Queue.getTravelTime = function (origin, target, units, type, officers) {
        var useEffects = false
        var targetIsBarbarian = target.character_id === null
        var targetIsSameTribe = target.character_id && target.tribe_id &&
            target.tribe_id === $player.getTribeId()

        if (type === 'attack') {
            if ('supporter' in officers) {
                delete officers.supporter
            }

            if (targetIsBarbarian) {
                useEffects = true
            }
        } else if (type === 'support') {
            if (targetIsSameTribe) {
                useEffects = true
            }

            if ('supporter' in officers) {
                useEffects = true
            }
        }

        var army = {
            units: units,
            officers: angular.copy(officers)
        }

        var travelTime = armyService.calculateTravelTime(army, {
            barbarian: targetIsBarbarian,
            ownTribe: targetIsSameTribe,
            officers: officers,
            effects: useEffects
        }, type)

        var distance = $math.actualDistance(origin, target)

        var totalTravelTime = armyService.getTravelTimeForDistance(
            army,
            travelTime,
            distance,
            type
        )

        return totalTravelTime * 1000
    }

    /**
     * Carrega os dados de uma aldeia pelas coordenadas.
     *
     * @param  {String} coords - Coordendas da aldeia.
     * @param  {Function} callback
     */
    Queue.getVillageByCoords = function (x, y, callback) {
        $mapData.loadTownDataAsync(x, y, 1, 1, callback)
    }

    /**
     * Filtra os comandos de acordo com o filtro especificado.
     *
     * @param  {String} filterId - Identificação do filtro.
     * @param {Array=} _options - Valores a serem passados para os filtros.
     * @param {Array=} _commandsDeepFilter - Usa os comandos passados
     * pelo parâmetro ao invés da lista de comandos completa.
     * @return {Array} Comandos filtrados.
     */
    Queue.filterCommands = function (filterId, _options, _commandsDeepFilter) {
        var filterHandler = commandFilters[filterId]
        var commands = _commandsDeepFilter || waitingCommands

        return commands.filter(function (command) {
            return filterHandler(command, _options)
        })
    }

    return Queue
})
