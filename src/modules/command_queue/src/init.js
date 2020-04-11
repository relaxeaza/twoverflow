require([
    'two/language',
    'two/ready',
    'two/commandQueue',
    'two/commandQueue/ui',
    'two/commandQueue/events'
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
        twoLanguage.add('___command_queue_id', ___command_queue_lang) // eslint-disable-line
        commandQueue.init()
        commandQueueInterface()

        if (commandQueue.getWaitingCommands().length > 0) {
            commandQueue.start(true)
        }
    })
})
