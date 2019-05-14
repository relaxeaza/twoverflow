require([
    'two/language',
    'two/ready',
    'two/queue',
    'two/queue/ui',
    'two/queue/Events'
], function (
    twoLanguage,
    ready,
    commandQueue,
    commandQueueInterface
) {
    if (commandQueue.initialized) {
        return false
    }

    ready(function () {
        twoLanguage.add('__queue_id', __queue_locale)
        commandQueue.init()
        commandQueueInterface()

        if (commandQueue.getWaitingCommands().length > 0) {
            commandQueue.start(true)
        }
    })
})
