require([
    'two/language',
    'two/ready',
    'two/farm',
    'two/farm/ui',
    'two/farm/Events'
], function (
    twoLanguage,
    ready,
    farmOverflow,
    farmOverflowInterface
) {
    if (farmOverflow.isInitialized()) {
        return false
    }

    ready(function () {
        twoLanguage.add('__farm_id', __farm_locale)
        farmOverflow.init()
        farmOverflowInterface()
    }, ['map'])
})
