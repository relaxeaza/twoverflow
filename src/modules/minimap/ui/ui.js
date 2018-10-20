define('two/minimap/ui', [
    'two/minimap',
    'two/minimap/colorPicker',
    'two/locale',
    'two/ui',
    'two/ui/autoComplete',
    'two/FrontButton',
    'two/utils',
    'two/eventQueue',
    'ejs',
    'struct/MapData',
    'cdn'
], function (
    Minimap,
    colorPicker,
    Locale,
    Interface,
    autoComplete,
    FrontButton,
    utils,
    eventQueue,
    ejs,
    $mapData,
    cdn
) {
    var ui
    var opener

    /**
     * Window elements
     */
    var $window
    var $highlights
    var $entryInput
    var $entryIcon
    var $entryName
    var $entryColor
    var $entryAdd
    var $openColorPicker
    var $tooltipBase
    var $tooltip
    var $crossCanvas
    var $minimapCanvas

    /**
     * Hex color regex validator.
     *
     * @type {RegExp}
     */
    var rhex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

    /**
     * Store the village/character/tribe selected by the player
     * to be added to highlight list.
     *
     * @type {Object}
     */
    var selectedHighlight = {}

    /**
     * Load tribe data.
     *
     * @param {Number}  id - Tribe ID.
     * @param {Function} 
     */
    var getTribeData = function (id, callback) {
        socketService.emit(routeProvider.TRIBE_GET_PROFILE, {
            tribe_id: id
        }, callback)
    }

    /**
     * Load player data.
     *
     * @param {Number}  id - Player ID.
     * @param {Function} 
     */
    var getPlayerData = function (id, callback) {
        socketService.emit(routeProvider.CHAR_GET_PROFILE, {
            character_id: id
        }, callback)
    }

    /**
     * Load village data by coords.
     *
     * @param {Number} x
     * @param {Number} y
     * @param {Function} callback
     */
    var getVillageData = function (x, y, callback) {
        $mapData.loadTownDataAsync(x, y, 1, 1, callback)
    }

    /**
     * Display the added highlight on the view.
     *
     * @param {Object} data - Village/character/tribe data.
     * @param {String} data.type - 'village', 'character' or 'tribe'.
     * @param {Number} data.id - village/character/tribe ID.
     * @param {Number=} data.x - village X coord.
     * @param {Number=} data.y - village Y coord.
     * @param {String} color - Color on hex format.
     * @param {Boolean=} _update - Remove an existing entry to recreate.
     */
    var addHighlight = function (data, color, _update) {
        if (_update) {
            $highlights[data.type].find('[id$=' + data.id + ']').remove()
        }

        var $entry = document.createElement('tr')

        $entry.id = data.type + '-' + data.id
        $entry.innerHTML = ejs.render('__minimap_html_entry', {
            type: data.type,
            id: data.id,
            color: color,
            locale: Locale
        })

        $highlights[data.type].append($entry)

        var $entryIcon = $entry.querySelector('.entry-icon')
        var $entryName = $entry.querySelector('.entry-name')
        var $entryRemove = $entry.querySelector('.entry-remove')
        var $entryColor = $entry.querySelector('.entry-color')

        $entryIcon.addEventListener('click', function () {
            openProfile(data.type, data.id)
        })

        $entryName.addEventListener('click', function () {
            openProfile(data.type, data.id)
        })

        $entryRemove.addEventListener('click', function () {
            Minimap.removeHighlight(data)
        })

        $entryColor.addEventListener('click', function () {
            colorPicker.set(this, function (color) {
                $entryColor.style.background = color
                Minimap.addHighlight(data, color)
            })
        })

        if (data.type === 'tribe') {
            getTribeData(data.id, function (data) {
                $entryName.innerHTML = data.name
            })
        } else if (data.type === 'character') {
            getPlayerData(data.id, function (data) {
                $entryName.innerHTML = data.character_name
            })
        } else if (data.type === 'village') {
            getVillageData(data.x, data.y, function (data) {
                $entryName.innerHTML = utils.genVillageLabel(data)
            })
        }
        
        ui.setTooltips()
    }

    /**
     * Remove the removed highlight from the view.
     *
     * @param {Object} data - Village/character/tribe data.
     * @param {String} data.type - 'village', 'character' or 'tribe'.
     * @param {Number} data.id - village/character/tribe ID.
     */
    var removeHighlight = function (data) {
        var $entry = ui.$window.querySelector('#' + data.type + '-' + data.id)

        if ($entry) {
            $entry.remove()
        }
    }

    /**
     * Display all pre-added hightlights to the view.
     */
    var populateHighlights = function () {
        Minimap.eachHighlight(function (type, id, data) {
            var _data = {
                type: type,
                id: id
            }

            if (type === 'village') {
                _data.x = data.x
                _data.y = data.y
            }

            addHighlight(_data, data.color)
        })
    }

    /**
     * Shows tooltip when hovering a village on minimap.
     * 
     * @param {Object} village - Village data.
     * @param {Event} event - mousemove event.
     */
    var showTooltip = function (village, event) {
        $tooltip.villageName.html(utils.genVillageLabel(village))
        $tooltip.villagePoints.html(village.points.toLocaleString())
        
        if (village.character_id) {
            $tooltip.playerName.html(village.character_name)
            $tooltip.playerPoints.html(village.character_points.toLocaleString())
        } else {
            $tooltip.playerName.html('-')
            $tooltip.playerPoints.html('-')
        }
        
        if (village.tribe_id) {
            $tooltip.tribeName.html(village.tribe_name + ' (' + village.tribe_tag + ')')
            $tooltip.tribePoints.html(village.tribe_points.toLocaleString())
        } else {
            $tooltip.tribeName.html('-')
            $tooltip.tribePoints.html('-')
        }
        
        $tooltip.provinceName.html(village.province_name)

        $tooltipBase.css('display', '')
        $tooltipBase.css('top', event.pageY - 83 + 'px')
        $tooltipBase.css('left', event.pageX + 80 + 'px')
    }

    /**
     * Hides tooltip.
     */
    var hideTooltip = function () {
        $tooltipBase.css('display', 'none')
    }

    /**
     * Open a village/player/tribe profile window.
     *
     * @param {Number} id
     */
    var openProfile = function (type, id) {
        if (type === 'village') {
            windowDisplayService.openVillageInfo(id)
        } else if (type === 'character') {
            windowDisplayService.openCharacterProfile(id)
        } else if (type === 'tribe') {
            windowDisplayService.openTribeProfile(id)
        }
    }

    /**
     * Bind all elements events and notifications.
     */
    var bindEvents = function () {
        $entryInput.on('input', function () {
            var val = $entryInput.val()

            if (val.length < 2) {
                return autoComplete.hide()
            }

            autoComplete.search(val, function (data) {
                if (data.length) {
                    autoComplete.show(data, $entryInput[0], 'minimap')
                }
            })
        })

        $openColorPicker.on('click', function () {
            colorPicker.set(this, function (color) {
                setEntryColor(color)
            })
        })

        $entryAdd.on('click', function () {
            Minimap.addHighlight(selectedHighlight, $entryColor.val())
        })

        $entryColor.on('keyup', function () {
            setEntryColor(this.value)
        })

        $window.find('.save').on('click', function (event) {
            saveSettings()
        })

        $window.find('.reset').on('click', function (event) {
            Minimap.resetSettings()
        })

        rootScope.$on(eventTypeProvider.SELECT_SELECTED, function (event, id, data) {
            if (id !== 'minimap') {
                return false
            }

            selectedHighlight.id = data.id
            selectedHighlight.type = data.type

            if (data.type === 'village') {
                selectedHighlight.x = data.x
                selectedHighlight.y = data.y
            }

            $entryIcon[0].className = 'icon-26x26-rte-' + data.type
            $entryName.html(data.name)
        })

        eventQueue.bind('minimap/settings/reset', function () {
            resetSettings()
        })

        eventQueue.bind('minimap/highlight/add', function (data, color) {
            addHighlight(data, color)
            utils.emitNotif('success', Locale('minimap', 'highlight/add/success'))
        })

        eventQueue.bind('minimap/highlight/update', function (data, color) {
            addHighlight(data, color, true)
            utils.emitNotif('success', Locale('minimap', 'highlight/update/success'))
        })

        eventQueue.bind('minimap/highlight/remove', function (data) {
            removeHighlight(data)
            utils.emitNotif('success', Locale('minimap', 'highlight/remove/success'))
        })

        eventQueue.bind('minimap/highlight/add/error/exists', function () {
            utils.emitNotif('error', Locale('minimap', 'highlight/add/error/exists'))
        })

        eventQueue.bind('minimap/highlight/add/error/no-entry', function () {
            utils.emitNotif('error', Locale('minimap', 'highlight/add/error/no-entry'))
        })

        eventQueue.bind('minimap/highlight/add/error/invalid-color', function () {
            utils.emitNotif('error', Locale('minimap', 'highlight/add/error/invalid-color'))
        })

        eventQueue.bind('minimap/villageHover', showTooltip)
        eventQueue.bind('minimap/villageBlur', hideTooltip)

        eventQueue.bind('minimap/mouseLeave', function () {
            hideTooltip()
            $crossCanvas.trigger('mouseup')
        })

        eventQueue.bind('minimap/start-move', function () {
            hideTooltip()
            $crossCanvas.css('cursor', 'url(' + cdn.getPath('/img/cursor/grab_pushed.png') + '), move')
        })

        eventQueue.bind('minimap/stop-move', function () {
            $crossCanvas.css('cursor', '') 
        })
    }

    var hex2rgb = function (hex) {
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
        var result

        hex = hex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b
        })

        result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)

        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null
    }

    var colorBrightness = function(color){
        var rgb = hex2rgb(color)
        var brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
        return brightness > 127.5 ? '#000' : '#fff'
    }

    var setEntryColor = function (color) {
        if (!rhex.test(color)) {
            return false
        }

        $entryColor.val(color)
        $entryColor.css('background', color)
        $entryColor.css('color', colorBrightness(color))
    }

    /**
     * Loop em todas configurações do BuilderQueue
     *
     * @param {Function} callback
     */
    var eachSetting = function eachSetting (callback) {
        $window.find('[data-setting]').forEach(function ($input) {
            var settingId = $input.dataset.setting

            callback($input, settingId)
        })
    }

    var resetSettings = function resetSettings () {
        for (var type in $highlights) {
            $highlights[type].html('')
        }

        populateSettings()

        utils.emitNotif('success', Locale('minimap', 'settings/reset'))
    }

    var saveSettings = function saveSettings () {
        var newSettings = {}

        eachSetting(function ($input, settingId) {
            var inputType = Minimap.settingsMap[settingId].inputType

            switch (inputType) {
            case 'select':
                newSettings[settingId] = $input.dataset.value

                break
            case 'checkbox':
                newSettings[settingId] = $input.checked

                break
            case 'colorPicker':
                newSettings[settingId] = $input.style.background

                break
            }
        })

        if (Minimap.updateSettings(newSettings)) {
            utils.emitNotif('success', Locale('minimap', 'settings.saved'))

            return true
        }

        return false
    }

    /**
     * Insere as configurações na interface.
     */
    var populateSettings = function populateSettings () {
        var settings = Minimap.getSettings()

        eachSetting(function ($input, settingId) {
            var inputType = Minimap.settingsMap[settingId].inputType
            var value = settings[settingId]
            var $handler
            var $selected

            switch (inputType) {
            case 'select':
                $input.dataset.value = value
                $handler = $input.querySelector('.custom-select-handler')
                $selected = $input.querySelector('.custom-select-data [data-value=' + value + ']')
                $handler.innerText = $selected.dataset.name

                break
            case 'checkbox':
                if (value) {
                    $input.checked = true
                    $input.parentElement.classList.add('icon-26x26-checkbox-checked')
                }

                break
            case 'colorPicker':
                $input.style.background = value

                if (!$input.dataset.done) {
                    $input.dataset.done = true

                    $input.addEventListener('click', function () {
                        colorPicker.set(this, function (color) {
                            $input.style.background = color
                        })
                    })
                }

                break
            }
        })
    }

    /**
     * Minimap interface init function.
     */
    var MinimapInterface = function () {
        ui = new Interface('Minimap', {
            activeTab: 'minimap',
            template: '__minimap_html_window',
            css: '__minimap_css_style',
            replaces: {
                locale: Locale,
                version: Minimap.version,
                types: ['village', 'character', 'tribe'],
                colorPalette: Minimap.colorPalette,
                settings: Minimap.getSettings()
            },
            onTabClick: function (tab) {
                tab === 'minimap'
                    ? ui.$scrollbar.disable()
                    : ui.$scrollbar.enable()
            }
        })

        opener = new FrontButton('Minimap', {
            classHover: false,
            classBlur: false,
            onClick: function () {
                var current = Minimap.getMapPosition()
                Minimap.setCurrentPosition(current[0], current[1])

                ui.openWindow()
            }
        })

        ui.$scrollbar.disable()

        $window = $(ui.$window)
        $entryInput = $window.find('.item-input input')
        $entryIcon = $window.find('.item-icon')
        $entryName = $window.find('.item-name')
        $entryColor = $window.find('.item-color')
        $entryAdd = $window.find('.item-add')
        $openColorPicker = $window.find('.open-color-picker')
        $tooltipBase = $window.find('.minimap-tooltip')
        $tooltip = {
            villageName: $tooltipBase.find('.village-name'),
            villagePoints: $tooltipBase.find('.village-points'),
            playerName: $tooltipBase.find('.player-name'),
            playerPoints: $tooltipBase.find('.player-points'),
            tribeName: $tooltipBase.find('.tribe-name'),
            tribePoints: $tooltipBase.find('.tribe-points'),
            provinceName: $tooltipBase.find('.province-name'),
        }
        $highlights = {
            village: $window.find('.village'),
            character: $window.find('.character'),
            tribe: $window.find('.tribe')
        }
        $crossCanvas = $window.find('.cross')
        $minimapCanvas = $window.find('.minimap')

        Minimap.setViewport($minimapCanvas[0])
        Minimap.setCross($crossCanvas[0])

        colorPicker.init(ui)
        populateSettings()
        bindEvents()
        populateHighlights()

        Minimap.interfaceInitialized = true

        return ui
    }

    Minimap.interface = function () {
        Minimap.interface = MinimapInterface()
    }
})
