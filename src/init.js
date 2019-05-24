require([
    'two/language',
    'two/ready'
], function (
    twoLanguage,
    ready
) {
    ready(function () {
        twoLanguage.add('core', __overflow_lang)
    })
})
