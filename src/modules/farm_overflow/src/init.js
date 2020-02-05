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
        twoLanguage.add('{: farm_overflow_id :}', {: farm_overflow_lang :})
        farmOverflow.init()
        farmOverflowInterface()
    }, ['map'])
})
