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
        twoLanguage.add('__builder_queue_id', __builder_queue_locale)
        builderQueue.init()
        builderQueueInterface()
    })
})
