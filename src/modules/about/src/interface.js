define('two/about/ui', [
    'two/ui'
], function (
    interfaceOverflow
) {
    var textObject = 'about'
    var textObjectCommon = 'common'
    var $scope
    
    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var init = function () {
        $opener = interfaceOverflow.addMenuButton('About', 100)

        $opener.addEventListener('click', function () {
            buildWindow()
        })

        interfaceOverflow.addTemplate('twoverflow_about_window', `{: about_html_main :}`)
        interfaceOverflow.addStyle('{: about_css_style :}')
    }

    var buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.version = '{: overflow_version :}'

        $scope.selectTab = selectTab

        windowManagerService.getModal('!twoverflow_about_window', $scope)
    }

    return init
})
