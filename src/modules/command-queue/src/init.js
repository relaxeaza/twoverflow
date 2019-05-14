require([
    'two/language',
    'two/ready',
    'two/commandQueue',
    'two/commandQueue/ui',
    'two/commandQueue/Events'
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
        twoLanguage.add('__command_queue_id', __command_queue_locale)
        commandQueue.init()
        commandQueueInterface()

        if (commandQueue.getWaitingCommands().length > 0) {
            commandQueue.start(true)
        }
    })
})
