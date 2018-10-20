define('two/ready', [
    'conf/gameStates'
], function (
    GAME_STATES
) {
    var ready = function (callback, which) {
        which = which || ['map']

        var readyStep = function (item) {
            which = which.filter(function (_item) {
                return _item !== item
            })

            if (!which.length) {
                callback()
            }
        }

        var handlers = {
            'map': function () {
                var mapScope = transferredSharedDataService.getSharedData('MapController')

                if (mapScope.isInitialized) {
                    return readyStep('map')
                }

                rootScope.$on(eventTypeProvider.MAP_INITIALIZED, function () {
                    readyStep('map')
                })
            },
            'tribe_relations': function () {
                var $player = modelDataService.getSelectedCharacter()

                if ($player) {
                    var $tribeRelations = $player.getTribeRelations()

                    if (!$player.getTribeId() || $tribeRelations) {
                        return readyStep('tribe_relations')
                    }
                }

                var unbind = rootScope.$on(eventTypeProvider.TRIBE_RELATION_LIST, function () {
                    unbind()
                    readyStep('tribe_relations')
                })
            },
            'initial_village': function () {
                var $gameState = modelDataService.getGameState()

                if ($gameState.getGameState(GAME_STATES.INITIAL_VILLAGE_READY)) {
                    return readyStep('initial_village')
                }

                rootScope.$on(eventTypeProvider.GAME_STATE_INITIAL_VILLAGE_READY, function () {
                    readyStep('initial_village')
                })
            },
            'all_villages_ready': function () {
                var $gameState = modelDataService.getGameState()

                if ($gameState.getGameState(GAME_STATES.ALL_VILLAGES_READY)) {
                    return readyStep('all_villages_ready')
                }

                rootScope.$on(eventTypeProvider.GAME_STATE_ALL_VILLAGES_READY, function () {
                    readyStep('all_villages_ready')
                })
            }
        }

        var mapScope = transferredSharedDataService.getSharedData('MapController')

        if (!mapScope) {
            return setTimeout(function () {
                ready(callback, which)
            }, 100)
        }

        which.forEach(function (readyItem) {
            handlers[readyItem]()
        })
    }

    return ready
})
