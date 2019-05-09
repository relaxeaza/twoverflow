require([
    'two/language',
    'two/ready'
], function (
    twoLanguage,
    ready
) {
    ready(function () {
        twoLanguage.init()
        twoLanguage.addData('core', __overflow_locales)
    })
})
