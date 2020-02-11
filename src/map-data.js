define('two/mapData', [
    'conf/conf',
    'states/MapState'
], function (
    conf,
    mapState
) {
    let villages = []
    let width = 306
    let height = 306
    let grid = []
    let loadingQueue = {}

    const init = function () {
        setupGrid()
    }

    const setupGrid = function () {
        const xChunks = Math.ceil(conf.MAP_SIZE / width)
        const yChunks = Math.ceil(conf.MAP_SIZE / height)

        for (let gridX = 0; gridX < xChunks; gridX++) {
            grid.push([])

            let chunkX = width * gridX
            let chunkWidth = width.bound(0, chunkX + width).bound(0, conf.MAP_SIZE - chunkX)
            chunkX = chunkX.bound(0, conf.MAP_SIZE)

            for (let gridY = 0; gridY < yChunks; gridY++) {
                let chunkY = height * gridY
                let chunkHeight = height.bound(0, chunkY + height).bound(0, conf.MAP_SIZE - chunkY)
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

    const getVisibleGridCells = function (origin) {
        let cells = []

        for (let gridX = 0; gridX < grid.length; gridX++) {
            for (let gridY = 0; gridY < grid[gridX].length; gridY++) {
                let cell = grid[gridX][gridY]

                if (
                    Math.abs(origin.x) + width <= cell.x ||
                    Math.abs(origin.y) + height <= cell.y ||
                    Math.abs(origin.x) >= cell.x + cell.width ||
                    Math.abs(origin.y) >= cell.y + cell.height
                ) {
                    continue
                }

                cells.push(cell)
            }
        }

        return cells
    }

    const genLoadingId = function (cells) {
        let id = []

        cells.forEach(function (cell) {
            id.push(cell.x.toString() + cell.y.toString())
        })

        return id.join('')
    }

    let mapData = {}

    mapData.load = function (origin, callback, _error) {
        const cells = getVisibleGridCells(origin)
        let loadId = genLoadingId(cells)
        let requests = []
        const alreadyLoading = cells.every(function (cell) {
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

            let promise = new Promise(function (resolve, reject) {
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
            loadId = genLoadingId(cells)

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
