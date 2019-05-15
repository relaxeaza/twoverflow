define('two/autoCollector', [
    'queues/EventQueue',
    'helper/time',
    'Lockr'
], function (
    eventQueue,
    $timeHelper,
    Lockr
) {
    /**
     * Indica se o modulo já foi iniciado.
     *
     * @type {Boolean}
     */
    var initialized = false

    /**
     * Indica se o modulo está em funcionamento.
     *
     * @type {Boolean}
     */
    var running = false

    /**
     * Permite que o evento RESOURCE_DEPOSIT_JOB_COLLECTIBLE seja executado
     * apenas uma vez.
     *
     * @type {Boolean}
     */
    var recall = true

    /**
     * Next automatic reroll setTimeout ID.
     * 
     * @type {Number}
     */
    var nextUpdateId = 0

    /**
     * Inicia um trabalho.
     *
     * @param {Object} job - Dados do trabalho
     */
    var startJob = function (job) {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_START_JOB, {
            job_id: job.id
        })
    }

    /**
     * Coleta um trabalho.
     *
     * @param {Object} job - Dados do trabalho
     */
    var finalizeJob = function (job) {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_COLLECT, {
            job_id: job.id,
            village_id: modelDataService.getSelectedVillage().getId()
        })
    }

    /**
     * Força a atualização das informações do depósito.
     */
    var updateDepositInfo = function () {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_GET_INFO, {})
    }

    /**
     * Faz a analise dos trabalhos sempre que um evento relacionado ao depósito
     * é disparado.
     */
    var analyse = function () {
        if (!running) {
            return false
        }

        var data = modelDataService.getSelectedCharacter().getResourceDeposit()

        if (!data) {
            return false
        }

        var current = data.getCurrentJob()

        if (current) {
            return false
        }

        var collectible = data.getCollectibleJobs()

        if (collectible) {
            return finalizeJob(collectible.shift())
        }

        var ready = data.getReadyJobs()

        if (ready) {
            return startJob(getFastestJob(ready))
        }
    }

    /**
     * Obtem o trabalho de menor duração.
     *
     * @param {Array} jobs - Lista de trabalhos prontos para serem iniciados.
     */
    var getFastestJob = function (jobs) {
        var sorted = jobs.sort(function (a, b) {
            return a.duration - b.duration
        })

        return sorted[0]
    }

    /**
     * Atualiza o timeout para que seja forçado a atualização das informações
     * do depósito quando for resetado.
     * Motivo: só é chamado automaticamente quando um milestone é resetado,
     * e não o diário.
     * 
     * @param {Object} data - Os dados recebidos de RESOURCE_DEPOSIT_INFO
     */
    var rerollUpdater = function (data) {
        var timeLeft = data.time_next_reset * 1000 - Date.now() + 1000

        clearTimeout(nextUpdateId)
        nextUpdateId = setTimeout(updateDepositInfo, timeLeft)
    }

    /**
     * Métodos públicos do AutoCollector.
     *
     * @type {Object}
     */
    var autoCollector = {}

    /**
     * Inicializa o AutoDepois, configura os eventos.
     */
    autoCollector.init = function () {
        initialized = true

        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOB_COLLECTIBLE, function () {
            if (!recall || !running) {
                return false
            }

            recall = false

            setTimeout(function () {
                recall = true
                analyse()
            }, 1500)
        })

        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOBS_REROLLED, analyse)
        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOB_COLLECTED, analyse)
        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_INFO, function (event, data) {
            analyse()
            rerollUpdater(data)
        })
    }

    /**
     * Inicia a analise dos trabalhos.
     */
    autoCollector.start = function () {
        eventQueue.trigger('Collector/started')
        running = true
        analyse()
    }

    /**
     * Para a analise dos trabalhos.
     */
    autoCollector.stop = function () {
        eventQueue.trigger('Collector/stopped')
        running = false
    }

    /**
     * Retorna se o modulo está em funcionamento.
     */
    autoCollector.isRunning = function () {
        return running
    }

    /**
     * Retorna se o modulo está inicializado.
     */
    autoCollector.isInitialized = function () {
        return initialized
    }

    return autoCollector
})
