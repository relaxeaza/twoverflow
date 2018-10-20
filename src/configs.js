require([
    'two/ready',
    'Lockr',
    'ejs'
], function (
    ready,
    Lockr,
    ejs
) {
    ready(function () {
        var $player = modelDataService.getSelectedCharacter()

        // EJS settings

        ejs.delimiter = '#'

        // Lockr settings

        Lockr.prefix = $player.getId() + '_twOverflow_' + $player.getWorldId() + '-'

        // Interface settings

        angularHotkeys.add('esc', function () {
            rootScope.$broadcast(eventTypeProvider.WINDOW_CLOSED, null, true)
        }, ['INPUT', 'SELECT', 'TEXTAREA'])
    })
})
