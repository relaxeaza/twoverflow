define('two/utils', [
    'helper/time'
], function ($timeHelper) {
    var notifTimeout = null
    var utils = {}

    /**
     * Gera um número aleatório aproximado da base.
     *
     * @param {Number} base - Número base para o calculo.
     */
    utils.randomSeconds = function (base) {
        base = parseInt(base, 10)

        var max = base + (base / 2)
        var min = base - (base / 2)

        return Math.round(Math.random() * (max - min) + min)
    }

    /**
     * Converte uma string com um tempo em segundos.
     *
     * @param {String} time - Tempo que será convertido (hh:mm:ss)
     */
    utils.time2seconds = function (time) {
        time = time.split(':')
        time[0] = parseInt(time[0], 10) * 60 * 60
        time[1] = parseInt(time[1], 10) * 60
        time[2] = parseInt(time[2], 10)

        return time.reduce(function (a, b) {
            return a + b
        })
    }

    /**
     * Emite notificação nativa do jogo.
     *
     * @param {String} type - success || error
     * @param {String} message - Texto a ser exibido
     */
    utils.emitNotif = function (type, message) {
        var eventType = type === 'success'
            ? eventTypeProvider.MESSAGE_SUCCESS
            : eventTypeProvider.MESSAGE_ERROR

        rootScope.$broadcast(eventType, {
            message: message
        })
    }


    /**
     * Gera uma string com nome e coordenadas da aldeia
     *
     * @param {Object} village - Dados da aldeia
     * @return {String}
     */
    utils.genVillageLabel = function (village) {
        return village.name + ' (' + village.x + '|' + village.y + ')'
    }

    /**
     * Verifica se uma coordenada é válida.
     * 00|00
     * 000|00
     * 000|000
     * 00|000
     *
     * @param {String} xy - Coordenadas
     * @return {Boolean}
     */
    utils.isValidCoords = function (xy) {
        return /\s*\d{2,3}\|\d{2,3}\s*/.test(xy)
    }

    /**
     * Validação de horario e data de envio. Exmplo: 23:59:00:999 30/12/2016
     *
     * @param  {String}  dateTime
     * @return {Boolean}
     */
    utils.isValidDateTime = function (dateTime) {
        return /^\s*([01][0-9]|2[0-3]):[0-5]\d:[0-5]\d(:\d{1,3})? (0[1-9]|[12][0-9]|3[0-1])\/(0[1-9]|1[0-2])\/\d{4}\s*$/.test(dateTime)
    }

    /**
     * Inverte a posição do dia com o mês.
     */
    utils.fixDate = function (dateTime) {
        var dateAndTime = dateTime.split(' ')
        var time = dateAndTime[0]
        var date = dateAndTime[1].split('/')

        return time + ' ' + date[1] + '/' + date[0] + '/' + date[2]
    }

    /**
     * Gera um id unico
     *
     * @return {String}
     */
    utils.guid = function () {
        return Math.floor((Math.random()) * 0x1000000).toString(16)
    }

    /**
     * Verifica se um elemento é pertencente a outro elemento.
     *
     * @param  {Element} elem - Elemento referencia
     * @param  {String} selector - Selector CSS do elemento no qual será
     *   será verificado se tem relação com o elemento indicado.
     * @return {Boolean}
     */
    utils.matchesElem = function (elem, selector) {
        if ($(elem).parents(selector).length) {
            return true
        }

        return false
    }

    /**
     * Obtem o timestamp de uma data em string.
     * Formato da data: mês/dia/ano
     * Exmplo de entrada: 23:59:59:999 12/30/2017
     *
     * @param  {String} dateString - Data em formato de string.
     * @return {Number} Timestamp (milisegundos)
     */
    utils.getTimeFromString = function (dateString, offset) {
        var dateSplit = dateString.trim().split(' ')
        var time = dateSplit[0].split(':')
        var date = dateSplit[1].split('/')

        var hour = time[0]
        var min = time[1]
        var sec = time[2]
        var ms = time[3] || null

        var month = parseInt(date[0], 10) - 1
        var day = date[1]
        var year = date[2]

        var date = new Date(year, month, day, hour, min, sec, ms)

        return date.getTime() + (offset || 0)
    }

    /**
     * Formata milisegundos em hora/data
     *
     * @return {String} Data e hora formatada
     */
    utils.formatDate = function (ms, format) {
        return $filter('readableDateFilter')(
            ms,
            null,
            rootScope.GAME_TIMEZONE,
            rootScope.GAME_TIME_OFFSET,
            format || 'HH:mm:ss dd/MM/yyyy'
        )
    }

    /**
     * Obtem a diferença entre o timezone local e do servidor.
     *
     * @type {Number}
     */
    utils.getTimeOffset = function () {
        var localDate = $timeHelper.gameDate()
        var localOffset = localDate.getTimezoneOffset() * 1000 * 60
        var serverOffset = rootScope.GAME_TIME_OFFSET

        return localOffset + serverOffset
    }

    utils.xhrGet = function (url, _callback, _dataType) {
        if (!url) {
            return false
        }

        _dataType = _dataType || 'text'
        _callback = _callback || function () {}

        var xhr

        xhr = new XMLHttpRequest()
        xhr.open('GET', url, true)
        xhr.responseType = _dataType
        xhr.addEventListener('load', function () {
            _callback(xhr.response)
        }, false)

        xhr.send()
    }

    return utils
})
