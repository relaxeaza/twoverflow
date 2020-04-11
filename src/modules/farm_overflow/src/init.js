require([
    'two/language',
    'two/ready',
    'two/farmOverflow',
    'two/farmOverflow/ui',
    'two/farmOverflow/events'
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
        twoLanguage.add('___farm_overflow_id', ___farm_overflow_lang) // eslint-disable-line
        farmOverflow.init()
        farmOverflowInterface()
    }, ['map'])
})
