require([
    'two/language',
    'two/ready',
    'two/about',
    'two/about/ui'
], function (
    twoLanguage,
    ready,
    about,
    aboutInterface
) {
    if (about.isInitialized()) {
        return false
    }

    ready(function () {
        twoLanguage.add('___about_id', ___about_lang) // eslint-disable-line
        about.init()
        aboutInterface()
    }, ['map'])
})
