define('two/minimap', [
    'two/minimap/types/actions',
    'two/minimap/settings',
    'two/minimap/settings/map',
    'two/minimap/settings/updates',
    'two/utils',
    'two/ready',
    'two/Settings',
    'two/mapData',
    'queues/EventQueue',
    'Lockr',
    'struct/MapData',
    'helper/mapconvert',
    'cdn',
    'conf/colors',
    'conf/colorGroups',
    'conf/conf',
    'version',
    'states/MapState',
    'battlecat'
], function (
    ACTION_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    utils,
    ready,
    Settings,
    twoMapData,
    eventQueue,
    Lockr,
    mapData,
    mapconvert,
    cdn,
    colors,
    colorGroups,
    conf,
    gameVersion,
    mapState,
    $
) {
    let enableRendering = false
    let highlights = {}
    let villageSize = 5 // 3, 5, 7
    let villageMargin = 1
    let villageBlock = villageSize + villageMargin
    let lineSize = 1000 * (villageSize + villageMargin)
    const rhex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    let allVillages
    let cache = {
        village: {},
        character: {},
        tribe: {}
    }
    let cachedVillages = {}
    // Data of the village that the user is hovering on the minimap.
    let hoverVillage = null
    let $viewport
    let $viewportContext
    let $viewportCache
    let $viewportCacheContext
    let $cross
    let $crossContext
    // Game main canvas map.
    // Used to calculate the position cross position based on canvas size.
    let $map
    let $player
    let $tribeRelations
    let selectedVillage
    let currentPosition = {}
    let frameSize = {}
    let dataView
    let settings
    let minimapSettings
    const STORAGE_KEYS = {
        CACHE_VILLAGES: 'minimap_cache_villages',
        SETTINGS: 'minimap_settings'
    }
    const colorService = injector.get('colorService')
    let allowJump = true
    let allowMove = false
    let dragStart = {}
    const spriteFactory = injector.get('spriteFactory')
    let highlightSprite = spriteFactory.make('hover')
    let currentCoords = {x: null, y: null}
    let firstDraw = true
    let mapWrapper

    /**
     * Calcule the coords from clicked position in the canvas.
     *
     * @param {Object} event - Canvas click event.
     * @return {Object} X and Y coordinates.
     */
    const getCoords = function (event) {
        const villageOffsetX = minimap.getVillageAxisOffset()
        
        let rawX = Math.ceil(currentPosition.x + event.offsetX) - villageOffsetX
        let rawY = Math.ceil(currentPosition.y + event.offsetY) + villageOffsetX

        if (Math.floor((rawY / villageBlock)) % 2) {
            rawX += villageOffsetX
        }

        rawX -= rawX % villageBlock
        rawY -= rawY % villageBlock

        return {
            x: Math.ceil((rawX - frameSize.x / 2) / villageBlock),
            y: Math.ceil((rawY - frameSize.y / 2) / villageBlock)
        }
    }

    /**
     * Convert pixel wide map position to coords
     *
     * @param {Number} x - X pixel position.
     * @param {Number} y - Y pixel position.
     * @return {Object} Y and Y coordinates.
     */
    const pixel2Tiles = function (x, y) {
        return {
            x: (x / conf.TILESIZE.x),
            y: (y / conf.TILESIZE.y / conf.TILESIZE.off)
        }
    }

    /**
     * Calculate the coords based on zoom.
     *
     * @param {Array[x, y, canvasW, canvasH]} rect - Coords and canvas size.
     * @param {Number} zoom - Current zoom used to display the game original map.
     * @return {Array} Calculated coords.
     */
    const convert = function (rect, zoom) {
        zoom = 1 / (zoom || 1)

        const xy = pixel2Tiles(rect[0] * zoom, rect[1] * zoom)
        const wh = pixel2Tiles(rect[2] * zoom, rect[3] * zoom)
        
        return [
            xy.x - 1,
            xy.y - 1,
            (wh.x + 3) || 1,
            (wh.y + 3) || 1
        ]
    }

    const drawGrid = function () {
        const binUrl = cdn.getPath(conf.getMapPath())
        const villageOffsetX = Math.round(villageBlock / 2)
        const continentEnabled = minimapSettings[SETTINGS.SHOW_CONTINENT_DEMARCATIONS]
        const provinceEnabled = minimapSettings[SETTINGS.SHOW_PROVINCE_DEMARCATIONS]

        if (!continentEnabled && !provinceEnabled) {
            return false
        }

        const drawContinent = function (x, y) {
            $viewportCacheContext.fillStyle = minimapSettings[SETTINGS.COLOR_CONTINENT]
            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX - 1, y * villageBlock + villageOffsetX - 1, 3, 1)
            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX, y * villageBlock + villageOffsetX - 2, 1, 3)
        }

        const drawProvince = function (x, y) {
            $viewportCacheContext.fillStyle = minimapSettings[SETTINGS.COLOR_PROVINCE]
            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX, y * villageBlock + villageOffsetX - 1, 1, 1)
        }

        utils.xhrGet(binUrl, function (bin) {
            dataView = new DataView(bin)

            for (let x = 1; x < 999; x++) {
                for (let y = 1; y < 999; y++) {
                    let tile = mapconvert.toTile(dataView, x, y)
                    
                    // is border
                    if (tile.key.b) {
                        // is continental border
                        if (tile.key.c) {
                            if (continentEnabled) {
                                drawContinent(x, y)
                            } else if (provinceEnabled) {
                                drawProvince(x, y)
                            }
                        } else if (provinceEnabled) {
                            drawProvince(x, y)
                        }
                    }
                }
            }
        }, 'arraybuffer')
    }

    const drawLoadedVillages = function () {
        drawVillages(allVillages)
    }

    /**
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    const drawViewport = function (pos) {
        $viewportContext.drawImage($viewportCache, -pos.x, -pos.y)
    }

    const clearViewport = function () {
        $viewportContext.clearRect(0, 0, $viewport.width, $viewport.height)
    }

    /**
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    const drawViewReference = function (pos) {
        const mapPosition = minimap.getMapPosition()
        const x = ((mapPosition[0] + mapPosition[2] - 2) * villageBlock) - pos.x
        const y = ((mapPosition[1] + mapPosition[3] - 2) * villageBlock) - pos.y

        // cross
        $crossContext.fillStyle = minimapSettings[SETTINGS.COLOR_VIEW_REFERENCE]
        $crossContext.fillRect(x, 0, 1, lineSize)
        $crossContext.fillRect(0, y, lineSize, 1)

        const rectWidth = (mapWrapper.width() / conf.TILESIZE.x / mapState.view.z) * villageBlock
        const rectHeight = (mapWrapper.height() / conf.TILESIZE.y / mapState.view.z) * villageBlock
        const rectX = x - (rectWidth / 2)
        const rectY = y - (rectHeight / 2)

        // view rect
        $crossContext.clearRect(rectX, rectY, rectWidth, rectHeight)
        $crossContext.beginPath()
        $crossContext.lineWidth = 1
        $crossContext.strokeStyle = minimapSettings[SETTINGS.COLOR_VIEW_REFERENCE]
        $crossContext.rect(rectX, rectY, rectWidth, rectHeight)
        $crossContext.stroke()
    }

    const clearCross = function () {
        $crossContext.clearRect(0, 0, $cross.width, $cross.height)
    }

    const renderStep = function () {
        if (enableRendering) {
            const pos =  {
                x: currentPosition.x - (frameSize.x / 2),
                y: currentPosition.y - (frameSize.y / 2)
            }

            clearViewport()
            clearCross()

            drawViewport(pos)

            if (minimapSettings[SETTINGS.SHOW_VIEW_REFERENCE]) {
                drawViewReference(pos)
            }
        }

        window.requestAnimationFrame(renderStep)
    }

    const cacheVillages = function (villages) {
        for (let i = 0; i < villages.length; i++) {
            let v = villages[i]

            // meta village
            if (v.id < 0) {
                continue
            }

            if (!(v.x in cache.village)) {
                cache.village[v.x] = {}
            }

            if (!(v.x in cachedVillages)) {
                cachedVillages[v.x] = []
            }

            cache.village[v.x][v.y] = v.character_id || 0
            cachedVillages[v.x][v.y] = v

            if (v.character_id) {
                if (v.character_id in cache.character) {
                    cache.character[v.character_id].push([v.x, v.y])
                } else {
                    cache.character[v.character_id] = [[v.x, v.y]]
                }

                if (v.tribe_id) {
                    if (v.tribe_id in cache.tribe) {
                        cache.tribe[v.tribe_id].push(v.character_id)
                    } else {
                        cache.tribe[v.tribe_id] = [v.character_id]
                    }
                }
            }
        }
    }

    const onHoverVillage = function (coords, event) {
        if (hoverVillage) {
            if (hoverVillage.x === coords.x && hoverVillage.y === coords.y) {
                return false
            } else {
                onBlurVillage()
            }
        }

        eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_HOVER, {
            coords: coords,
            event: event
        })

        hoverVillage = { x: coords.x, y: coords.y }
        const pid = cache.village[coords.x][coords.y]

        if (pid) {
            highlightVillages(cache.character[pid])
        } else {
            highlightVillages([[coords.x, coords.y]])
        }
    }

    const onBlurVillage = function () {
        if (!hoverVillage) {
            return false
        }

        const pid = cache.village[hoverVillage.x][hoverVillage.y]

        if (pid) {
            unhighlightVillages(cache.character[pid])
        } else {
            unhighlightVillages([[hoverVillage.x, hoverVillage.y]])
        }

        hoverVillage = false
        eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_BLUR)
    }

    const highlightVillages = function (villages) {
        let villagesData = []

        for (let i = 0; i < villages.length; i++) {
            let x = villages[i][0]
            let y = villages[i][1]

            villagesData.push(cachedVillages[x][y])
        }

        drawVillages(villagesData, minimapSettings[SETTINGS.COLOR_QUICK_HIGHLIGHT])
    }

    const unhighlightVillages = function (villages) {
        let villagesData = []

        for (let i = 0; i < villages.length; i++) {
            let x = villages[i][0]
            let y = villages[i][1]

            villagesData.push(cachedVillages[x][y])
        }

        drawVillages(villagesData)
    }

    const showHighlightSprite = function (x, y) {
        let pos = mapService.tileCoordinate2Pixel(x, y)
        highlightSprite.setTranslation(pos[0] - 25, pos[1] + 2)
        highlightSprite.alpha = 1
    }

    const hideHighlightSprite = function () {
        highlightSprite.alpha = 0
    }

    const quickHighlight = function (coords) {
        const village = mapData.getTownAt(coords.x, coords.y)
        const action = minimapSettings[SETTINGS.RIGHT_CLICK_ACTION]
        let data = {}

        if (!village) {
            return false
        }

        switch (action) {
        case ACTION_TYPES.HIGHLIGHT_PLAYER:
            if (!village.character_id) {
                return false
            }

            data.type = 'character'
            data.id = village.character_id

            break
        case ACTION_TYPES.HIGHLIGHT_TRIBE:
            if (!village.tribe_id) {
                return false
            }

            data.type = 'tribe'
            data.id = village.tribe_id

            break
        }

        minimap.addHighlight(data, '#' + colors.palette.random().random())
    }

    const eventHandlers = {
        onCrossMouseDown: function (event) {
            event.preventDefault()

            allowJump = true
            allowMove = true
            dragStart = {
                x: currentPosition.x + event.pageX,
                y: currentPosition.y + event.pageY
            }

            if (hoverVillage) {
                eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_CLICK, [hoverVillage, event])

                // right click
                if (event.which === 3) {
                    quickHighlight(hoverVillage)
                }
            }
        },
        onCrossMouseUp: function () {
            allowMove = false
            dragStart = {}

            if (!allowJump) {
                eventQueue.trigger(eventTypeProvider.MINIMAP_STOP_MOVE)
            }
        },
        onCrossMouseMove: function (event) {
            allowJump = false

            if (allowMove) {
                currentPosition.x = dragStart.x - event.pageX
                currentPosition.y = dragStart.y - event.pageY
                eventQueue.trigger(eventTypeProvider.MINIMAP_START_MOVE)
            }

            const coords = getCoords(event)

            if (coords.x !== currentCoords.x || coords.y !== currentCoords.y) {
                hideHighlightSprite()
                showHighlightSprite(coords.x, coords.y)
            }

            currentCoords = coords

            if (coords.x in cachedVillages && coords.y in cachedVillages[coords.x]) {
                let village = cachedVillages[coords.x][coords.y]

                // ignore barbarian villages
                if (!minimapSettings[SETTINGS.SHOW_BARBARIANS] && !village.character_id) {
                    return false
                }

                // check if the village is custom highlighted
                if (minimapSettings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]) {
                    let highlighted = false

                    if (village.character_id in highlights.character) {
                        highlighted = true
                    } else if (village.tribe_id in highlights.tribe) {
                        highlighted = true
                    }

                    if (!highlighted) {
                        return false
                    }
                }

                return onHoverVillage(coords, event)
            }

            onBlurVillage()
        },
        onCrossMouseLeave: function () {
            if (hoverVillage) {
                onBlurVillage()
            }

            eventQueue.trigger(eventTypeProvider.MINIMAP_MOUSE_LEAVE)
        },
        onCrossMouseClick: function (event) {
            if (!allowJump) {
                return false
            }

            const coords = getCoords(event)
            mapService.jumpToVillage(coords.x, coords.y)
        },
        onCrossMouseContext: function (event) {
            event.preventDefault()
            return false
        },
        onHighlightChange: function () {
            highlights.tribe = colorService.getCustomColorsByGroup(colorGroups.TRIBE_COLORS) || {}
            highlights.character = colorService.getCustomColorsByGroup(colorGroups.PLAYER_COLORS) || {}

            drawLoadedVillages()
        },
        onSelectedVillageChange: function () {
            const old = {
                id: selectedVillage.getId(),
                x: selectedVillage.getX(),
                y: selectedVillage.getY()
            }

            selectedVillage = $player.getSelectedVillage()

            drawVillages([{
                character_id: $player.getId(),
                id: old.id,
                x: old.x,
                y: old.y
            }, {
                character_id: $player.getId(),
                id: selectedVillage.getId(),
                x: selectedVillage.getX(),
                y: selectedVillage.getY()
            }])
        }
    }

    let minimap = {
        SETTINGS_MAP: SETTINGS_MAP,
        ACTION_TYPES: ACTION_TYPES
    }

    minimap.setVillageSize = function (value) {
        villageSize = value
        villageBlock = villageSize + villageMargin
        lineSize = 1000 * (villageSize + villageMargin)
    }

    minimap.getVillageSize = function () {
        return villageSize
    }

    minimap.setVillageMargin = function (value) {
        villageMargin = value
        villageBlock = villageSize + villageMargin
        lineSize = 1000 * (villageSize + villageMargin)
    }

    minimap.getVillageMargin = function () {
        return villageMargin
    }

    /**
     * Get the size used by each village on minimap in pixels.
     *
     * @return {Number}
     */
    minimap.getVillageBlock = function () {
        return villageBlock
    }

    minimap.getLineSize = function () {
        return lineSize
    }

    /**
     * Get the center position of a village icon.
     *
     * @return {Number}
     */
    minimap.getVillageAxisOffset = function () {
        return Math.round(villageSize / 2)
    }

    /**
     * @param {Object} item - Highlight item.
     * @param {String} item.type - village, player or tribe
     * @param {String} item.id - village/player/tribe id
     * @param {Number=} item.x - village X coord.
     * @param {Number=} item.y - village Y coord.
     * @param {String} color - Hex color
     *
     * @return {Boolean} true if successfully added
     */
    minimap.addHighlight = function (item, color) {
        if (!item || !item.type || !item.id) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY)
            return false
        }

        if (!rhex.test(color)) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR)
            return false
        }

        highlights[item.type][item.id] = color
        const colorGroup = item.type === 'character' ? colorGroups.PLAYER_COLORS : colorGroups.TRIBE_COLORS
        colorService.setCustomColorsByGroup(colorGroup, highlights[item.type])
        $rootScope.$broadcast(eventTypeProvider.GROUPS_VILLAGES_CHANGED)

        drawLoadedVillages()

        return true
    }

    minimap.removeHighlight = function (type, itemId) {
        if (highlights[type][itemId]) {
            delete highlights[type][itemId]
            const colorGroup = type === 'character' ? colorGroups.PLAYER_COLORS : colorGroups.TRIBE_COLORS
            colorService.setCustomColorsByGroup(colorGroup, highlights[type])
            $rootScope.$broadcast(eventTypeProvider.GROUPS_VILLAGES_CHANGED)

            drawLoadedVillages()

            return true
        }

        return false
    }

    minimap.getHighlight = function (type, item) {
        if (Object.prototype.hasOwnProperty.call(highlights[type], item)) {
            return highlights[type][item]
        } else {
            return false
        }
    }

    minimap.getHighlights = function () {
        return highlights
    }

    minimap.eachHighlight = function (callback) {
        for (let type in highlights) {
            for (let id in highlights[type]) {
                callback(type, id, highlights[type][id])
            }
        }
    }

    minimap.setViewport = function (element) {
        $viewport = element
        $viewport.style.background = minimapSettings[SETTINGS.COLOR_BACKGROUND]
        $viewportContext = $viewport.getContext('2d')
    }

    minimap.setCross = function (element) {
        $cross = element
        $crossContext = $cross.getContext('2d')
    }

    minimap.setCurrentPosition = function (x, y) {
        const INTERFACE_HEIGHT = 265
        currentPosition.x = x * villageBlock + 50
        currentPosition.y = y * villageBlock + ((document.body.clientHeight - INTERFACE_HEIGHT) / 2)
    }

    /**
     * @return {Array}
     */
    minimap.getMapPosition = function () {
        if (!$map.width || !$map.height) {
            return false
        }

        let view

        if (gameVersion.product.major === 1 && gameVersion.product.minor < 94) {
            view = window.twx.game.map.engine.getView()
        } else {
            view = mapData.getMap().engine.getView()
        }

        return convert([
            -view.x,
            -view.y,
            $map.width / 2,
            $map.height / 2
        ], view.z)
    }

    minimap.getSettings = function () {
        return settings
    }

    minimap.drawMinimap = function () {
        if (firstDraw) {
            firstDraw = false
        }

        $viewport.style.background = minimapSettings[SETTINGS.COLOR_BACKGROUND]
        $viewportCacheContext.clearRect(0, 0, $viewportCache.width, $viewportCache.height)

        drawGrid()
        drawLoadedVillages()
    }

    minimap.enableRendering = function () {
        enableRendering = true
    }

    minimap.disableRendering = function () {
        enableRendering = false
    }

    minimap.isFirstDraw = function () {
        return !!firstDraw
    }

    minimap.init = function () {
        minimap.initialized = true
        $viewportCache = document.createElement('canvas')
        $viewportCacheContext = $viewportCache.getContext('2d')
        
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates) {
            minimapSettings = settings.getAll()

            if (updates[UPDATES.MINIMAP]) {
                minimap.drawMinimap()
            }
        })

        minimapSettings = settings.getAll()
        highlights.tribe = colorService.getCustomColorsByGroup(colorGroups.TRIBE_COLORS) || {}
        highlights.character = colorService.getCustomColorsByGroup(colorGroups.PLAYER_COLORS) || {}
    }

    const drawVillages = function (villages, _color) {
        const pid = $player.getId()
        const tid = $player.getTribeId()
        const villageOffsetX = minimap.getVillageAxisOffset()
        const villageColors = $player.getVillagesColors()

        for (let i = 0; i < villages.length; i++) {
            let v = villages[i]
            let x
            let y
            let color

            // meta village
            if (v.id < 0) {
                continue
            }

            if (_color) {
                color = _color

                x = v.x * villageBlock
                y = v.y * villageBlock

                if (v.y % 2) {
                    x += villageOffsetX
                }
            } else {
                if (minimapSettings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]) {
                    if (v.character_id in highlights.character) {
                        color = highlights.character[v.character_id]
                    } else if (v.tribe_id in highlights.tribe) {
                        color = highlights.tribe[v.tribe_id]
                    } else {
                        continue
                    }
                } else {
                    if (v.character_id === null) {
                        if (!minimapSettings[SETTINGS.SHOW_BARBARIANS]) {
                            continue
                        }

                        color = villageColors.barbarian
                    } else {
                        if (v.character_id === pid) {
                            if (v.id === selectedVillage.getId() && minimapSettings[SETTINGS.HIGHLIGHT_SELECTED]) {
                                color = villageColors.selected
                            } else if (v.character_id in highlights.character) {
                                color = highlights.character[v.character_id]
                            } else if (minimapSettings[SETTINGS.HIGHLIGHT_OWN]) {
                                color = villageColors.player
                            } else {
                                color = villageColors.ugly
                            }
                        } else {
                            if (v.character_id in highlights.character) {
                                color = highlights.character[v.character_id]
                            } else if (v.tribe_id in highlights.tribe) {
                                color = highlights.tribe[v.tribe_id]
                            } else if (tid && tid === v.tribe_id && minimapSettings[SETTINGS.HIGHLIGHT_DIPLOMACY]) {
                                color = villageColors.tribe
                            } else if ($tribeRelations && minimapSettings[SETTINGS.HIGHLIGHT_DIPLOMACY]) {
                                if ($tribeRelations.isAlly(v.tribe_id)) {
                                    color = villageColors.ally
                                } else if ($tribeRelations.isEnemy(v.tribe_id)) {
                                    color = villageColors.enemy
                                } else if ($tribeRelations.isNAP(v.tribe_id)) {
                                    color = villageColors.friendly
                                } else {
                                    color = villageColors.ugly
                                }
                            } else {
                                color = villageColors.ugly
                            }
                        }
                    }
                }

                x = v.x * villageBlock
                y = v.y * villageBlock

                if (v.y % 2) {
                    x += villageOffsetX
                }
            }

            $viewportCacheContext.fillStyle = color
            $viewportCacheContext.fillRect(x, y, villageSize, villageSize)
        }
    }

    minimap.run = function () {
        ready(function () {
            mapWrapper = $('#map')
            $map = document.getElementById('main-canvas')
            $player = modelDataService.getSelectedCharacter()
            $tribeRelations = $player.getTribeRelations()

            highlightSprite.alpha = 0
            mapState.graph.layers.effects.push(highlightSprite)

            currentPosition.x = 500 * villageBlock
            currentPosition.y = 500 * villageBlock

            frameSize.x = 686
            frameSize.y = 686

            $viewport.setAttribute('width', frameSize.x)
            $viewport.setAttribute('height', frameSize.y)
            $viewportContext.imageSmoothingEnabled = false

            $viewportCache.setAttribute('width', 1000 * villageBlock)
            $viewportCache.setAttribute('height', 1000 * villageBlock)
            $viewportCache.imageSmoothingEnabled = false

            $cross.setAttribute('width', frameSize.x)
            $cross.setAttribute('height', frameSize.y)
            $crossContext.imageSmoothingEnabled = false

            selectedVillage = $player.getSelectedVillage()
            currentPosition.x = selectedVillage.getX() * villageBlock
            currentPosition.y = selectedVillage.getY() * villageBlock

            twoMapData.load({
                x: selectedVillage.getX(),
                y: selectedVillage.getY()
            }, function (loadedVillages) {
                allVillages = loadedVillages
                cacheVillages(loadedVillages)
            })

            renderStep()

            $cross.addEventListener('mousedown', eventHandlers.onCrossMouseDown)
            $cross.addEventListener('mouseup', eventHandlers.onCrossMouseUp)
            $cross.addEventListener('mousemove', eventHandlers.onCrossMouseMove)
            $cross.addEventListener('mouseleave', eventHandlers.onCrossMouseLeave)
            $cross.addEventListener('click', eventHandlers.onCrossMouseClick)
            $cross.addEventListener('contextmenu', eventHandlers.onCrossMouseContext)
            $rootScope.$on(eventTypeProvider.VILLAGE_SELECTED_CHANGED, eventHandlers.onSelectedVillageChange)
            $rootScope.$on(eventTypeProvider.TRIBE_RELATION_CHANGED, drawLoadedVillages)
            $rootScope.$on(eventTypeProvider.GROUPS_VILLAGES_CHANGED, eventHandlers.onHighlightChange)
        }, ['initial_village', 'tribe_relations'])
    }

    return minimap
})
