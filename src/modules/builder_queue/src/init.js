require([
    'two/language',
    'two/ready',
    'two/builderQueue',
    'two/builderQueue/ui',
    'two/builderQueue/events'
], function (
    twoLanguage,
    ready,
    builderQueue,
    builderQueueInterface
) {
    if (builderQueue.isInitialized()) {
        return false
    }

    ready(function () {
        twoLanguage.add('___builder_queue_id', ___builder_queue_lang) // eslint-disable-line
        builderQueue.init()
        builderQueueInterface()
    })
})
