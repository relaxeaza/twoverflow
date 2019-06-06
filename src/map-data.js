define('two/mapData', [
    'conf/conf',
    'states/MapState'
], function (
    conf,
    mapState
) {
    var villages = []
    var width = 306
    var height = 306
    var grid = []
    var loadingQueue = {}

    var init = function () {
        setupGrid()
    }

    var setupGrid = function () {
        var xChunks = Math.ceil(conf.MAP_SIZE / width)
        var yChunks = Math.ceil(conf.MAP_SIZE / height)
        var chunkWidth
        var chunkHeight
        var chunkX
        var chunkY
        var gridX
        var gridY

        for (gridX = 0; gridX < xChunks; gridX++) {
            grid.push([])

            chunkX = width * gridX
            chunkWidth = width.bound(0, chunkX + width).bound(0, conf.MAP_SIZE - chunkX)
            chunkX = chunkX.bound(0, conf.MAP_SIZE)

            for (gridY = 0; gridY < yChunks; gridY++) {
                chunkY = height * gridY
                chunkHeight = height.bound(0, chunkY + height).bound(0, conf.MAP_SIZE - chunkY)
                chunkY = chunkY.bound(0, conf.MAP_SIZE)

                grid[gridX].push({
                    x: chunkX,
                    y: chunkY,
                    width: chunkWidth,
                    height: chunkHeight,
                    loaded: false,
                    loading: false
                })
            }
        }
    }

    var getVisibleGridCells = function (x, y) {
        var cells = []
        var cell
        var gridX
        var gridY

        for (gridX = 0; gridX < grid.length; gridX++) {
            for (gridY = 0; gridY < grid[gridX].length; gridY++) {
                cell = grid[gridX][gridY]

                if (
                    Math.abs(x) + width <= cell.x ||
                    Math.abs(y) + height <= cell.y ||
                    Math.abs(x) >= cell.x + cell.width ||
                    Math.abs(y) >= cell.y + cell.height
                ) {
                    continue
                }

                cells.push(cell)
            }
        }

        return cells
    }

    var genLoadingId = function (cells) {
        var id = []

        cells.forEach(function (cell) {
            id.push(cell.x.toString() + cell.y.toString())
        })

        return id.join('')
    }

    var mapData = {}

    mapData.load = function (x, y, callback, _error) {
        var cells = getVisibleGridCells(x, y)
        var loadId = genLoadingId(cells)
        var requests = []
        var promise
        var alreadyLoading = cells.every(function (cell) {
            return cell.loading
        })

        loadingQueue[loadId] = loadingQueue[loadId] || []
        loadingQueue[loadId].push(callback)

        if (alreadyLoading) {
            return
        }

        cells.forEach(function (cell) {
            if (cell.loaded || cell.loading) {
                return
            }

            cell.loading = true

            promise = new Promise(function (resolve, reject) {
                socketService.emit(routeProvider.MAP_GET_MINIMAP_VILLAGES, cell, function (data) {
                    cell.loaded = true
                    cell.loading = false

                    if (data.message) {
                        return reject(data.message)
                    }

                    if (data.villages.length) {
                        villages = villages.concat(data.villages)
                    }

                    resolve(cell)
                })
            })

            requests.push(promise)
        })

        if (!requests.length) {
            return callback(villages)
        }

        Promise.all(requests)
        .then(function (cells) {
            var loadId = genLoadingId(cells)

            loadingQueue[loadId].forEach(function (handler) {
                handler(villages)
            })

            delete loadingQueue[loadId]
        })
        .catch(function (error) {
            console.error(error.message)
        })
    }

    mapData.getVillages = function () {
        return villages
    }

    init()

    return mapData
})
