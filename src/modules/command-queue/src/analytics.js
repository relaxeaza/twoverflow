define('two/queue/analytics', [
    'two/queue',
    'two/eventQueue'
], function (Queue, eventQueue) {
    Queue.analytics = function () {
        ga('create', '__queue_analytics', 'auto', '__queue_name')

        var player = modelDataService.getPlayer()
        var character = player.getSelectedCharacter()
        var data = []

        data.push(character.getName())
        data.push(character.getId())
        data.push(character.getWorldId())

        eventQueue.bind('Queue/send', function (command) {
            ga('__queue_name.send', 'event', 'commands', command.type, data.join('~'))
        })

        eventQueue.bind('Queue/expired', function () {
            ga('__queue_name.send', 'event', 'commands', 'expired', data.join('~'))
        })
    }
})
