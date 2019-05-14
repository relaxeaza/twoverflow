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
        twoLanguage.add('__attack_view_id', __attack_view_locale)
        attackView.init()
        attackViewInterface()
    })
})
