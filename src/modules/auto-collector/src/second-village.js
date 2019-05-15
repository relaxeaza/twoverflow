define('two/autoCollector/secondVillage', [
    'two/autoCollector',
    'queues/EventQueue',
    'helper/time',
    'models/SecondVillageModel'
], function (
    autoCollector,
    eventQueue,
    $timeHelper,
    SecondVillageModel
) {
    var initialized = false
    var running = false
    var secondVillageService = injector.get('secondVillageService')

    var getRunningJob = function (jobs) {
        var now = Date.now()

        for (var id in jobs) {
            if (jobs[id].time_started && jobs[id].time_completed) {
                if (now < $timeHelper.server2ClientTime(jobs[id].time_completed)) {
                    return jobs[id]
                }
            }
        }

        return false
    }

    var getCollectibleJob = function (jobs) {
        var now = Date.now()

        for (var id in jobs) {
            if (jobs[id].time_started && jobs[id].time_completed) {
                if ((now >= $timeHelper.server2ClientTime(jobs[id].time_completed)) && !jobs[id].collected) {
                    return id
                }
            }
        }

        return false
    }

    var finalizeJob = function (jobId) {
        socketService.emit(routeProvider.SECOND_VILLAGE_COLLECT_JOB_REWARD, {
            village_id: modelDataService.getSelectedVillage().getId(),
            job_id: jobId
        })
    }

    var startJob = function (jobId, callback) {
        socketService.emit(routeProvider.SECOND_VILLAGE_START_JOB, {
            village_id: modelDataService.getSelectedVillage().getId(),
            job_id: jobId
        }, callback)
    }

    var getFirstJob = function (jobs) {
        for (var id in jobs) {
            return id
        }

        return false
    }

    var updateSecondVillageInfo = function (callback) {
        socketService.emit(routeProvider.SECOND_VILLAGE_GET_INFO, {}, function (data) {
            var model = new SecondVillageModel(data)
            modelDataService.getSelectedCharacter().setSecondVillage(model)
            callback()
        })
    }

    var updateAndAnalyse = function () {
        updateSecondVillageInfo(analyse)
    }

    var analyse = function () {
        var secondVillage = modelDataService.getSelectedCharacter().getSecondVillage()

        if (!running || !secondVillage || !secondVillage.isAvailable()) {
            return false
        }

        var current = getRunningJob(secondVillage.data.jobs)

        if (current) {
            var completed = $timeHelper.server2ClientTime(current.time_completed)
            var nextRun = completed - Date.now() + 1000
            setTimeout(updateAndAnalyse, nextRun)
            return false
        }

        var collectible = getCollectibleJob(secondVillage.data.jobs)
        
        if (collectible) {
            return finalizeJob(collectible)
        }

        var currentDayJobs = secondVillageService.getCurrentDayJobs(secondVillage.data.jobs, secondVillage.data.day)
        var collectedJobs = secondVillageService.getCollectedJobs(secondVillage.data.jobs)
        var resources = modelDataService.getSelectedVillage().getResources().getResources()
        var availableJobs = secondVillageService.getAvailableJobs(currentDayJobs, collectedJobs, resources, [])

        if (availableJobs) {
            var firstJob = getFirstJob(availableJobs)

            startJob(firstJob, function () {
                var job = availableJobs[firstJob]
                setTimeout(updateAndAnalyse, (job.duration * 1000) + 1000)
            })
        }
    }

    var secondVillageCollector = {}

    secondVillageCollector.init = function () {
        if (!secondVillageService.isFeatureActive()) {
            return false
        }

        initialized = true

        $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_VILLAGE_CREATED, updateAndAnalyse)
        $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_JOB_COLLECTED, updateAndAnalyse)
        $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_VILLAGE_CREATED, updateAndAnalyse)
    }

    secondVillageCollector.start = function () {
        if (!initialized) {
            return false
        }

        eventQueue.trigger('Collector/secondVillage/started')
        running = true
        updateAndAnalyse()
    }

    secondVillageCollector.stop = function () {
        if (!initialized) {
            return false
        }

        eventQueue.trigger('Collector/secondVillage/stopped')
        running = false
    }

    secondVillageCollector.isRunning = function () {
        return running
    }

    secondVillageCollector.isInitialized = function () {
        return initialized
    }

    autoCollector.secondVillage = secondVillageCollector
})
