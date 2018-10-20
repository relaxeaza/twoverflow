require([
    'two/ready',
    'two/minimap',
    'two/minimap/data',
    'two/minimap/ui'
], function (
    ready,
    Minimap
) {
    if (Minimap.initialized) {
        return false
    }

    ready(function () {
        Minimap.init()
        Minimap.interface()
        Minimap.run()
    })
})
