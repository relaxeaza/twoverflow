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
        twoLanguage.add('{: builder_queue_id :}', {: builder_queue_lang :})
        builderQueue.init()
        builderQueueInterface()
    })
})
