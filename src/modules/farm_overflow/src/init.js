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
        twoLanguage.add('__farm_overflow_id', __farm_overflow_lang)
        farmOverflow.init()

        // wait presets to load.
        // temporary (not needed when started manually)
        setTimeout(function () {
            farmOverflow.start()
        }, 1000)

        farmOverflowInterface()
    }, ['map'])
})
