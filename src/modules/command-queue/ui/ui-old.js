define('two/queue/ui/old', [
    'two/queue',
    'two/locale',
    'two/ui2',
    'two/ui/buttonLink',
    'two/ui/autoComplete',
    'two/FrontButton',
    'two/utils',
    'queues/EventQueue',
    'helper/time',
    'ejs'
], function (
    Queue,
    Locale,
    Interface,
    buttonLink,
    autoComplete,
    FrontButton,
    utils,
    eventQueue,
    $timeHelper,
    ejs
) {
    var textObject = 'queue'
    var textObjectCommon = 'common'

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

    var buildWindow = function () {
        /**
         * Elementos da previsão dos tempos de viagem de todas unidades.
         *
         * @type {Object}
         */
        var $unitTravelTimes = {
            attack: {},
            support: {}
        }

        /**
         * Object da aldeia origem (Obtido ao adicionar as coordendas
         * em "Adicionar comando").
         *
         * @type {Object|Null}
         */
        var originVillage = null

        /**
         * Object da aldeia alvo (Obtido ao adicionar as coordendas
         * em "Adicionar comando").
         *
         * @type {Object|Null}
         */
        var targetVillage = null

        /**
         * Armazena o elemento com a contagem regressiva de todos os comandos em espera.
         *
         * @type {Object}
         */
        var countDownElements = {}

        /**
         * Dados do jogador
         *
         * @type {Object}
         */
        var $player

        /**
         * Dados do jogo.
         *
         * @type {Object}
         */
        var $gameData = modelDataService.getGameData()

        /**
         * Armazena se as entradas das coordenadas e data de chegada são validas.
         *
         * @type {Object}
         */
        var validInput = {
            origin: false,
            target: false,
            date: false
        }

        /**
         * ID do setTimeout para que ações não sejam executadas imediatamente
         * assim que digitas no <input>
         *
         * @type {Number}
         */
        var timeoutInputDelayId

        /**
         * Lista de filtros ativos dos comandos da visualização "Em espera"
         *
         * @type {Object}
         */
        var activeFilters = {
            selectedVillage: false,
            barbarianTarget: false,
            allowedTypes: true,
            attack: true,
            support: true,
            relocate: true,
            textMatch: true
        }

        /**
         * Ordem em que os filtros são aplicados.
         *
         * @type {Array}
         */
        var filterOrder = [
            'selectedVillage',
            'barbarianTarget',
            'allowedTypes',
            'textMatch'
        ]

        /**
         * Dados dos filtros
         *
         * @type {Object}
         */
        var filtersData = {
            allowedTypes: {
                attack: true,
                support: true,
                relocate: true
            },
            textMatch: ''
        }

        /**
         * Nome de todos oficiais.
         *
         * @type {Array}
         */
        var officerNames = $gameData.getOrderedOfficerNames()

        /**
         * Nome de todas unidades.
         *
         * @type {Array}
         */
        var unitNames = $gameData.getOrderedUnitNames()

        /**
         * Nome de todos edificios.
         *
         * @type {Array}
         */
        var buildingNames

        /**
         * Nome de uma unidade de cada velocidade disponivel no jogo.
         * Usados para gerar os tempos de viagem.
         *
         * @type {Array}
         */
        var unitsBySpeed = [
            'knight',
            'heavy_cavalry',
            'axe',
            'sword',
            'ram',
            'snob',
            'trebuchet'
        ]

        /**
         * Tipo de comando que será adicionado a lista de espera,
         * setado quando um dos botões de adição é pressionado.
         *
         * @type {String}
         */
        var commandType

        /**
         * Tipo de data usada para configurar o comando (arrive|out)
         *
         * @type {String}
         */
        var dateType = 'arrive'

        /**
         * Aldeia atualmente selecionada no mapa.
         *
         * @type {Array|Boolean} Coordenadas da aldeia [x, y]
         */
        var mapSelectedVillage = false

        /**
         * Diferença entre o timezone local e do servidor.
         *
         * @type {Number}
         */
        var timeOffset

        /**
         * Oculpa os tempos de viagem
         */
        var hideTravelTimes = function () {
            $travelTimes.css('display', 'none')
        }

        /**
         * Oculpa os tempos de viagem
         */
        var showTravelTimes = function () {
            $travelTimes.css('display', '')
        }

        /**
         * Analisa as condições para ver se é possível calcular os tempos de viagem.
         * @return {Boolean}
         */
        var availableTravelTimes = function () {
            return ui.isVisible('add') && validInput.origin && validInput.target && validInput.date
        }

        /**
         * Popula as abas "Em espera" e "Registros" com os comandos armazenados.
         */
        var appendStoredCommands = function (sectionOnly) {
            appendWaitingCommands()
            appendSentCommands()
            appendExpiredCommands()
            applyCommandFilters()
        }

        /**
         * Popula a lista de comandos enviados.
         */
        var appendSentCommands = function () {
            Queue.getSentCommands().forEach(function (cmd) {
                appendCommand(cmd, 'sent')
            })
        }

        /**
         * Popula a lista de comandos expirados.
         */
        var appendExpiredCommands = function () {
            Queue.getExpiredCommands().forEach(function (cmd) {
                appendCommand(cmd, 'expired')
            })
        }

        /**
         * Popula a lista de comandos em espera.
         */
        var appendWaitingCommands = function () {
            Queue.getWaitingCommands().forEach(function (cmd) {
                appendCommand(cmd, 'queue')
            })
        }

        /**
         * Limpa a lista de comandos em espera.
         */
        var clearWaitingCommands = function () {
            $sections.queue.find('.command').remove()
            countDownElements = {}
        }

        /**
         * Repopula a lista de comandos em espera.
         */
        var resetWaitingCommands = function () {
            clearWaitingCommands()
            appendWaitingCommands()
        }

        /**
         * Verifica se o valor passado é uma unidade.
         * @param  {String} - value
         * @return {Boolean}
         */
        var isUnit = function (value) {
            return unitNames.includes(value)
        }

        /**
         * Verifica se o valor passado é um oficial.
         * @param  {String} - value
         * @return {Boolean}
         */
        var isOfficer = function (value) {
            return officerNames.includes(value)
        }

        /**
         * Obtem a data atual do jogo fomatada para hh:mm:ss:SSS dd/MM/yyyy
         *
         * @param {Number=} _ms - Optional time to be formated instead of the game date.
         * @return {String}
         */
        var formatDate = function (_ms) {
            var date = new Date(_ms || ($timeHelper.gameTime() + utils.getTimeOffset()))

            var rawMS = date.getMilliseconds()
            var ms = $timeHelper.zerofill(rawMS - (rawMS % 100), 3)
            var sec = $timeHelper.zerofill(date.getSeconds(), 2)
            var min = $timeHelper.zerofill(date.getMinutes(), 2)
            var hour = $timeHelper.zerofill(date.getHours(), 2)
            var day = $timeHelper.zerofill(date.getDate(), 2)
            var month = $timeHelper.zerofill(date.getMonth() + 1, 2)
            var year = date.getFullYear()

            return hour + ':' + min + ':' + sec + ':' + ms + ' ' + day + '/' + month + '/' + year
        }

        /**
         * Calcula o tempo de viagem para cada unidade com tempo de viagem disti
         * Tanto para ataque quanto para defesa.
         */
        var populateTravelTimes = function () {
            if (!validInput.origin || !validInput.target) {
                return $travelTimes.hide()
            }

            var origin = $origin.val()
            var target = $target.val()
            var officers = getOfficers()
            var travelTime = {}

            if (validInput.date) {
                var date = utils.fixDate($date.val())
                var arriveTime = utils.getTimeFromString(date)
            }

            ;['attack', 'support'].forEach(function (type) {
                unitsBySpeed.forEach(function (unit) {
                    var units = {}
                    units[unit] = 1

                    var travelTime = Queue.getTravelTime(originVillage, targetVillage, units, type, officers)
                    var readable = $filter('readableMillisecondsFilter')(travelTime)

                    if (dateType === 'arrive') {
                        if (validInput.date) {
                            var sendTime = arriveTime - travelTime

                            if (!isValidSendTime(sendTime)) {
                                readable = genRedSpan(readable)
                            }
                        } else {
                            readable = genRedSpan(readable)
                        }
                    }

                    $unitTravelTimes[type][unit].innerHTML = readable
                })
            })

            showTravelTimes()
        }

        /**
         * Gera um <span> com classe para texto vermelho.
         */
        var genRedSpan = function (text) {
            return '<span class="text-red">' + text + '</span>'
        }

        /**
         * Altera a cor do texto do input
         *
         * @param  {jqLite} $elem
         */
        var colorRed = function ($elem) {
            $elem.css('color', '#a1251f')
        }

        /**
         * Restaura a cor do texto do input
         *
         * @param  {jqLite} $elem
         */
        var colorNeutral = function ($elem) {
            $elem.css('color', '')
        }

        /**
         * Loop em todas entradas de valores para adicionar um comadno.
         *
         * @param  {Function} callback
         */
        var eachInput = function (callback) {
            $window.find('[data-setting]').forEach(function ($input) {
                var settingId = $input.dataset.setting

                callback($input, settingId)
            })
        }

        /**
         * Adiciona um comando de acordo com os dados informados.
         *
         * @param {String} type Tipo de comando (attack, support ou relocate)
         */
        var addCommand = function (type) {
            var command = {
                units: {},
                officers: {},
                type: type,
                origin: originVillage,
                target: targetVillage
            }

            eachInput(function ($input, id) {
                var value = $input.value

                if (id === 'dateType') {
                    command.dateType = $input.dataset.value
                } else if (id === 'catapultTarget') {
                    command.catapultTarget = $input.dataset.value || null
                } else if (!value) {
                    return false
                } else if (isUnit(id)) {
                    command.units[id] = isNaN(value) ? value : parseInt(value, 10)
                } else if (isOfficer(id)) {
                    if ($input.checked) {
                        command.officers[id] = 1
                    }
                } else if (value) {
                    command[id] = value
                }
            })
            
            Queue.addCommand(command)
        }

        /**
         * Remove um comando da seção especificada.
         *
         * @param  {Object} command - Comando que será removido.
         * @param  {String} section - Sessão em que o comando se encontra.
         */
        var removeCommand = function (command, section) {
            var $command = $sections[section].find('.command').filter(function ($command) {
                return $command.dataset.id === command.id
            })

            $($command).remove()

            removeCommandCountdown(command.id)
            toggleEmptyMessage(section)

            if (ui.isVisible('queue')) {
                ui.recalcScrollbar()
            }
        }

        /**
         * Adiciona um comando na seção.
         *
         * @param {Object} command - Dados do comando que será adicionado na interface.
         * @param {String} section - Seção em que o comandos erá adicionado.
         */
        var appendCommand = function (command, section) {
            var $command = document.createElement('div')
            $command.dataset.id = command.id
            $command.className = 'command'

            var origin = buttonLink('village', utils.genVillageLabel(command.origin), command.origin.id)
            var target = buttonLink('village', utils.genVillageLabel(command.target), command.target.id)

            // minus timeOffset = ugly fix?
            var arriveTime = utils.formatDate(command_arriveTime - timeOffset)
            var sendTime = utils.formatDate(command.sendTime - timeOffset)
            var hasOfficers = !!Object.keys(command.officers).length

            $command.innerHTML = ejs.render('__queue_html_command', {
                sendTime: sendTime,
                type: command.type,
                arriveTime: arriveTime,
                units: command.units,
                hasOfficers: hasOfficers,
                officers: command.officers,
                section: section,
                locale: Locale,
                catapultTarget: command.catapultTarget,
                iconColor: command.type === 'attack' ? 'red' : 'blue'
            })

            $command.querySelector('.origin').replaceWith(origin.elem)
            $command.querySelector('.target').replaceWith(target.elem)

            if (section === 'queue') {
                var $remove = $command.querySelector('.remove-command')
                var $timeLeft = $command.querySelector('.time-left')

                $remove.addEventListener('click', function (event) {
                    Queue.removeCommand(command, EVENT_CODES.COMMAND_REMOVED)
                })

                addCommandCountdown($timeLeft, command.id)
            }

            $sections[section].append($command)
            ui.setTooltips()

            toggleEmptyMessage(section)
        }

        /**
         * Inicia a contagem regressiva de todos comandos em espera.
         */
        var listenCommandCountdown = function () {
            var waitingCommands = Queue.getWaitingCommandsObject()
            setInterval(function () {
                var now = $timeHelper.gameTime() + timeOffset

                // Só processa os comandos se a aba dos comandos em esperera
                // estiver aberta.
                if (!ui.isVisible('queue')) {
                    return false
                }

                for (var commandId in countDownElements) {
                    var command = waitingCommands[commandId]
                    var timeLeft = command.sendTime - now

                    if (timeLeft > 0) {
                        countDownElements[commandId].innerHTML =
                            $filter('readableMillisecondsFilter')(timeLeft, false, true)
                    }
                }
            }, 1000)
        }

        /**
         * Armazena o elemento da contagem regressiva de um comando.
         *
         * @param {Element} $container - Elemento da contagem regressiva.
         * @param {String} commandId - Identificação unica do comando.
         */
        var addCommandCountdown = function ($container, commandId) {
            countDownElements[commandId] = $container
        }

        /**
         * Remove um elemento de contagem regressiva armazenado.
         *
         * @param  {String} commandId - Identificação unica do comando.
         */
        var removeCommandCountdown = function (commandId) {
            delete countDownElements[commandId]
        }

        /**
         * Loop em todos os comandos em espera da visualização.
         *
         * @param  {Function} callback
         */
        var eachWaitingCommand = function (callback) {
            var waitingCommands = Queue.getWaitingCommandsObject()

            $sections.queue.find('.command').forEach(function ($command) {
                var command = waitingCommands[$command.dataset.id]

                if (command) {
                    callback($command, command)
                }
            })
        }

        /**
         * Aplica um filtro nos comandos em espera.
         *
         * @param  {Array=} _options - Valores a serem passados para os filtros.
         */
        var applyCommandFilters = function (_options) {
            var filteredCommands = Queue.getWaitingCommands()

            filterOrder.forEach(function (filterId) {
                if (activeFilters[filterId]) {
                    filteredCommands = Queue.filterCommands(filterId, filtersData, filteredCommands)
                }
            })

            var filteredCommandIds = filteredCommands.map(function (command) {
                return command.id
            })

            eachWaitingCommand(function ($command, command) {
                $command.style.display = filteredCommandIds.includes(command.id) ? '' : 'none'
            })

            ui.recalcScrollbar()
        }

        /**
         * Mostra ou oculpa a mensagem "vazio" de acordo com
         * a quantidade de comandos presetes na seção.
         *
         * @param  {String} section
         */
        var toggleEmptyMessage = function (section) {
            var $where = $sections[section]
            var $msg = $where.find('p.nothing')

            var condition = section === 'queue'
                ? Queue.getWaitingCommands()
                : $where.find('div')

            $msg.css('display', condition.length === 0 ? '' : 'none')
        }

        /**
         * Configura todos eventos dos elementos da interface.
         */
        var bindEvents = function () {
            // eventQueue.register(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_ORIGIN, function (command) {
            //     utils.emitNotif('error', Locale('queue', 'error_origin'))
            // })

            // eventQueue.register(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_TARGET, function (command) {
            //     utils.emitNotif('error', Locale('queue', 'error_target'))
            // })
            
            // eventQueue.register(eventTypeProvider.COMMAND_QUEUE_ADD_INVALID_DATE, function (command) {
            //     utils.emitNotif('error', Locale('queue', 'error_invalid_date'))
            // })

            // eventQueue.register(eventTypeProvider.COMMAND_QUEUE_ADD_NO_UNITS, function (command) {
            //     utils.emitNotif('error', Locale('queue', 'error_no_units'))
            // })

            // eventQueue.register(eventTypeProvider.COMMAND_QUEUE_ADD_ALREADY_SENT, function (command) {
            //     utils.emitNotif('error', Locale('queue', 'error_already_sent', {
            //         date: utils.formatDate(command.sendTime),
            //         type: Locale('common', command.type)
            //     }))
            // })

            eventQueue.register(eventTypeProvider.COMMAND_QUEUE_REMOVE, function (command) {
                removeCommand(command, 'queue')
                rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
                utils.emitNotif('success', genNotifText(command.type, 'removed'))
            })

            eventQueue.register(eventTypeProvider.COMMAND_QUEUE_REMOVE_ERROR, function (command) {
                utils.emitNotif('error', Locale('queue', 'error_remove_error'))
            })

            eventQueue.register(eventTypeProvider.COMMAND_QUEUE_SEND_TIME_LIMIT, function (command) {
                removeCommand(command, 'queue')
                appendCommand(command, 'expired')
                utils.emitNotif('error', genNotifText(command.type, 'expired'))
            })

            eventQueue.register(eventTypeProvider.COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE, function (command) {
                removeCommand(command, 'queue')
                appendCommand(command, 'expired')
                utils.emitNotif('error', Locale('queue', 'error_not_own_village'))
            })

            eventQueue.register(eventTypeProvider.COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH, function (command) {
                removeCommand(command, 'queue')
                appendCommand(command, 'expired')
                utils.emitNotif('error', Locale('queue', 'error_no_units_enough'))
            })

            eventQueue.register(eventTypeProvider.COMMAND_QUEUE_ADD, function (command) {
                resetWaitingCommands()
                applyCommandFilters()
                utils.emitNotif('success', genNotifText(command.type, 'added'))
            })

            eventQueue.register(eventTypeProvider.COMMAND_QUEUE_SEND, function (command) {
                removeCommand(command, 'queue')
                appendCommand(command, 'sent')
                utils.emitNotif('success', genNotifText(command.type, 'sent'))
            })

            eventQueue.register(eventTypeProvider.COMMAND_QUEUE_START, function (disableNotif) {
                $switch.removeClass('btn-green').addClass('btn-red')
                $switch.html(Locale('common', 'deactivate'))

                if (!disableNotif) {
                    utils.emitNotif('success', genNotifText('title', 'activated'))
                }
            })

            eventQueue.register(eventTypeProvider.COMMAND_QUEUE_STOP, function () {
                $switch.removeClass('btn-red').addClass('btn-green')
                $switch.html(Locale('common', 'activate'))

                utils.emitNotif('success', genNotifText('title', 'deactivated'))
            })

            $dateType.on('selectSelected', function () {
                dateType = $dateType[0].dataset.value

                populateTravelTimes()
            })

            $switch.on('click', function (event) {
                if (Queue.isRunning()) {
                    Queue.stop()
                } else {
                    Queue.start()
                }
            })

            $window.find('.buttons .add').on('click', function () {
                addCommand(this.name)
            })

            $window.find('a.clear').on('click', function () {
                clearRegisters()
            })

            $window.find('a.addSelected').on('click', function () {
                originVillage = modelDataService.getSelectedVillage().data
                $originVillage.html(utils.genVillageLabel(originVillage))
                validInput.origin = true

                if (originVillage && targetVillage) {
                    showTravelTimes()
                }

                Queue.getVillageByCoords(originVillage.x, originVillage.y, function (data) {
                    originVillage = data
                    populateTravelTimes()
                })
            })

            $window.find('a.addMapSelected').on('click', function () {
                if (!mapSelectedVillage) {
                    return utils.emitNotif('error', Locale('queue', 'error_no_map_selected_village'))
                }

                targetVillage = mapSelectedVillage
                $targetVillage.html(utils.genVillageLabel(targetVillage))
                validInput.target = true

                if (originVillage && targetVillage) {
                    showTravelTimes()
                }

                Queue.getVillageByCoords(targetVillage.x, targetVillage.y, function (data) {
                    targetVillage = data
                    populateTravelTimes()
                })
            })

            $window.find('a.addCurrentDate').on('click', function () {
                $date.val(formatDate())
                $date.trigger('input')
            })

            $window.find('a.currentDatePlus').on('click', function () {
                $date.val(addDateDiff($date.val(), 100))
            })

            $window.find('a.currentDateMinus').on('click', function () {
                $date.val(addDateDiff($date.val(), -100))
            })

            var villageInputHandler = function (type) {
                return function () {
                    var $el = type === 'origin' ? $origin : $target
                    var val = $el.val()

                    if (val.length < 2) {
                        return autoComplete.hide()
                    }

                    autoComplete.search(val, function (data) {
                        if (data.length) {
                            autoComplete.show(data, $el[0], 'commandQueue-' + type)
                        }
                    }, ['village'])
                }
            }

            $origin.on('input', villageInputHandler('origin'))
            $target.on('input', villageInputHandler('target'))

            rootScope.$on(eventTypeProvider.SELECT_SELECTED, function (event, id, village) {
                if (id === 'commandQueue-origin') {
                    validInput.origin = true
                    originVillage = village

                    colorNeutral($origin)
                    populateTravelTimes()

                    $originVillage.html(village.name)
                } else if (id === 'commandQueue-target') {
                    validInput.target = true
                    targetVillage = village

                    colorNeutral($target)
                    populateTravelTimes()

                    $targetVillage.html(village.name)
                }

                if (!originVillage || !targetVillage) {
                    hideTravelTimes()
                }
            })

            $date.on('input', function () {
                validInput.date = utils.isValidDateTime($date.val())

                if (validInput.date) {
                    colorNeutral($date)
                } else {
                    colorRed($date)
                }

                populateTravelTimes()
            })

            $officers.on('change', function () {
                populateTravelTimes()
            })

            $catapultInput.on('input', function (event) {
                if (event.target.value) {
                    $catapultTarget.css('display', '')
                } else {
                    $catapultTarget.css('display', 'none')
                }
            })

            $clearUnits.on('click', cleanUnitInputs)

            rootScope.$on(eventTypeProvider.SHOW_CONTEXT_MENU, function (event, menu) {
                mapSelectedVillage = menu.data
            })

            rootScope.$on(eventTypeProvider.DESTROY_CONTEXT_MENU, function () {
                mapSelectedVillage = false
            })

            rootScope.$on(eventTypeProvider.VILLAGE_SELECTED_CHANGED, function () {
                applyCommandFilters()
            })

            rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, updatePresetList)
            rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, updatePresetList)

            $insertPreset.on('selectSelected', function () {
                var presetId = $insertPreset[0].dataset.value
                insertPreset(presetId)
            })
        }

        /**
         * Configura eventos dos filtros dos comandos em espera.
         */
        var bindCommandFilters = function () {
            $filters.find('.selectedVillage').on('click', function () {
                if (activeFilters.selectedVillage) {
                    this.classList.remove('active')
                } else {
                    this.classList.add('active')
                }

                activeFilters.selectedVillage = !activeFilters.selectedVillage

                applyCommandFilters()
            })

            $filters.find('.barbarianTarget').on('click', function () {
                if (activeFilters.barbarianTarget) {
                    this.classList.remove('active')
                } else {
                    this.classList.add('active')
                }

                activeFilters.barbarianTarget = !activeFilters.barbarianTarget

                applyCommandFilters()
            })

            $filters.find('.allowedTypes').on('click', function () {
                var commandType = this.dataset.filter
                var activated = activeFilters[commandType]

                if (activated) {
                    this.classList.remove('active')
                } else {
                    this.classList.add('active')
                }

                activeFilters[commandType] = !activated
                filtersData.allowedTypes[commandType] = !activated

                applyCommandFilters()
            })

            $filters.find('.textMatch').on('input', function (event) {
                clearTimeout(timeoutInputDelayId)

                filtersData[this.dataset.filter] = this.value

                timeoutInputDelayId = setTimeout(function () {
                    applyCommandFilters()
                }, 250)
            })
        }

        /**
         * Remove todos os registros da interface e do localStorage.
         */
        var clearRegisters = function () {
            Queue.getSentCommands().forEach(function (cmd) {
                removeCommand(cmd, 'sent')
            })

            Queue.getExpiredCommands().forEach(function (cmd) {
                removeCommand(cmd, 'expired')
            })

            Queue.clearRegisters()
        }

        /**
         * Gera um texto de notificação com as traduções.
         *
         * @param  {String} key
         * @param  {String} key2
         * @param  {String=} prefix
         * @return {String}
         */
        var genNotifText = function (key, key2, prefix) {
            if (prefix) {
                key = prefix + '.' + key
            }

            return Locale('queue', key) + ' ' + Locale('queue', key2)
        }

        /**
         * Verifica se o tempo de envio é menor que o tempo atual do jogo.
         *
         * @param  {Number}  time
         * @return {Boolean}
         */
        var isValidSendTime = function (time) {
            if (($timeHelper.gameTime() + timeOffset) > time) {
                return false
            }

            return true
        }

        /**
         * Obtem todos oficiais ativados no formulário para adicioanr comandos.
         *
         * @return {Object} Oficiais ativos
         */
        var getOfficers = function () {
            var officers = {}

            officerNames.forEach(function (officer) {
                var $input = $addForm.find('.officers .' + officer)

                if ($input.val()) {
                    officers[officer] = true
                }
            })

            return officers
        }

        /**
         * Obtem a lista de unidades porém com a catapulta como o último item.
         *
         * @return {Array}
         */
        var unitNamesCatapultLast = function () {
            var units = unitNames.filter(function (unit) {
                return unit !== 'catapult'
            })

            units.push('catapult')

            return units
        }

        var addDateDiff = function (date, diff) {
            if (!utils.isValidDateTime(date)) {
                return ''
            }

            date = utils.fixDate(date)
            date = utils.getTimeFromString(date)
            date += diff

            return formatDate(date)
        }

        /**
         * Atualiza a lista de presets na aba de configurações.
         */
        var updatePresetList = function () {
            var disabled = Locale('queue', 'add_insert_preset')
            var presets = modelDataService.getPresetList().presets
            var $data = $insertPreset.find('.custom-select-data').html('')
            var $selected = $insertPreset.find('.custom-select-handler').html(disabled)

            var $disabled = document.createElement('span')
            $disabled.dataset.name = disabled
            $disabled.dataset.value = ''
            $data.append($disabled)

            // pre-selected option
            $insertPreset[0].dataset.name = disabled

            for (var id in presets) {
                var $item = document.createElement('span')
                $item.dataset.name = presets[id].name
                $item.dataset.value = id
                $item.dataset.icon = 'size-26x26 icon-26x26-preset'
                $data.append($item)
            }
        }

        var insertPreset = function (presetId) {
            var preset = modelDataService.getPresetList().presets[presetId]

            if (!preset) {
                return false
            }

            cleanUnitInputs()

            $window.find('.add-units input.unit').forEach(function (el) {
                el.value = preset.units[el.dataset.setting] || ''
            })

            $officers.forEach(function (el) {
                var officer = el.dataset.setting

                if (preset.officers[officer]) {
                    el.checked = true
                    $(el).parent().addClass('icon-26x26-checkbox-checked')
                }
            })
        }

        var cleanUnitInputs = function () {
            $window.find('.add-units input.unit').forEach(function (el) {
                el.value = ''
            })

            $officers.forEach(function (el) {
                el.checked =false
            })

            $officers.parent().forEach(function (el) {
                $(el).removeClass('icon-26x26-checkbox-checked')
            })
        }

        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.version = '__queue_version'
        $scope.selectedTab = 'add'
    
        timeOffset = utils.getTimeOffset() 
        buildingNames = Object.keys($gameData.getBuildings())
        $player = modelDataService.getSelectedCharacter()

        // Valores a serem substituidos no template da janela
        var replaces = {
            version: Queue.version,
            locale: Locale,
            units: unitNamesCatapultLast(),
            officers: officerNames,
            buildings: buildingNames
        }

        ui = new Interface('CommandQueue', {
            activeTab: 'add',
            template: '__queue_html_window',
            replaces: replaces,
            css: '__queue_css_style'
        })

        $window = $(ui.$window)
        $switch = $window.find('a.switch')
        $addForm = $window.find('form.addForm')
        $origin = $window.find('input.origin')
        $target = $window.find('input.target')
        $date = $window.find('input.date')
        $officers = $window.find('.officers input')
        $travelTimes = $window.find('table.travelTimes')
        $dateType = $window.find('.dateType')
        $filters = $window.find('.filters')
        $catapultTarget = $window.find('td.catapult-target')
        $catapultInput = $window.find('input.unit.catapult')
        $originVillage = $window.find('.originVillage')
        $targetVillage = $window.find('.targetVillage')
        $clearUnits = $window.find('.clear-units')
        $insertPreset = $window.find('.insert-preset')
        $sections = {
            queue: $window.find('div.queue'),
            sent: $window.find('div.sent'),
            expired: $window.find('div.expired')
        }

        $travelTimes.find('.attack').forEach(function ($elem) {
            $unitTravelTimes.attack[$elem.dataset.unit] = $elem
        })

        $travelTimes.find('.support').forEach(function ($elem) {
            $unitTravelTimes.support[$elem.dataset.unit] = $elem
        })

        setInterval(function () {
            if (availableTravelTimes()) {
                populateTravelTimes()
            }
        }, 1000)

        bindEvents()
        bindCommandFilters()
        appendStoredCommands()
        listenCommandCountdown()

        socketService.emit(routeProvider.GET_PRESETS, {}, updatePresetList)
    }

    ui.template('twoverflow_queue_window', `__queue_html_main`)
    ui.css('__queue_css_style')

    opener = new FrontButton('Commander', {
        classHover: false,
        classBlur: false,
        onClick: buildWindow
    })

    eventQueue.register(eventTypeProvider.COMMAND_QUEUE_START, function () {
        opener.$elem.removeClass('btn-green').addClass('btn-red')
    })

    eventQueue.register(eventTypeProvider.COMMAND_QUEUE_STOP, function () {
        opener.$elem.removeClass('btn-red').addClass('btn-green')
    })
})
