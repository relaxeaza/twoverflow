require([
    'two/language',
    'two/ready',
    'two/attackView',
    'two/attackView/ui',
    'two/attackView/events'
], function (
    twoLanguage,
    ready,
    attackView,
    attackViewInterface
) {
    if (attackView.isInitialized()) {
        return false
    }

    ready(function () {
        twoLanguage.add('___attack_view_id', ___attack_view_lang)
        attackView.init()
        attackViewInterface()
    })
})
