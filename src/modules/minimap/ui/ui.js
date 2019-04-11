define('two/minimap/ui', [
    'two/minimap',
    'two/minimap/actionTypes',
    'two/minimap/settingsMap',
    'two/minimap/settings',
    'two/ui2',
    'two/ui/autoComplete',
    'two/FrontButton',
    'two/utils',
    'helper/util',
    'queues/EventQueue',
    'struct/MapData',
    'cdn',
    'two/EventScope',
    'conf/colors',
], function (
    minimap,
    ACTION_TYPES,
    SETTINGS_MAP,
    SETTINGS,
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
    var actionTypes = []
    var selectedActionType = {}
    var MapController
    var tooltipWrapper
    var windowWrapper
    var mapWrapper
    var tooltipWrapperSpacer = {}

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

    var appendCanvas = function () {
        $minimapContainer = document.querySelector('#two-minimap .minimap-container')
        $minimapContainer.appendChild($minimapCanvas)
        $minimapContainer.appendChild($crossCanvas)
    }

    var getData = {
        tribe: function (data, callback) {
            socketService.emit(routeProvider.TRIBE_GET_PROFILE, {
                tribe_id: data.id
            }, callback)
        },
        character: function (data, callback) {
            socketService.emit(routeProvider.CHAR_GET_PROFILE, {
                character_id: data.id
            }, callback)
        },
        village: function (data, callback) {
            $mapData.loadTownDataAsync(data.x, data.y, 1, 1, callback)
        }
    }

    var loadHighlightsName = function () {
        Object.keys($scope.highlights.village).forEach(function (id) {
            if ($scope.highlights.village[id].name) {
                return
            }

            getData.village({
                id: id,
                x: $scope.highlights.village[id].x,
                y: $scope.highlights.village[id].y
            }, function (data) {
                $scope.highlights.village[id].name = utils.genVillageLabel(data)
            })
        })

        Object.keys($scope.highlights.character).forEach(function (id) {
            if ($scope.highlights.character[id].name) {
                return
            }

            getData.character({
                id: id
            }, function (data) {
                $scope.highlights.character[id].name = data.character_name
            })
        })

        Object.keys($scope.highlights.tribe).forEach(function (id) {
            if ($scope.highlights.tribe[id].name) {
                return
            }

            getData.tribe({
                id: id
            }, function (data) {
                $scope.highlights.tribe[id].name = data.name
            })
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
        modalScope.customColors = true
        modalScope.hideReset = true

        modalScope.finishAction = function ($event, color) {
            modalScope.selectedColor = color
        }

        windowManagerService.getModal('modal_color_palette', modalScope)
    }

    var addHighlight = function () {
        minimap.addHighlight($scope.selectedHighlight, $scope.selectedColor)
    }

    var saveSettings = function () {

    }

    var parseSettings = function (rawSettings) {
        var settings = angular.copy(rawSettings)

        settings[SETTINGS.RIGHT_CLICK_ACTION] = {
            value: settings[SETTINGS.RIGHT_CLICK_ACTION],
            name: $filter('i18n')(settings[SETTINGS.RIGHT_CLICK_ACTION], $rootScope.loc.ale, textObject)
        }

        return settings
    }

    var moveTooltip = function (to) {
        if (to === 'minimap') {
            windowWrapper.appendChild(tooltipWrapper)
            tooltipWrapper.classList.remove('ng-hide')
        } else if (to === 'map') {
            tooltipWrapper.classList.add('ng-hide')
            mapWrapper.appendChild(tooltipWrapper)
        }
    }

    var showTooltip = function (_, data) {
        var windowOffset
        var tooltipOffset

        moveTooltip('minimap')

        MapController.tt.name = data.village.name
        MapController.tt.x = data.village.x
        MapController.tt.y = data.village.y
        MapController.tt.province_name = data.village.province_name
        MapController.tt.points = data.village.points
        MapController.tt.character_name = data.village.character_name || '-'
        MapController.tt.character_points = data.village.character_points || 0
        MapController.tt.tribe_name = data.village.tribe_name || '-'
        MapController.tt.tribe_tag = data.village.tribe_tag || '-'
        MapController.tt.tribe_points = data.village.tribe_points || 0
        MapController.tt.morale = data.village.morale || 0
        MapController.tt.position = {}
        MapController.tt.position.x = data.event.pageX
        MapController.tt.position.y = data.event.pageY
        MapController.tt.visible = true

        tooltipOffset = tooltipWrapper.getBoundingClientRect()
        windowOffset = windowWrapper.getBoundingClientRect()
        tooltipWrapperSpacer.x = tooltipOffset.width + 50
        tooltipWrapperSpacer.y = tooltipOffset.height + 50
        tooltipWrapper.classList.toggle('left', MapController.tt.position.x + tooltipWrapperSpacer.x > windowOffset.width)
        tooltipWrapper.classList.toggle('top', MapController.tt.position.y + tooltipWrapperSpacer.y > windowOffset.top + windowOffset.height)
    }

    var hideTooltip = function () {
        MapController.tt.visible = false
        moveTooltip('map')
    }

    var eventHandlers = {
        addHighlightAutoCompleteSelect: function (item) {
            $scope.selectedHighlight = {
                id: item.id,
                type: item.type,
                name: item.name
            }

            if (item.x) {
                $scope.selectedHighlight.x = item.x
                $scope.selectedHighlight.y = item.y
            }
        },
        settingsReset: function () {
            // resetSettings()
        },
        highlightAdd: function (event, data) {
            $scope.highlights[data.item.type][data.item.id] = { color: data.color }
            loadHighlightsName()
            utils.emitNotif('success', $filter('i18n')('highlight_add_success', $rootScope.loc.ale, textObject))
        },
        highlightUpdate: function (event, data, color) {
            $scope.highlights[data.item.type][data.item.id].color = data.color
            utils.emitNotif('success', $filter('i18n')('highlight_update_success', $rootScope.loc.ale, textObject))
        },
        highlightRemove: function (event, data) {
            delete $scope.highlights[data.item.type][data.item.id]
            utils.emitNotif('success', $filter('i18n')('highlight_remove_success', $rootScope.loc.ale, textObject))
        },
        highlightAddErrorExists: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight_add_error_exists', $rootScope.loc.ale, textObject))
        },
        highlightAddErrorNoEntry: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight_add_error_no_entry', $rootScope.loc.ale, textObject))
        },
        highlightAddErrorInvalidColor: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight_add_error_invalid_color', $rootScope.loc.ale, textObject))
        },
        onMouseLeaveMinimap: function (event) {
            var event = new MouseEvent('mouseup', {
                view: window,
                bubbles: true,
                cancelable: true
            })

            hideTooltip()
            $crossCanvas.dispatchEvent(event)
        },
        onMouseMoveMinimap: function (event) {
            hideTooltip()
            $crossCanvas.style.cursor = 'url(' + cdn.getPath('/img/cursor/grab_pushed.png') + '), move'
        },
        onMouseStopMoveMinimap: function (event) {
            $crossCanvas.style.cursor = ''
        }
    }

    var init = function () {
        MapController = transferredSharedDataService.getSharedData('MapController')
        $minimapCanvas = document.createElement('canvas')
        $minimapCanvas.className = 'minimap'
        $crossCanvas = document.createElement('canvas')
        $crossCanvas.className = 'cross'

        minimap.setViewport($minimapCanvas)
        minimap.setCross($crossCanvas)

        tooltipWrapper = document.querySelector('#map-tooltip')
        windowWrapper = document.querySelector('#wrapper')
        mapWrapper = document.querySelector('#map')

        for (var id in ACTION_TYPES) {
            actionTypes.push({
                value: id,
                name: $filter('i18n')(ACTION_TYPES[id], $rootScope.loc.ale, textObject)
            })
        }

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
        $scope.SETTINGS = SETTINGS
        $scope.selectedTab = DEFAULT_TAB
        $scope.selectedHighlight = false
        $scope.selectedColor = '#000000'
        $scope.highlights = angular.copy(minimap.getHighlights())
        $scope.settings = parseSettings(minimap.getSettings())
        $scope.actionTypes = actionTypes
        $scope.autoComplete = {
            type: ['character', 'tribe', 'village'],
            placeholder: $filter('i18n')('placeholder_search', $rootScope.loc.ale, textObject),
            keepSelected: true,
            focus: true,
            onEnter: eventHandlers.addHighlightAutoCompleteSelect
        }

        
        // functions
        $scope.selectTab = selectTab
        $scope.openColorPalette = openColorPalette
        $scope.addHighlight = addHighlight
        $scope.removeHighlight = minimap.removeHighlight

        eventScope = new EventScope('twoverflow_minimap_window')
        eventScope.register(eventTypeProvider.MINIMAP_SETTINGS_RESET, eventHandlers.settingsReset)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD, eventHandlers.highlightAdd)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_UPDATE, eventHandlers.highlightUpdate)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_REMOVE, eventHandlers.highlightRemove)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_EXISTS, eventHandlers.highlightAddErrorExists)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY, eventHandlers.highlightAddErrorNoEntry)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR, eventHandlers.highlightAddErrorInvalidColor)
        eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_HOVER, showTooltip)
        eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_BLUR, hideTooltip)
        eventScope.register(eventTypeProvider.MINIMAP_MOUSE_LEAVE, eventHandlers.onMouseLeaveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_START_MOVE, eventHandlers.onMouseMoveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_STOP_MOVE, eventHandlers.onMouseStopMoveMinimap)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_minimap_window', $scope)
        disableScrollbar()
        loadHighlightsName()
        appendCanvas()
        minimap.enableRendering()
    }

    return init
})
