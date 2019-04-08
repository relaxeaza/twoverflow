define('two/minimap/ui', [
    'two/minimap',
    'two/minimap/colorPicker',
    'two/ui2',
    'two/ui/autoComplete',
    'two/FrontButton',
    'two/utils',
    'queues/EventQueue',
    'struct/MapData',
    'cdn'
], function (
    minimap,
    colorPicker,
    interfaceOverflow,
    autoComplete,
    FrontButton,
    utils,
    eventQueue,
    $mapData,
    cdn
) {
    var $scope
    var textObject = 'minimap'
    var textObjectCommon = 'common'

    var getTribeData = function (id, callback) {
        socketService.emit(routeProvider.TRIBE_GET_PROFILE, {
            tribe_id: id
        }, callback)
    }

    var getPlayerData = function (id, callback) {
        socketService.emit(routeProvider.CHAR_GET_PROFILE, {
            character_id: id
        }, callback)
    }

    var getVillageData = function (x, y, callback) {
        $mapData.loadTownDataAsync(x, y, 1, 1, callback)
    }

    var init = function () {
        var opener = new FrontButton('Minimap', {
            classHover: false,
            classBlur: false,
            onClick: function () {
                var current = minimap.getMapPosition()
                minimap.setCurrentPosition(current[0], current[1])
                buildWindow()
            }
        })

        interfaceOverflow.template('twoverflow_minimap_window', `__minimap_html_main`)
        interfaceOverflow.css('__minimap_css_style')
    }

    var buildWindow = function () {
        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon

        $scope.selectedHighlight = {}

    }

    return init
})