require([
    'two/ready',
    'Lockr'
], function (
    ready,
    Lockr
) {
    ready(function () {
        const $player = modelDataService.getSelectedCharacter();

        // Lockr settings
        Lockr.prefix = $player.getId() + '_twOverflow_' + $player.getWorldId() + '-';
    });
});
