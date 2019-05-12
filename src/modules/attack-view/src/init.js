require([
    'two/language',
    'two/ready',
    'two/attackView',
    'two/attackView/ui',
    'two/attackView/Events'
], function (
    twoLanguage,
    ready,
    attackView,
    attackViewInterface
) {
    if (attackView.initialized) {
        return false
    }

    ready(function () {
        twoLanguage.addData('__attackView_id', __attackView_locale)
        attackView.init()
        attackViewInterface()
    })
})
