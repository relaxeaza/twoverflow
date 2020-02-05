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
        twoLanguage.add('{: attack_view_id :}', {: attack_view_lang :})
        attackView.init()
        attackViewInterface()
    })
})
