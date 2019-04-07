require([
    'helper/i18n',
    'two/ready',
    'two/queue',
    'two/queue/ui',
    'two/queue/Events'
], function (
    i18n,
    ready,
    commandQueue,
    commandQueueInterface
) {
    if (commandQueue.initialized) {
        return false
    }

    var updateModuleLang = function () {
        var langs = __queue_locale
        var current = $rootScope.loc.ale
        var data = current in langs
            ? langs[current]
            : langs['en_us']

        i18n.setJSON(data)
    }

    ready(function () {
        updateModuleLang()

        commandQueue.init()
        commandQueueInterface()

        if (commandQueue.getWaitingCommands().length > 0) {
            commandQueue.start(true)
        }
    })
})
