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
    let initialized = false
    let running = false
    let secondVillageService = injector.get('secondVillageService')

    const getRunningJob = function (jobs) {
        const now = Date.now()

        for (let id in jobs) {
            if (jobs[id].time_started && jobs[id].time_completed) {
                if (now < $timeHelper.server2ClientTime(jobs[id].time_completed)) {
                    return jobs[id]
                }
            }
        }

        return false
    }

    const getCollectibleJob = function (jobs) {
        const now = Date.now()

        for (let id in jobs) {
            if (jobs[id].time_started && jobs[id].time_completed) {
                if ((now >= $timeHelper.server2ClientTime(jobs[id].time_completed)) && !jobs[id].collected) {
                    return id
                }
            }
        }

        return false
    }

    const finalizeJob = function (jobId) {
        socketService.emit(routeProvider.SECOND_VILLAGE_COLLECT_JOB_REWARD, {
            village_id: modelDataService.getSelectedVillage().getId(),
            job_id: jobId
        })
    }

    const startJob = function (jobId, callback) {
        socketService.emit(routeProvider.SECOND_VILLAGE_START_JOB, {
            village_id: modelDataService.getSelectedVillage().getId(),
            job_id: jobId
        }, callback)
    }

    const getFirstJob = function (jobs) {
        for (let id in jobs) {
            return id
        }

        return false
    }

    const updateSecondVillageInfo = function (callback) {
        socketService.emit(routeProvider.SECOND_VILLAGE_GET_INFO, {}, function (data) {
            let model = new SecondVillageModel(data)
            modelDataService.getSelectedCharacter().setSecondVillage(model)
            callback()
        })
    }

    const updateAndAnalyse = function () {
        updateSecondVillageInfo(analyse)
    }

    const analyse = function () {
        let secondVillage = modelDataService.getSelectedCharacter().getSecondVillage()

        if (!running || !secondVillage || !secondVillage.isAvailable()) {
            return false
        }

        const current = getRunningJob(secondVillage.data.jobs)

        if (current) {
            const completed = $timeHelper.server2ClientTime(current.time_completed)
            const nextRun = completed - Date.now() + 1000

            setTimeout(updateAndAnalyse, nextRun)

            return false
        }

        const collectible = getCollectibleJob(secondVillage.data.jobs)
        
        if (collectible) {
            return finalizeJob(collectible)
        }

        const currentDayJobs = secondVillageService.getCurrentDayJobs(secondVillage.data.jobs, secondVillage.data.day)
        const collectedJobs = secondVillageService.getCollectedJobs(secondVillage.data.jobs)
        const resources = modelDataService.getSelectedVillage().getResources().getResources()
        const availableJobs = secondVillageService.getAvailableJobs(currentDayJobs, collectedJobs, resources, [])

        if (availableJobs) {
            const firstJob = getFirstJob(availableJobs)

            startJob(firstJob, function () {
                const job = availableJobs[firstJob]
                setTimeout(updateAndAnalyse, (job.duration * 1000) + 1000)
            })
        }
    }

    let secondVillageCollector = {}

    secondVillageCollector.start = function () {
        if (!initialized) {
            return false
        }

        eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_SECONDVILLAGE_STARTED)
        running = true
        updateAndAnalyse()
    }

    secondVillageCollector.stop = function () {
        if (!initialized) {
            return false
        }

        eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_SECONDVILLAGE_STOPPED)
        running = false
    }

    secondVillageCollector.isRunning = function () {
        return running
    }

    secondVillageCollector.isInitialized = function () {
        return initialized
    }

    secondVillageCollector.init = function () {
        if (!secondVillageService.isFeatureActive()) {
            return false
        }

        initialized = true

        $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_VILLAGE_CREATED, updateAndAnalyse)
        $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_JOB_COLLECTED, updateAndAnalyse)
        $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_VILLAGE_CREATED, updateAndAnalyse)
    }

    autoCollector.secondVillage = secondVillageCollector
})
