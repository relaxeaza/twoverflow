require([
    'two/language',
    'two/ready',
    'two/builder',
    'two/builder/ui',
    'two/builder/events'
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
        twoLanguage.addData('__builder_id', __builder_locale)
        builderQueue.init()
        builderQueueInterface()
    })
})
