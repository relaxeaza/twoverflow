require([
    'two/ready',
    'Lockr'
], function (
    ready,
    Lockr
) {
    ready(function () {
        let $player = modelDataService.getSelectedCharacter()

        // Lockr settings
        Lockr.prefix = $player.getId() + '_twOverflow_' + $player.getWorldId() + '-'
    })
})
