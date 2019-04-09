define('two/minimap/ui', [
    'two/minimap',
    'two/ui2',
    'two/ui/autoComplete',
    'two/FrontButton',
    'two/utils',
    'helper/util',
    'queues/EventQueue',
    'struct/MapData',
    'cdn',
    'two/EventScope',
    'conf/colors'
], function (
    minimap,
    interfaceOverflow,
    autoComplete,
    FrontButton,
    utils,
    util,
    eventQueue,
    $mapData,
    cdn,
    EventScope,
    colors
) {
    var $scope
    var textObject = 'minimap'
    var textObjectCommon = 'common'
    var DEFAULT_TAB = 'minimap'
    var $minimapCanvas
    var $crossCanvas
    var $minimapContainer

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType

        if (tabType === 'minimap') {
            minimap.enableRendering()
            disableScrollbar()
        } else {
            minimap.disableRendering()
            enableScrollbar()
        }
    }

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

    var updateHighlights = function () {
        $scope.highlights = minimap.getHighlights()
    }

    var disableScrollbar = function () {
        util.checkFunc(function () {
            return $scope.directives
        }, function () {
            $scope.directives.scrollbar.scrollbar.disable()
        })
    }

    var enableScrollbar = function () {
        util.checkFunc(function () {
            return $scope.directives
        }, function () {
            $scope.directives.scrollbar.scrollbar.enable()
        })
    }

    var openColorPalette = function () {
        var modalScope = $rootScope.$new()

        modalScope.submit = function () {
            $scope.selectedColor = '#' + modalScope.selectedColor
            modalScope.closeWindow()
        }

        modalScope.colorPalettes = colors.palette
        modalScope.selectedColor = $scope.selectedColor
        modalScope.customColors = false
        modalScope.hideReset = true

        modalScope.finishAction = function ($event, color) {
            modalScope.selectedColor = color
        }

        windowManagerService.getModal('modal_color_palette', modalScope)
    }

    var addHighlight = function () {
        minimap.addHighlight($scope.selectedHighlight, $scope.selectedColor)
    }

    var eventHandlers = {
        autoCompleteSelect: function (data) {
            $scope.selectedHighlight = {
                id: data.id,
                type: data.type,
                name: data.name
            }
        },
        settingsReset: function () {
            // resetSettings()
        },
        highlightAdd: function (event) {
            updateHighlights()
            utils.emitNotif('success', $filter('i18n')('highlight/add/success', $rootScope.loc.ale, textObject))
        },
        highlightUpdate: function (event) {
            updateHighlights()
            utils.emitNotif('success', $filter('i18n')('highlight/update/success', $rootScope.loc.ale, textObject))
        },
        highlightRemove: function (event) {
            updateHighlights()
            utils.emitNotif('success', $filter('i18n')('highlight/remove/success', $rootScope.loc.ale, textObject))
        },
        highlightAddErrorExists: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight/add/error/exists', $rootScope.loc.ale, textObject))
        },
        highlightAddErrorNoEntry: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight/add/error/no-entry', $rootScope.loc.ale, textObject))
        },
        highlightAddErrorInvalidColor: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight/add/error/invalid-color', $rootScope.loc.ale, textObject))
        },
        onMouseLeaveMinimap: function (event) {
            // hideTooltip()
            $crossCanvas.trigger('mouseup')
        },
        onMouseMoveMinimap: function (event) {
            // hideTooltip()
            $crossCanvas.css('cursor', 'url(' + cdn.getPath('/img/cursor/grab_pushed.png') + '), move')
        },
        onMouseStopMoveMinimap: function (event) {
            $crossCanvas.css('cursor', '') 
        }
    }

    var init = function () {
        $minimapCanvas = document.createElement('canvas')
        $crossCanvas = document.createElement('canvas')

        minimap.setViewport($minimapCanvas)
        minimap.setCross($crossCanvas)

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
        $scope.selectedTab = DEFAULT_TAB
        $scope.selectedHighlight = false
        $scope.selectedColor = '#000000'
        $scope.highlights = minimap.getHighlights()
        $scope.settings = minimap.getSettings()
        $scope.autoComplete = {
            type: ['character', 'tribe', 'village'],
            placeholder: $filter('i18n')('entry/id', $rootScope.loc.ale, textObject),
            keepSelected: true,
            focus: true,
            onEnter: eventHandlers.autoCompleteSelect
        }
        
        // functions
        $scope.selectTab = selectTab
        $scope.openColorPalette = openColorPalette
        $scope.addHighlight = addHighlight

        eventScope = new EventScope('twoverflow_queue_window')
        eventScope.register(eventTypeProvider.MINIMAP_SETTINGS_RESET, eventHandlers.settingsReset)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD, eventHandlers.highlightAdd)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_UPDATE, eventHandlers.highlightUpdate)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_REMOVE, eventHandlers.highlightRemove)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_EXISTS, eventHandlers.highlightAddErrorExists)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY, eventHandlers.highlightAddErrorNoEntry)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR, eventHandlers.highlightAddErrorInvalidColor)
        // eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_HOVER, showTooltip)
        // eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_BLUR, hideTooltip)
        eventScope.register(eventTypeProvider.MINIMAP_MOUSE_LEAVE, eventHandlers.onMouseLeaveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_START_MOVE, eventHandlers.onMouseMoveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_STOP_MOVE, eventHandlers.onMouseStopMoveMinimap)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_minimap_window', $scope)
        disableScrollbar()
        $minimapContainer = document.querySelector('#two-minimap .minimap-container')
        $minimapContainer.appendChild($minimapCanvas)
        $minimapContainer.appendChild($crossCanvas)
        minimap.enableRendering()
    }

    return init
})
