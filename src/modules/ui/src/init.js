require([
    'two/ready',
    'two/ui'
], function (
    ready,
    Interface
) {
    if (Interface.isInitialized()) {
        return false
    }

    ready(function () {
        Interface.init()
    })
})
