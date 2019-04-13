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

    var selectTab = function (tab) {
        $scope.selectedTab = tab

        if (tab === 'minimap') {
            minimap.enableRendering()
        } else {
            minimap.disableRendering()
        }

        if (tab === 'highlights') {
            util.checkFunc(function () {
                return $scope.directives
            }, function () {
                $timeout(function () {
                    $scope.directives.scrollbar['minimap-highlights'].recalc()
                })
            })
        }
    }

    var appendCanvas = function () {
        $minimapContainer = document.querySelector('#two-minimap .minimap-container')
        $minimapContainer.appendChild($minimapCanvas)
        $minimapContainer.appendChild($crossCanvas)
    }

    var getTribeData = function (data, callback) {
        socketService.emit(routeProvider.TRIBE_GET_PROFILE, {
            tribe_id: data.id
        }, callback)
    }
    
    var getCharacterData = function (data, callback) {
        socketService.emit(routeProvider.CHAR_GET_PROFILE, {
            character_id: data.id
        }, callback)
    }

    var getVillageData = function (data, callback) {
        $mapData.loadTownDataAsync(data.x, data.y, 1, 1, callback)
    }

    var loadHighlightsName = function () {
        Object.keys($scope.highlights.village).forEach(function (id) {
            if ($scope.highlights.village[id].name) {
                return
            }

            getVillageData({
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

            getCharacterData({
                id: id
            }, function (data) {
                $scope.highlights.character[id].name = data.character_name
            })
        })

        Object.keys($scope.highlights.tribe).forEach(function (id) {
            if ($scope.highlights.tribe[id].name) {
                return
            }

            getTribeData({
                id: id
            }, function (data) {
                $scope.highlights.tribe[id].name = data.name
            })
        })
    }

    var showTooltip = function (_, data) {
        var windowOffset
        var tooltipOffset
        var onTop
        var onLeft

        windowWrapper.appendChild(tooltipWrapper)
        tooltipWrapper.classList.remove('ng-hide')

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
        MapController.tt.position.x = data.event.pageX + 50
        MapController.tt.position.y = data.event.pageY + 50
        MapController.tt.visible = true

        tooltipOffset = tooltipWrapper.getBoundingClientRect()
        windowOffset = windowWrapper.getBoundingClientRect()
        tooltipWrapperSpacer.x = tooltipOffset.width + 50
        tooltipWrapperSpacer.y = tooltipOffset.height + 50

        onTop = MapController.tt.position.y + tooltipWrapperSpacer.y > windowOffset.top + windowOffset.height
        onLeft = MapController.tt.position.x + tooltipWrapperSpacer.x > windowOffset.width

        if (onTop) {
            MapController.tt.position.y -= 50
        }

        tooltipWrapper.classList.toggle('left', onLeft)
        tooltipWrapper.classList.toggle('top', onTop)
    }

    var hideTooltip = function () {
        MapController.tt.visible = false
        tooltipWrapper.classList.add('ng-hide')
        mapWrapper.appendChild(tooltipWrapper)
    }

    var openColorPalette = function (inputType, data) {
        var modalScope = $rootScope.$new()
        var selectedColor
        var hideReset = true

        modalScope.colorPalettes = colors.palette

        if (inputType === 'setting') {
            selectedColor = $scope.settings[data]
            hideReset = false

            modalScope.submit = function () {
                $scope.settings[data] = '#' + modalScope.selectedColor
                modalScope.closeWindow()
            }

            modalScope.reset = function () {
                $scope.settings[data] = SETTINGS_MAP[data].default
                modalScope.closeWindow()
            }
        } else if (inputType === 'add_custom_highlight') {
            selectedColor = $scope.addHighlightColor

            modalScope.submit = function () {
                $scope.addHighlightColor = '#' + modalScope.selectedColor
                modalScope.closeWindow()
            }
        } else if (inputType === 'edit_custom_highlight') {
            selectedColor = data.color

            modalScope.submit = function () {
                data.color = '#' + modalScope.selectedColor
                minimap.addHighlight(data, data.color)
                modalScope.closeWindow()
            }
        }

        modalScope.selectedColor = selectedColor.split('#')[1]
        modalScope.hasCustomColors = true
        modalScope.hideReset = hideReset

        modalScope.finishAction = function ($event, color) {
            modalScope.selectedColor = color
        }

        windowManagerService.getModal('modal_color_palette', modalScope)
    }

    var addCustomHighlight = function () {
        minimap.addHighlight($scope.selectedHighlight, $scope.addHighlightColor)
    }

    var saveSettings = function () {
        var settingsCopy = angular.copy($scope.settings)
        settingsCopy[SETTINGS.RIGHT_CLICK_ACTION] = settingsCopy[SETTINGS.RIGHT_CLICK_ACTION].value
        minimap.updateSettings(settingsCopy)
    }

    var parseSettings = function (rawSettings) {
        var settings = angular.copy(rawSettings)

        settings[SETTINGS.RIGHT_CLICK_ACTION] = {
            value: settings[SETTINGS.RIGHT_CLICK_ACTION],
            name: $filter('i18n')(settings[SETTINGS.RIGHT_CLICK_ACTION], $rootScope.loc.ale, textObject)
        }

        return settings
    }

    var resetSettings = function () {
        var modalScope = $rootScope.$new()

        modalScope.title = $filter('i18n')('reset_confirm_title', $rootScope.loc.ale, textObject)
        modalScope.text = $filter('i18n')('reset_confirm_text', $rootScope.loc.ale, textObject)
        modalScope.boxText = $filter('i18n')('reset_confirm_highlights_text', $rootScope.loc.ale, textObject)
        modalScope.submitText = $filter('i18n')('reset', $rootScope.loc.ale, textObjectCommon)
        modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, textObjectCommon)
        modalScope.showQuestionMarkIcon = true
        modalScope.switchColors = true

        modalScope.submit = function submit() {
            minimap.resetSettings()
            modalScope.closeWindow()
        }

        modalScope.cancel = function cancel() {
            modalScope.closeWindow()
        }

        windowManagerService.getModal('modal_attention', modalScope)
    }

    var highlightsCount = function () {
        var villages = Object.keys($scope.highlights.village).length
        var characters = Object.keys($scope.highlights.character).length
        var tribes = Object.keys($scope.highlights.tribe).length
        
        return villages + characters + tribes
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
            $scope.settings = parseSettings(minimap.getSettings())
            $scope.highlights = angular.copy(minimap.getHighlights())

            utils.emitNotif('success', $filter('i18n')('settings_reset', $rootScope.loc.ale, textObject))
        },
        settingsSave: function () {
            utils.emitNotif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, textObject))
        },
        highlightAdd: function (event, data) {
            $scope.highlights[data.item.type][data.item.id] = angular.extend(data.item, {
                color: data.color
            })

            loadHighlightsName()

            // utils.emitNotif('success', $filter('i18n')('highlight_add_success', $rootScope.loc.ale, textObject))
        },
        highlightUpdate: function (event, data) {
            $scope.highlights[data.item.type][data.item.id].color = data.color
            // utils.emitNotif('success', $filter('i18n')('highlight_update_success', $rootScope.loc.ale, textObject))
        },
        highlightRemove: function (event, data) {
            delete $scope.highlights[data.item.type][data.item.id]
            // utils.emitNotif('success', $filter('i18n')('highlight_remove_success', $rootScope.loc.ale, textObject))
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
        var id
        var opener

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

        for (id in ACTION_TYPES) {
            actionTypes.push({
                value: ACTION_TYPES[id],
                name: $filter('i18n')(ACTION_TYPES[id], $rootScope.loc.ale, textObject)
            })
        }

        opener = new FrontButton('Minimap', {
            classHover: false,
            classBlur: false,
            onClick: function () {
                var current = minimap.getMapPosition()
                minimap.setCurrentPosition(current[0], current[1])
                buildWindow()
            }
        })

        interfaceOverflow.addTemplate('twoverflow_minimap_window', `__minimap_html_main`)
        interfaceOverflow.addStyle('__minimap_css_style')
    }

    var buildWindow = function () {
        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.SETTINGS = SETTINGS
        $scope.selectedTab = DEFAULT_TAB
        $scope.selectedHighlight = false
        $scope.addHighlightColor = '#000000'
        $scope.highlights = angular.copy(minimap.getHighlights())
        $scope.settings = parseSettings(minimap.getSettings())
        $scope.actionTypes = actionTypes
        $scope.autoComplete = {
            type: ['character', 'tribe', 'village'],
            placeholder: $filter('i18n')('placeholder_search', $rootScope.loc.ale, textObject),
            onEnter: eventHandlers.addHighlightAutoCompleteSelect
        }

        // functions
        $scope.selectTab = selectTab
        $scope.openColorPalette = openColorPalette
        $scope.addCustomHighlight = addCustomHighlight
        $scope.removeHighlight = minimap.removeHighlight
        $scope.saveSettings = saveSettings
        $scope.resetSettings = resetSettings
        $scope.highlightsCount = highlightsCount

        eventScope = new EventScope('twoverflow_minimap_window')
        eventScope.register(eventTypeProvider.MINIMAP_SETTINGS_RESET, eventHandlers.settingsReset)
        eventScope.register(eventTypeProvider.MINIMAP_SETTINGS_SAVE, eventHandlers.settingsSave)
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
        loadHighlightsName()
        appendCanvas()
        minimap.enableRendering()
    }

    return init
})
