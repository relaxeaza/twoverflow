define('two/eventQueue', function () {
    /**
     * Callbacks usados pelos eventos que são disparados no decorrer do script.
     *
     * @type {Object}
     */
    var eventListeners = {}

    /**
     * Métodos públicos do eventQueue.
     *
     * @type {Object}
     */
    var eventQueue = {}

    /**
     * Registra um evento.
     *
     * @param {String} event - Nome do evento.
     * @param {Function} handler - Função chamada quando o evento for disparado.
     */
    eventQueue.bind = function (event, handler) {
        if (!eventListeners.hasOwnProperty(event)) {
            eventListeners[event] = []
        }

        eventListeners[event].push(handler)
    }

    /**
     * Chama os eventos.
     *
     * @param {String} event - Nome do evento.
     * @param {Array} args - Argumentos que serão passados no callback.
     */
    eventQueue.trigger = function (event, args) {
        if (eventListeners.hasOwnProperty(event)) {
            eventListeners[event].forEach(function (handler) {
                handler.apply(this, args)
            })
        }
    }

    return eventQueue
})
