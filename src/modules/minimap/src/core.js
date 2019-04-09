define('two/minimap', [
    'queues/EventQueue',
    'two/ready',
    'Lockr',
    'struct/MapData',
    'conf/conf',
    'helper/time',
    'helper/mapconvert',
    'cdn'
], function (
    eventQueue,
    ready,
    Lockr,
    $mapData,
    $conf,
    $timeHelper,
    $mapconvert,
    $cdn
) {
    var enableRendering = false

    /**
     * All villages/players/tribes highlights.
     *
     * @type {Object}
     */
    var highlights

    /**
     * Size of a village icon in pixels.
     *
     * @type {Number}
     */
    var villageSize = 5

    /**
     * Margin between village icons in pixels.
     *
     * @type {Object}
     */
    var villageMargin = 1

    /**
     * Hex color regex validator.
     *
     * @type {RegExp}
     */
    var rhex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

    /**
     * Store loaded villages and it's respective owners/tribes in
     * a easy access mode.
     *
     * @type {Object}
     */
    var cache = {
        village: {},
        character: {},
        tribe: {}
    }

    /**
     * Cached villages from previous loaded maps.
     * Used to draw the "ghost" villages on the map.
     *
     * @type {Object}
     */
    var cachedVillages = {}

    /**
     * Data of the village that the user is hovering on the minimap.
     *
     * @type {Object}
     */
    var hoverVillage = null

    /**
     * Main canvas element.
     *
     * @type {Element}
     */
    var $viewport
    var $viewportContext

    /**
     * Main canvas cache element.
     * All village are draw here and applied to the main canvas by the render.
     * 
     * @type {Element}
     */
    var $viewportCache
    var $viewportCacheContext

    /**
     * Cross canvas element.
     * Current position on map is draw here.
     *
     * @type {Element}
     */
    var $cross
    var $crossContext

    /**
     * Game main canvas map.
     * Used to calculate the position cross position based on canvas size.
     *
     * @type {Element}
     */
    var $map

    /**
     * Player data.
     *
     * @type {Object}
     */
    var $player

    /**
     * Tribe diplomacy helper.
     *
     * @type {Object}
     */
    var $tribeRelations

    /**
     * Current selected village by the player.
     */
    var selectedVillage

    /**
     * Current position in the minimap in pixels.
     *
     * @type {Object}
     */
    var currentPosition = {}

    /**
     * Main canvas size.
     *
     * @type {Object}
     */
    var frameSize = {}

    /**
     * Used to block the jump-to-position when the minimap
     * is dragged and not just clicked.
     *
     * @type {Boolean}
     */
    var allowJump = true

    /**
     * Map data structure buffer.
     *
     * @type {ArrayBuffer}
     */
    var dataView

    /**
     * Minimap settings.
     * 
     * @type {Object}
     */
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
        var villageBlock = Minimap.getVillageBlock()
        var villageOffsetX = Minimap.getVillageAxisOffset()
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
                    if (!settings.showBarbarians && !village.character_id) {
                        return false
                    }

                    // check if the village is custom highlighted
                    if (settings.showOnlyCustomHighlights) {
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
     * Draw a village set on canvas.
     *
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
        var villageBlock = Minimap.getVillageBlock()
        var villageSize = Minimap.getVillageSize()
        var villageOffsetX = Minimap.getVillageAxisOffset()

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

                if (settings.showOnlyCustomHighlights) {
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
                        if (!settings.showBarbarians) {
                            continue
                        }

                        if (v.id in highlights.village) {
                            color = highlights.village[v.id].color
                        } else {
                            color = settings.colorBarbarian
                        }
                    } else {
                        if (v.character_id === pid) {
                            if (v.id === selectedVillage.getId() && settings.highlightSelected) {
                                color = settings.colorSelected
                            } else if (v.character_id in highlights.character) {
                                color = highlights.character[v.character_id].color
                            } else if (settings.highlightOwn) {
                                color = settings.colorPlayer
                            } else {
                                color = settings.colorUgly
                            }
                        } else {
                            if (v.id in highlights.village) {
                                color = highlights.village[v.id].color
                            } else if (v.character_id in highlights.character) {
                                color = highlights.character[v.character_id].color
                            } else if (v.tribe_id in highlights.tribe) {
                                color = highlights.tribe[v.tribe_id].color
                            } else if (tid && tid === v.tribe_id && settings.highlightDiplomacy) {
                                color = settings.colorTribe
                            } else if ($tribeRelations && settings.highlightDiplomacy) {
                                if ($tribeRelations.isAlly(v.tribe_id)) {
                                    color = settings.colorAlly
                                } else if ($tribeRelations.isEnemy(v.tribe_id)) {
                                    color = settings.colorEnemy
                                } else if ($tribeRelations.isNAP(v.tribe_id)) {
                                    color = settings.colorFriendly
                                } else {
                                    color = settings.colorUgly
                                }
                            } else {
                                color = settings.colorUgly
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

    /**
     * Draw the map grid.
     */
    var drawGrid = function () {
        var villageBlock = Minimap.getVillageBlock()
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
                            $viewportCacheContext.fillStyle = settings.colorContinent
                            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX - 1, y * villageBlock + villageOffsetX - 1, 3, 1)
                            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX, y * villageBlock + villageOffsetX - 2, 1, 3)
                        } else {
                            $viewportCacheContext.fillStyle = settings.colorProvince
                            $viewportCacheContext.fillRect(x * villageBlock + villageOffsetX, y * villageBlock + villageOffsetX - 1, 1, 1)
                        }
                    }
                }
            }
        })
    }

    /**
     * Draw all villages loaded befored the Minimap execution.
     */
    var drawLoadedVillages = function () {
        drawVillages($mapData.getTowns())
    }

    /**
     * Draw all villages previously loaded in other runs.
     */
    var drawCachedVillages = function () {
        var x
        var y
        var i
        var xx
        var yy
        var village
        var villageBlock = Minimap.getVillageBlock()
        var villageSize = Minimap.getVillageSize()
        var villageOffsetX = Minimap.getVillageAxisOffset()

        for (x in cachedVillages) {
            for (i = 0; i < cachedVillages[x].length; i++) {
                y = cachedVillages[x][i]
                xx = x * villageBlock
                yy = y * villageBlock

                if (y % 2) {
                    xx += villageOffsetX
                }

                $viewportCacheContext.fillStyle = settings.colorGhost
                $viewportCacheContext.fillRect(xx, yy, villageSize, villageSize)
            }
        }
    }

    /**
     * Draw the viewport cache to the main canvas.
     *
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    var drawViewport = function (pos) {
        $viewportContext.drawImage($viewportCache, -pos.x, -pos.y)
    }

    /**
     * Clear the main canvas.
     *
     * @return {[type]} [description]
     */
    var clearViewport = function () {
        $viewportContext.clearRect(0, 0, $viewport.width, $viewport.height)
    }

    /**
     * Draw the temporation items on cross canvas.
     *
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    var drawCross = function (pos) {
        var villageBlock = Minimap.getVillageBlock()
        var lineSize = Minimap.getLineSize()
        var mapPosition = Minimap.getMapPosition()

        var x = ((mapPosition[0] + mapPosition[2] - 2) * villageBlock) - pos.x
        var y = ((mapPosition[1] + mapPosition[3] - 2) * villageBlock) - pos.y

        $crossContext.fillStyle = settings.colorCross
        $crossContext.fillRect(x | 0, 0, 1, lineSize)
        $crossContext.fillRect(0, y | 0, lineSize, 1)
    }

    /**
     * Clean the cross canvas.
     *
     * @return {[type]} [description]
     */
    var clearCross = function () {
        $crossContext.clearRect(0, 0, $cross.width, $cross.height)
    }

    /**
     * Update the current selected village on cache canvas.
     */
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

    /**
     * Main and cross canvas render loop.
     */
    var renderStep = function () {
        if(enableRendering) {
            var pos =  {
                x: currentPosition.x - (frameSize.x / 2),
                y: currentPosition.y - (frameSize.y / 2)
            }

            clearViewport()
            clearCross()

            drawViewport(pos)

            if (settings.showCross) {
                drawCross(pos)
            }
        }

        window.requestAnimationFrame(renderStep)
    }

    /**
     * Load some sectors of villages on map.
     *
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

    /**
     * Parse the loaded villages to a quick access object.
     *
     * @param {Array} villages
     */
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

    /**
     * Executed when a village is hovered on minimap.
     *
     * @param {Object} coords - hovered village X and Y.
     */
    var onHoverVillage = function (coords, event) {
        if (hoverVillage) {
            if (hoverVillage.x === coords.x && hoverVillage.y === coords.y) {
                return false
            } else {
                onBlurVillage()
            }
        }

        eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_HOVER, [
            $mapData.getTownAt(coords.x, coords.y),
            event
        ])

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

    /**
     * Executed when the mouse leave a village on minimap.
     */
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

    /**
     * Temporally highlight all villages from the hovered players.
     *
     * @param {Array} villages - Array of villages to be highlighted.
     */
    var highlightVillages = function (villages) {
        drawVillages(villages, settings.colorQuickHighlight)
    }

    /**
     * Unhighlight the temporally highlighted villages.
     *
     * @param {Array} villages - Array of villages to be highlighted.
     */
    var unhighlightVillages = function (villages) {
        var _villages = []

        for (var i = 0; i < villages.length; i++) {
            _villages.push($mapData.getTownAt(villages[i][0], villages[i][1]))
        }

        drawVillages(_villages)
    }

    var easyHighlight = function (coords) {
        var village = $mapData.getTownAt(coords.x, coords.y)
        var action = settings.rightClickAction
        var type
        var id

        if (!village) {
            return false
        }

        switch (settings.rightClickAction) {
        case 'highlight-player':
            if (!village.character_id) {
                return false
            }

            type = 'character'
            id = village.character_id

            break
        case 'highlight-tribe':
            if (!village.tribe_id) {
                return false
            }

            type = 'tribe'
            id = village.tribe_id

            break
        case 'highlight-village':
            type = 'village'
            id = village.id

            break
        }

        Minimap.addHighlight({
            type: type,
            id: id
        }, Minimap.colorPalette.random())
    }

    /**
     * Minimap
     *
     * @type {Object}
     */
    var Minimap = {}

    /**
     * Minimap version
     *
     * @type {String}
     */
    Minimap.version = '__minimap_version'

    /**
     * Pre-loaded palette colors.
     * 
     * @type {Array}
     */
    Minimap.colorPalette = [
        '#000000', '#FFFFFF', '#969696', '#F0C800', '#0000DB', '#00A0F4', '#ED1212', '#BF4DA4', '#A96534', '#3E551C', '#436213', '#CCCCCC',
        '#868900', '#5100AF', '#7CC600', '#CC4DFF', '#DEC701', '#0120B0', '#98AB00', '#D512D7', '#01C46F', '#FF63FB', '#009132', '#190086', 
        '#95D86F', '#0045CF', '#C7CD53', '#6C75FF', '#CC8F00', '#008FFA', '#DF0004', '#22CBFF', '#FF3F28', '#00B184', '#99009F', '#96D68E',
        '#DD0080', '#0E5200', '#FF77E8', '#00602D', '#FF477C', '#01ACA2', '#C80030', '#01AFB8', '#BD3100', '#006AC3', '#DC5B00', '#031A70',
        '#EAC162', '#381058', '#FF9949', '#98B1FF', '#9A6B00', '#FAABFE', '#5F5500', '#FF78C3', '#94D3B9', '#BA004C', '#CAC0F0', '#6B2E00',
        '#EEB3EF', '#4A1F00', '#F8B5BC', '#43152D', '#FFAE82', '#6C004C', '#DEC2A0', '#990066', '#E6B9A8', '#8D0025', '#9B7892', '#FF745C'
    ]

    /**
     * @type {Object}
     */
    Minimap.settingsMap = {
        rightClickAction: {
            default: 'highlight-player',
            inputType: 'select',
            update: false
        },
        floatingMinimap: {
            default: false,
            inputType: 'checkbox',
            update: false
        },
        showCross: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        showDemarcations: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        showBarbarians: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        showGhostVillages: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        showOnlyCustomHighlights: {
            default: false,
            inputType: 'checkbox',
            update: true
        },
        highlightOwn: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        highlightSelected: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        highlightDiplomacy: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        colorSelected: {
            default: '#ffffff',
            inputType: 'colorPicker',
            update: true
        },
        colorBarbarian: {
            default: '#969696',
            inputType: 'colorPicker',
            update: true
        },
        colorPlayer: {
            default: '#f0c800',
            inputType: 'colorPicker',
            update: true
        },
        colorTribe: {
            default: '#0000DB',
            inputType: 'colorPicker',
            update: true
        },
        colorAlly: {
            default: '#00a0f4',
            inputType: 'colorPicker',
            update: true
        },
        colorEnemy: {
            default: '#ED1212',
            inputType: 'colorPicker',
            update: true
        },
        colorFriendly: {
            default: '#BF4DA4',
            inputType: 'colorPicker',
            update: true
        },
        colorUgly: {
            default: '#A96534',
            inputType: 'colorPicker',
            update: true
        },
        colorGhost: {
            default: '#3E551C',
            inputType: 'colorPicker',
            update: true
        },
        colorQuickHighlight: {
            default: '#ffffff',
            inputType: 'colorPicker',
            update: true
        },
        colorBackground: {
            default: '#436213',
            inputType: 'colorPicker',
            update: true
        },
        colorProvince: {
            default: '#ffffff',
            inputType: 'colorPicker',
            update: true
        },
        colorContinent: {
            default: '#cccccc',
            inputType: 'colorPicker',
            update: true
        },
        colorCross: {
            default: '#999999',
            inputType: 'colorPicker',
            update: true
        }
    }

    /**
     * Set the size of a village on minimap in pixels.
     * Recomened to be a even number.
     *
     * @type {Number} value
     */
    Minimap.setVillageSize = function (value) {
        villageSize = value
    }

    /**
     * Get the village size on minimap.
     *
     * @return {Number}
     */
    Minimap.getVillageSize = function () {
        return villageSize
    }

    /**
     * Set the margin between the villages on minimap in pixels.
     *
     * @type {Number} value
     */
    Minimap.setVillageMargin = function (value) {
        villageMargin = value
    }

    /**
     * Get the margin between the villages on minimap.
     *
     * @return {Number}
     */
    Minimap.getVillageMargin = function () {
        return villageMargin
    }

    /**
     * Get the size used by each village on minimap in pixels.
     *
     * @return {Number}
     */
    Minimap.getVillageBlock = function () {
        return villageSize + villageMargin
    }

    /**
     * Get the size of the minimap based on villages size.
     *
     * @return {Number}
     */
    Minimap.getLineSize = function () {
        return 1000 * (villageSize + villageMargin)
    }

    /**
     * Get the center position of a village icon.
     *
     * @return {Number}
     */
    Minimap.getVillageAxisOffset = function () {
        return Math.round(villageSize / 2)
    }

    /**
     * @param {Object} data - Highlight data.
     * @param {String} data.type - village, player or tribe
     * @param {String} data.id - village/player/tribe id
     * @param {Number=} data.x - village X coord.
     * @param {Number=} data.y - village Y coord.
     * @param {String} color - Hex color
     *
     * @return {Boolean} true if successfully added
     */
    Minimap.addHighlight = function (data, color) {
        var update = false

        if (!data || !data.type || !data.id) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY)
            return false
        }

        if (!rhex.test(color)) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR)
            return false
        }

        if (highlights[data.type].hasOwnProperty(data.id)) {
            update = true
        }

        var _data = { color: color}

        if (data.type === 'village') {
            _data.x = data.x
            _data.y = data.y
        }

        highlights[data.type][data.id] = _data
        Lockr.set(STORAGE_ID.HIGHLIGHTS, highlights)

        if (update) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_UPDATE, [data, color])
        } else {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD, [data, color])
        }

        drawLoadedVillages()

        return true
    }

    /**
     * @param {Object} data - Highlight data.
     * @param {String} data.type - village, player or tribe
     * @param {String} data.id - village/player/tribe id
     *
     * @return {Boolean} true if successfully removed
     */
    Minimap.removeHighlight = function (data) {
        if (highlights[data.type][data.id]) {
            delete highlights[data.type][data.id]
            Lockr.set(STORAGE_ID.HIGHLIGHTS, highlights)
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_REMOVE, [data])

            drawLoadedVillages()

            return true
        }

        return false
    }

    /**
     * @param {String} type - village, player or tribe
     * @param {String} item - village id, player name or tribe tag
     * @return {Object}
     */
    Minimap.getHighlight = function (type, item) {
        if (highlights[type].hasOwnProperty(item)) {
            return highlights[type][item]
        } else {
            return false
        }
    }

    /**
     * @return {Object}
     */
    Minimap.getHighlights = function () {
        return highlights
    }

    /**
     * @param {Function} callback
     */
    Minimap.eachHighlight = function (callback) {
        for (var type in highlights) {
            for (var id in highlights[type]) {
                callback(type, id, highlights[type][id])
            }
        }
    }

    /**
     * Set the viewport canvas element (main canvas);
     *
     * @param {Element} element - The canvas.
     */
    Minimap.setViewport = function (element) {
        $viewport = element
        $viewport.style.background = settings.colorBackground
        $viewportContext = $viewport.getContext('2d')
    }

    /**
     * Set the cross canvas element;
     *
     * @param {Element} element - The canvas.
     */
    Minimap.setCross = function (element) {
        $cross = element
        $crossContext = $cross.getContext('2d')
    }

    /**
     * Set the current position of the minimap view.
     *
     * @param {Number} x
     * @param {Number} y
     */
    Minimap.setCurrentPosition = function (x, y) {
        var block = Minimap.getVillageBlock()

        currentPosition.x = x * block + 50
        currentPosition.y = y * block + (1000 - ((document.body.clientHeight - 238) / 2)) + 50
    }

    /**
     * Calculate the coords of the current position of the map.
     *
     * @return {Array}
     */
    Minimap.getMapPosition = function () {
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
    Minimap.updateSettings = function (changes) {
        var newValue
        var key
        var settingMap
        var updateMinimap = false

        for (key in changes) {
            settingMap = Minimap.settingsMap[key]
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
            Minimap.update()
        }

        return true
    }

    Minimap.resetSettings = function () {
        for (var key in Minimap.settingsMap) {
            settings[key] = Minimap.settingsMap[key].default
        }

        highlights = {
            village: {},
            character: {},
            tribe: {}
        }

        Lockr.set(STORAGE_ID.SETTINGS, settings)
        Lockr.set(STORAGE_ID.HIGHLIGHTS, highlights)

        Minimap.update()

        eventQueue.trigger(eventTypeProvider.MINIMAP_SETTINGS_RESET)
    }

    /**
     * Minimap settings.
     */
    Minimap.getSettings = function () {
        return settings
    }

    /**
     * Clear the viewport cache and redraw with the current settings.
     */
    Minimap.update = function () {
        var villageBlock = Minimap.getVillageBlock()

        $viewport.style.background = settings.colorBackground
        $viewportCacheContext.clearRect(0, 0, $viewportCache.width, $viewportCache.height)

        if (settings.showDemarcations) {
            drawGrid()
        }

        if (settings.showGhostVillages) {
            drawCachedVillages()
        }

        drawLoadedVillages()
    }

    Minimap.enableRendering = function () {
        enableRendering = true
    }

    Minimap.disableRendering = function () {
        enableRendering = false
    }

    /**
     * Init the Minimap.
     */
    Minimap.init = function () {
        Minimap.initialized = true

        $viewportCache = document.createElement('canvas')
        $viewportCacheContext = $viewportCache.getContext('2d')
        var localSettings = Lockr.get(STORAGE_ID.SETTINGS, {}, true)

        for (var key in Minimap.settingsMap) {
            var defaultValue = Minimap.settingsMap[key].default

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

    /**
     * Run the Minimap after the interface is loaded.
     */
    Minimap.run = function () {
        ready(function () {
            $map = document.getElementById('main-canvas')
            $player = modelDataService.getSelectedCharacter()
            $tribeRelations = $player.getTribeRelations()
            cachedVillages = Lockr.get(STORAGE_ID.CACHE_VILLAGES, {}, true)
            
            var villageBlock = Minimap.getVillageBlock()

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

            if (settings.showDemarcations) {
                drawGrid()
            }

            if (settings.showGhostVillages) {
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

    return Minimap
})
