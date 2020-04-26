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
            const newVersionMsg = $filter('i18n')('new_version', $rootScope.loc.ale, 'common', currentVersion)
            const checkChangelogMsg = $filter('i18n')('check_changes', $rootScope.loc.ale, 'common')
            const changelogBB = `[url=${changelogUrl}]${checkChangelogMsg}[/url]`

            $rootScope.$broadcast(eventTypeProvider.NOTIFICATION_NEW, {
                message: newVersionMsg + '\n\n' + changelogBB
            })

            Lockr.set('twoverflow_version', currentVersion)
        }
    }

    ready(function () {
        twoLanguage.add('core', ___overflow_lang) // eslint-disable-line
        checkNewVersion()
    })
})
