require([
    'two/ready',
    'two/queue',
    'two/queue/ui'
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

        if (Queue.getWaitingCommands().length > 0) {
            Queue.start(true)
        }
    })
})
