define('two/ui', [
    'conf/conf',
    'conf/cdn'
], function (
    conf,
    cdnConf
) {
    var interfaceOverflow = {}
    var templates = {}

    var $head = document.querySelector('head')
    var httpService = injector.get('httpService')
    var templateManagerService = injector.get('templateManagerService')
    var $templateCache = injector.get('$templateCache')

    templateManagerService.load = function (templateName, onSuccess, opt_onError) {
        var path

        var success = function (data, status, headers, config) {
            $templateCache.put(path.substr(1), data)

            if (angular.isFunction(onSuccess)) {
                onSuccess(data, status, headers, config)
            }

            if (!$rootScope.$$phase) {
                $rootScope.$apply()
            }
        }
        var error = function (data, status, headers, config) {
            if (angular.isFunction(opt_onError)) {
                opt_onError(data, status, headers, config)
            }
        }

        if (0 !== templateName.indexOf('!')) {
            path = conf.TEMPLATE_PATH_EXT.join(templateName)
        } else {
            path = templateName.substr(1)
        }

        if ($templateCache.get(path.substr(1))) {
            success($templateCache.get(path.substr(1)), 304)
        } else {
            if (cdnConf.versionMap[path]) {
                httpService.get(path, success, error)
            } else {
                success(templates[path], 304)
            }
        }
    }

    interfaceOverflow.addTemplate = function (path, data) {
        templates[path] = data
    }

    interfaceOverflow.addStyle = function (styles) {
        var $style = document.createElement('style')
        $style.type = 'text/css'
        $style.appendChild(document.createTextNode(styles))
        $head.appendChild($style)
    }

    return interfaceOverflow
})
