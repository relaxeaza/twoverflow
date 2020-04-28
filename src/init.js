require([
    'two/language',
    'two/ready',
    'Lockr'
], function (
    twoLanguage,
    ready,
    Lockr
) {
    const checkNewVersion = function () {
        const currentVersion = '___overflow_version'
        const storedVersion = Lockr.get('twoverflow_version', '1.0.0')

        if (currentVersion.endsWith('dev')) {
            return false
        }

        const versionNumber = function (rawVersion) {
            if (/\d+\.\d+\.\d+/.test(rawVersion)) {
                return parseInt(rawVersion.split('.').reduce((a, b) => a + b), 10)
            }
        }

        if (versionNumber(currentVersion) > versionNumber(storedVersion)) {
            const changelogUrl = 'https://gitlab.com/relaxeaza/twoverflow/blob/master/CHANGELOG.md'
            const changelogMsg = $filter('i18n')('check_changes', $rootScope.loc.ale, 'common')
            const firefoxMsg = $filter('i18n')('firefox_shill', $rootScope.loc.ale, 'common')
            const updatedMsg = $filter('i18n')('new_version', $rootScope.loc.ale, 'common', currentVersion)

            $rootScope.$broadcast(eventTypeProvider.NOTIFICATION_NEW, {
                message: `[b]${updatedMsg}[/b]\n[url=${changelogUrl}]${changelogMsg}[/url]\n\n${firefoxMsg}`
            })

            Lockr.set('twoverflow_version', currentVersion)
        }
    }

    ready(function () {
        twoLanguage.init()
        checkNewVersion()
    })
})
