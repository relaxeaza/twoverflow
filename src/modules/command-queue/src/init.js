require([
    'two/ready',
    'two/queue',
    'two/queue/ui',
    'two/queue/analytics'
], function (
    ready,
    Queue
) {
    if (Queue.initialized) {
        return false
    }

    ready(function () {
        Queue.init()
        Queue.interface()
        Queue.analytics()

        if (Queue.getWaitingCommands().length > 0) {
            Queue.start(true)
        }
    })
})
