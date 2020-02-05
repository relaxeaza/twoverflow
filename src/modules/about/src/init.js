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
        twoLanguage.add('{: about_id :}', {: about_lang :})
        about.init()
        aboutInterface()
    }, ['map'])
})
