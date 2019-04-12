define('two/minimap', [
    'two/minimap/actionTypes',
    'two/minimap/settings',
    'two/minimap/settingsMap',
    'queues/EventQueue',
    'two/ready',
    'Lockr',
    'struct/MapData',
    'conf/conf',
    'helper/time',
    'helper/mapconvert',
    'cdn',
    'conf/colors'
], function (
    ACTION_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    eventQueue,
    ready,
    Lockr,
    $mapData,
    $conf,
    $timeHelper,
    $mapconvert,
    $cdn,
    colors
) {
    var enableRendering = false
    var highlights
    var villageSize = 5
    var villageMargin = 1
    var rhex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    var cache = {
        village: {},
        character: {},
        tribe: {}
    }
    // Cached villages from previous loaded maps.
    // Used to draw the "ghost" villages on the map.
    var cachedVillages = {}
    // Data of the village that the user is hovering on the minimap.
    var hoverVillage = null
    var $viewport
    var $viewportContext
    var $viewportCache
    var $viewportCacheContext
    var $cross
    var $crossContext
    // Game main canvas map.
    // Used to calculate the position cross position based on canvas size.
    var $map
    var $player
    var $tribeRelations
    var selectedVillage
    var currentPosition = {}
    var frameSize = {}
    var dataView
    var settings = {}
    var STORAGE_ID = {
        CACHE_VILLAGES: 'minimap_cache_villages',
        SETTINGS: 'minimap_settings',
        HIGHLIGHTS: 'minimap_highlights'
    }

    /**
     * Calcule the coords from clicked position in the canvas.
     *
     * @param {Object} event - Canvas click event.
     * @return {Object} X and Y coordinates.
     */
    var getCoords = function (event) {
        var villageBlock = minimap.getVillageBlock()
        var villageOffsetX = minimap.getVillageAxisOffset()
        var rawX = Math.ceil(currentPosition.x + event.offsetX)
        var rawY = Math.ceil(currentPosition.y + event.offsetY)
        var adjustLine = Math.floor((rawY / villageBlock) % 2)

        if (adjustLine % 2) {
            rawX -= villageOffsetX
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
    var pixel2Tiles = function (x, y) {
        return {
            x: (x / $conf.TILESIZE.x),
            y: (y / $conf.TILESIZE.y / $conf.TILESIZE.off)
        }
    }

    /**
     * Calculate the coords based on zoom.
     *
     * @param {Array[x, y, canvasW, canvasH]} rect - Coords and canvas size.
     * @param {Number} zoom - Current zoom used to display the game original map.
     * @return {Array} Calculated coords.
     */
    var convert = function (rect, zoom) {
        zoom = 1 / (zoom || 1)

        var xy = pixel2Tiles(rect[0] * zoom, rect[1] * zoom)
        var wh = pixel2Tiles(rect[2] * zoom, rect[3] * zoom)
        
        return [
            xy.x - 1,
            xy.y - 1,
            (wh.x + 3) || 1,
            (wh.y + 3) || 1
        ]
    }

    /**
     * Events related to minimap canvas.
     * - Keep the minimap current position based on mouse movement.
     * - Keep the minimap size accordly to the window size.
     * - Handle minimap clicks.
     */
    var canvasListeners = function () {
        var allowJump = true
        var allowMove = false
        var dragStart = {}

        $cross.addEventListener('mousedown', function (event) {
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
                    easyHighlight(hoverVillage)
                }
            }
        })

        $cross.addEventListener('mouseup', function () {
            allowMove = false
            dragStart = {}

            if (!allowJump) {
                eventQueue.trigger(eventTypeProvider.MINIMAP_STOP_MOVE)
            }
        })

        $cross.addEventListener('mousemove', function (event) {
            var coords
            var village
            var highlighted

            allowJump = false

            if (allowMove) {
                currentPosition.x = dragStart.x - event.pageX
                currentPosition.y = dragStart.y - event.pageY
                eventQueue.trigger(eventTypeProvider.MINIMAP_START_MOVE)
            }

            coords = getCoords(event)

            if (coords.x in cache.village) {
                if (coords.y in cache.village[coords.x]) {
                    village = $mapData.getTownAt(coords.x, coords.y)

                    // ignore barbarian villages
                    if (!settings[SETTINGS.SHOW_BARBARIANS] && !village.character_id) {
                        return false
                    }

                    // check if the village is custom highlighted
                    if (settings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]) {
                        highlighted = false

                        if (village.id in highlights.village) {
                            highlighted = true
                        } else if (village.character_id in highlights.character) {
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
            }

            onBlurVillage()
        })

        $cross.addEventListener('mouseleave', function () {
            if (hoverVillage) {
                onBlurVillage()
            }

            eventQueue.trigger(eventTypeProvider.MINIMAP_MOUSE_LEAVE)
        })

        $cross.addEventListener('click', function (event) {
            if (!allowJump) {
                return false
            }

            var coords = getCoords(event)
            $rootScope.$broadcast(eventTypeProvider.MAP_CENTER_ON_POSITION, coords.x, coords.y, true)
            preloadSectors(2, coords.x, coords.y)
        })

        $cross.addEventListener('contextmenu', function (event) {
            event.preventDefault()
            return false
        })
    }

    /**
     * @param {Array} villages
     * @param {String=} _color - Force the village to use the
     *   specified color.
     */
    var drawVillages = function (villages, _color) {
        var v
        var x
        var y
        var color
        var pid = $player.getId()
        var tid = $player.getTribeId()
        var villageBlock = minimap.getVillageBlock()
        var villageSize = minimap.getVillageSize()
        var villageOffsetX = minimap.getVillageAxisOffset()

        for (var i = 0; i < villages.length; i++) {
            v = villages[i]

            // meta village
            if (v.id < 0) {
                continue
            }

            if (_color) {
                color = _color
                
                x = v[0] * villageBlock
                y = v[1] * villageBlock

                if (v[1] % 2) {
                    x += villageOffsetX
                }
            } else {
                x = v.x * villageBlock
                y = v.y * villageBlock

                if (v.y % 2) {
                    x += villageOffsetX
                }

                if (settings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]) {
                    if (v.id in highlights.village) {
                        color = highlights.village[v.id].color
                    } else if (v.character_id in highlights.character) {
                        color = highlights.character[v.character_id].color
                    } else if (v.tribe_id in highlights.tribe) {
                        color = highlights.tribe[v.tribe_id].color
                    } else {
                        continue
                    }
                } else {
                    if (v.character_id === null) {
                        if (!settings[SETTINGS.SHOW_BARBARIANS]) {
                            continue
                        }

                        if (v.id in highlights.village) {
                            color = highlights.village[v.id].color
                        } else {
                            color = settings[SETTINGS.COLOR_BARBARIAN]
                        }
                    } else {
                        if (v.character_id === pid) {
                            if (v.id === selectedVillage.getId() && settings[SETTINGS.HIGHLIGHT_SELECTED]) {
                                color = settings[SETTINGS.COLOR_SELECTED]
                            } else if (v.character_id in highlights.character) {
                                color = highlights.character[v.character_id].color
                            } else if (settings[SETTINGS.HIGHLIGHT_OWN]) {
                                color = settings[SETTINGS.COLOR_PLAYER]
                            } else {
                                color = settings[SETTINGS.COLOR_UGLY]
                            }
                        } else {
                            if (v.id in highlights.village) {
                                color = highlights.village[v.id].color
                            } else if (v.character_id in highlights.character) {
                                color = highlights.character[v.character_id].color
                            } else if (v.tribe_id in highlights.tribe) {
                                color = highlights.tribe[v.tribe_id].color
                            } else if (tid && tid === v.tribe_id && settings[SETTINGS.HIGHLIGHT_DIPLOMACY]) {
                                color = settings[SETTINGS.COLOR_TRIBE]
                            } else if ($tribeRelations && settings[SETTINGS.HIGHLIGHT_DIPLOMACY]) {
                                if ($tribeRelations.isAlly(v.tribe_id)) {
                                    color = settings[SETTINGS.COLOR_ALLY]
                                } else if ($tribeRelations.isEnemy(v.tribe_id)) {
                                    color = settings[SETTINGS.COLOR_ENEMY]
                                } else if ($tribeRelations.isNAP(v.tribe_id)) {
                                    color = settings[SETTINGS.COLOR_FRIENDLY]
                                } else {
                                    color = settings[SETTINGS.COLOR_UGLY]
                                }
                            } else {
                                color = settings[SETTINGS.COLOR_UGLY]
                            }
                        }
                    }
                }
            }

            $viewportCacheContext.fillStyle = color
            $viewportCacheContext.fillRect(x, y, villageSize, villageSize)
        }
    }

    var loadMapBin = function (callback) {
        var path = $cdn.getPath($conf.getMapPath())
        var xhr

        xhr = new XMLHttpRequest()
        xhr.open('GET', path, true)
        xhr.responseType = 'arraybuffer'
        xhr.addEventListener('load', function (data) {
            callback(xhr.response)
        }, false)

        xhr.send()
    }

    var drawGrid = function () {
        var villageBlock = minimap.getVillageBlock()
        var villageOffsetX = Math.round(villageBlock / 2)
        var tile
        var x
        var y
        
        loadMapBin(function (bin) {
            dataView = new DataView(bin)

            for (x = 1; x < 999; x++) {
                for (y = 1; y < 999; y++) {
                    tile = $mapconvert.toTile(dataView, x, y)
                    
                    // is border
                    if (tile.key.b) {
                        // is continental border
                        if (tile.key.c) {
                            $viewportCacheContext.fillStyle = settings[SETTINGS.COLOR_CONTINENT]
                            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX - 1, y * villageBlock + villageOffsetX - 1, 3, 1)
                            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX, y * villageBlock + villageOffsetX - 2, 1, 3)
                        } else {
                            $viewportCacheContext.fillStyle = settings[SETTINGS.COLOR_PROVINCE]
                            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX, y * villageBlock + villageOffsetX - 1, 1, 1)
                        }
                    }
                }
            }
        })
    }

    var drawLoadedVillages = function () {
        drawVillages($mapData.getTowns())
    }

    var drawCachedVillages = function () {
        var x
        var y
        var i
        var xx
        var yy
        var village
        var villageBlock = minimap.getVillageBlock()
        var villageSize = minimap.getVillageSize()
        var villageOffsetX = minimap.getVillageAxisOffset()

        for (x in cachedVillages) {
            for (i = 0; i < cachedVillages[x].length; i++) {
                y = cachedVillages[x][i]
                xx = x * villageBlock
                yy = y * villageBlock

                if (y % 2) {
                    xx += villageOffsetX
                }

                $viewportCacheContext.fillStyle = settings[SETTINGS.COLOR_GHOST]
                $viewportCacheContext.fillRect(xx, yy, villageSize, villageSize)
            }
        }
    }

    /**
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    var drawViewport = function (pos) {
        $viewportContext.drawImage($viewportCache, -pos.x, -pos.y)
    }

    /**
     * @return {[type]} [description]
     */
    var clearViewport = function () {
        $viewportContext.clearRect(0, 0, $viewport.width, $viewport.height)
    }

    /**
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    var drawCross = function (pos) {
        var villageBlock = minimap.getVillageBlock()
        var lineSize = minimap.getLineSize()
        var mapPosition = minimap.getMapPosition()

        var x = ((mapPosition[0] + mapPosition[2] - 2) * villageBlock) - pos.x
        var y = ((mapPosition[1] + mapPosition[3] - 2) * villageBlock) - pos.y

        $crossContext.fillStyle = settings[SETTINGS.COLOR_CROSS]
        $crossContext.fillRect(x | 0, 0, 1, lineSize)
        $crossContext.fillRect(0, y | 0, lineSize, 1)
    }

    var clearCross = function () {
        $crossContext.clearRect(0, 0, $cross.width, $cross.height)
    }

    var updateSelectedVillage = function () {
        var old = {
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

    var renderStep = function () {
        if(enableRendering) {
            var pos =  {
                x: currentPosition.x - (frameSize.x / 2),
                y: currentPosition.y - (frameSize.y / 2)
            }

            clearViewport()
            clearCross()

            drawViewport(pos)

            if (settings[SETTINGS.SHOW_CROSS]) {
                drawCross(pos)
            }
        }

        window.requestAnimationFrame(renderStep)
    }

    /**
     * @param {Number} sectors - Amount of sectors to be loaded,
     *   each sector has a size of 25x25 fields.
     * @param {Number=} x Optional load center X
     * @param {Number=} y Optional load center Y
     */
    var preloadSectors = function (sectors, _x, _y) {
        var size = sectors * 25
        var x = (_x || selectedVillage.getX()) - (size / 2)
        var y = (_y || selectedVillage.getY()) - (size / 2)

        $mapData.loadTownDataAsync(x, y, size, size, function () {})
    }

    var cacheVillages = function (villages) {
        for (var i = 0; i < villages.length; i++) {
            var v = villages[i]

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
            cachedVillages[v.x].push(v.y)

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

        Lockr.set(STORAGE_ID.CACHE_VILLAGES, cachedVillages)
    }

    var onHoverVillage = function (coords, event) {
        if (hoverVillage) {
            if (hoverVillage.x === coords.x && hoverVillage.y === coords.y) {
                return false
            } else {
                onBlurVillage()
            }
        }

        eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_HOVER, {
            village: $mapData.getTownAt(coords.x, coords.y),
            event: event
        })

        hoverVillage = {
            x: coords.x,
            y: coords.y
        }

        var pid = cache.village[coords.x][coords.y]

        if (pid) {
            highlightVillages(cache.character[pid])
        } else {
            highlightVillages([[coords.x, coords.y]])
        }
    }

    var onBlurVillage = function () {
        if (!hoverVillage) {
            return false
        }

        var pid = cache.village[hoverVillage.x][hoverVillage.y]

        if (pid) {
            unhighlightVillages(cache.character[pid])
        } else {
            unhighlightVillages([[hoverVillage.x, hoverVillage.y]])
        }

        hoverVillage = false
        eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_BLUR)
    }

    var highlightVillages = function (villages) {
        drawVillages(villages, settings[SETTINGS.COLOR_QUICK_HIGHLIGHT])
    }

    var unhighlightVillages = function (villages) {
        var _villages = []

        for (var i = 0; i < villages.length; i++) {
            _villages.push($mapData.getTownAt(villages[i][0], villages[i][1]))
        }

        drawVillages(_villages)
    }

    var easyHighlight = function (coords) {
        var village = $mapData.getTownAt(coords.x, coords.y)
        var action = settings[SETTINGS.RIGHT_CLICK_ACTION]
        var type
        var id

        if (!village) {
            return false
        }

        switch (settings[SETTINGS.RIGHT_CLICK_ACTION]) {
        case ACTION_TYPES.HIGHLIGHT_VILLAGE:
            type = 'village'
            id = village.id

            break
        case ACTION_TYPES.HIGHLIGHT_PLAYER:
            if (!village.character_id) {
                return false
            }

            type = 'character'
            id = village.character_id

            break
        case ACTION_TYPES.HIGHLIGHT_TRIBE:
            if (!village.tribe_id) {
                return false
            }

            type = 'tribe'
            id = village.tribe_id

            break
        }

        minimap.addHighlight({
            type: type,
            id: id
        }, '#' + colors.palette.random().random())
    }

    var minimap = {
        SETTINGS_MAP: SETTINGS_MAP,
        ACTION_TYPES: ACTION_TYPES
    }

    minimap.setVillageSize = function (value) {
        villageSize = value
    }

    minimap.getVillageSize = function () {
        return villageSize
    }

    minimap.setVillageMargin = function (value) {
        villageMargin = value
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
        return villageSize + villageMargin
    }

    minimap.getLineSize = function () {
        return 1000 * (villageSize + villageMargin)
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
        var update = false

        if (!item || !item.type || !item.id) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY)
            return false
        }

        if (!rhex.test(color)) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR)
            return false
        }

        if (highlights[item.type].hasOwnProperty(item.id)) {
            update = true
        }

        if (update) {
            highlights[item.type][item.id].color = color

            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_UPDATE, {
                item: item,
                color: color
            })
        } else {
            highlights[item.type][item.id] = {
                id: item.id,
                type: item.type,
                color: color
            }

            if (item.type === 'village') {
                highlights[item.type][item.id].x = item.x
                highlights[item.type][item.id].y = item.y
            }

            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD, {
                item: item,
                color: color
            })
        }

        Lockr.set(STORAGE_ID.HIGHLIGHTS, highlights)
        drawLoadedVillages()

        return true
    }

    minimap.removeHighlight = function (data) {
        if (highlights[data.type][data.id]) {
            delete highlights[data.type][data.id]
            Lockr.set(STORAGE_ID.HIGHLIGHTS, highlights)
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_REMOVE, {
                item: data
            })

            drawLoadedVillages()

            return true
        }

        return false
    }

    minimap.getHighlight = function (type, item) {
        if (highlights[type].hasOwnProperty(item)) {
            return highlights[type][item]
        } else {
            return false
        }
    }

    minimap.getHighlights = function () {
        return highlights
    }

    minimap.eachHighlight = function (callback) {
        for (var type in highlights) {
            for (var id in highlights[type]) {
                callback(type, id, highlights[type][id])
            }
        }
    }

    minimap.setViewport = function (element) {
        $viewport = element
        $viewport.style.background = settings[SETTINGS.COLOR_BACKGROUND]
        $viewportContext = $viewport.getContext('2d')
    }

    minimap.setCross = function (element) {
        $cross = element
        $crossContext = $cross.getContext('2d')
    }

    minimap.setCurrentPosition = function (x, y) {
        var block = minimap.getVillageBlock()

        currentPosition.x = x * block + 50
        currentPosition.y = y * block + (1000 - ((document.body.clientHeight - 238) / 2)) + 50
    }

    /**
     * @return {Array}
     */
    minimap.getMapPosition = function () {
        var view = window.twx.game.map.engine.getView()

        return convert([
            -view.x,
            -view.y,
            $map.width / 2,
            $map.height / 2
        ], view.z)
    }

    /**
     * @param {Object} changes - New settings.
     * @return {Boolean} True if the internal settings changed.
     */
    minimap.updateSettings = function (changes) {
        var newValue
        var key
        var settingMap
        var updateMinimap = false

        for (key in changes) {
            settingMap = SETTINGS_MAP[key]
            newValue = changes[key]

            if (!settingMap || angular.equals(settings[key], newValue)) {
                continue
            }

            if (settingMap.update) {
                updateMinimap = true
            }

            settings[key] = newValue
        }

        Lockr.set(STORAGE_ID.SETTINGS, settings)

        if (updateMinimap) {
            minimap.update()
        }

        eventQueue.trigger(eventTypeProvider.MINIMAP_SETTINGS_SAVE)

        return true
    }

    minimap.resetSettings = function () {
        for (var key in SETTINGS_MAP) {
            settings[key] = SETTINGS_MAP[key].default
        }

        highlights = {
            village: {},
            character: {},
            tribe: {}
        }

        Lockr.set(STORAGE_ID.SETTINGS, settings)
        Lockr.set(STORAGE_ID.HIGHLIGHTS, highlights)

        minimap.update()

        eventQueue.trigger(eventTypeProvider.MINIMAP_SETTINGS_RESET)
    }

    minimap.getSettings = function () {
        return settings
    }

    minimap.update = function () {
        var villageBlock = minimap.getVillageBlock()

        $viewport.style.background = settings[SETTINGS.COLOR_BACKGROUND]
        $viewportCacheContext.clearRect(0, 0, $viewportCache.width, $viewportCache.height)

        if (settings[SETTINGS.SHOW_DEMARCATIONS]) {
            drawGrid()
        }

        if (settings[SETTINGS.SHOW_GHOST_VILLAGES]) {
            drawCachedVillages()
        }

        drawLoadedVillages()
    }

    minimap.enableRendering = function () {
        enableRendering = true
    }

    minimap.disableRendering = function () {
        enableRendering = false
    }

    minimap.init = function () {
        minimap.initialized = true

        $viewportCache = document.createElement('canvas')
        $viewportCacheContext = $viewportCache.getContext('2d')
        var localSettings = Lockr.get(STORAGE_ID.SETTINGS, {}, true)

        for (var key in SETTINGS_MAP) {
            var defaultValue = SETTINGS_MAP[key].default

            settings[key] = localSettings.hasOwnProperty(key)
                ? localSettings[key]
                : defaultValue
        }

        highlights = Lockr.get(STORAGE_ID.HIGHLIGHTS, {
            village: {},
            character: {},
            tribe: {}
        }, true)
    }

    minimap.run = function () {
        ready(function () {
            $map = document.getElementById('main-canvas')
            $player = modelDataService.getSelectedCharacter()
            $tribeRelations = $player.getTribeRelations()
            cachedVillages = Lockr.get(STORAGE_ID.CACHE_VILLAGES, {}, true)
            
            var villageBlock = minimap.getVillageBlock()

            currentPosition.x = 500 * villageBlock
            currentPosition.y = 500 * villageBlock

            frameSize.x = 686
            frameSize.y = 2000

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

            if (settings[SETTINGS.SHOW_DEMARCATIONS]) {
                drawGrid()
            }

            if (settings[SETTINGS.SHOW_GHOST_VILLAGES]) {
                drawCachedVillages()
            }

            canvasListeners()
            drawLoadedVillages()
            cacheVillages($mapData.getTowns())
            preloadSectors(2)
            renderStep()

            $rootScope.$on(eventTypeProvider.MAP_VILLAGE_DATA, function (event, data) {
                drawVillages(data.villages)
                cacheVillages(data.villages)
            })

            $rootScope.$on(eventTypeProvider.VILLAGE_SELECTED_CHANGED, function () {
                updateSelectedVillage()
            })

            $rootScope.$on(eventTypeProvider.TRIBE_RELATION_CHANGED, function (event, data) {
                drawLoadedVillages()
            })
        }, ['initial_village', 'tribe_relations'])
    }

    return minimap
})
