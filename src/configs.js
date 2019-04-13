require([
    'two/ready',
    'Lockr'
], function (
    ready,
    Lockr
) {
    ready(function () {
        var $player = modelDataService.getSelectedCharacter()

        // Lockr settings
        Lockr.prefix = $player.getId() + '_twOverflow_' + $player.getWorldId() + '-'
    })
})
