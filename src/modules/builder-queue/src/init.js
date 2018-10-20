require([
    'two/ready',
    'two/builder',
    'two/builder/ui'
], function (
    ready,
    Builder
) {
    if (Builder.isInitialized()) {
        return false
    }

    ready(function () {
        Builder.init()
        Builder.interface()
    })
})
