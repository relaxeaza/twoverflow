require([
    'two/ready',
    'two/attackView',
    'two/attackView/ui'
], function (
    ready,
    attackView
) {
    if (attackView.initialized) {
        return false
    }

    ready(function () {
        attackView.init()
        attackView.interface()
    })
})
