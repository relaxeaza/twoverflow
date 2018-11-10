define('two/ui2', [
    'conf/conf',
    'conf/cdn'
], function (
    conf,
    cdnConf
) {
    var ui = {}
    var templates = {}

    var $head = document.querySelector('head')
    var httpService = injector.get('httpService')
    var templateManagerService = injector.get('templateManagerService')
    var $templateCache = injector.get('$templateCache')

    templateManagerService.load = function (templateName, onSuccess, opt_onError) {
        var success = function (data, status, headers, config) {
                $templateCache.put(path.substr(1), data)

                if (angular.isFunction(onSuccess)) {
                    onSuccess(data, status, headers, config)
                }

                if (!rootScope.$$phase) {
                    rootScope.$apply()
                }
            },
            error = function error(data, status, headers, config) {
                if (angular.isFunction(opt_onError)) {
                    opt_onError(data, status, headers, config)
                }
            },
            path

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

    ui.template = function (path, data) {
        templates[path] = data
    }

    ui.css = function (styles) {
        var $style = document.createElement('style')
        $style.type = 'text/css'
        $style.appendChild(document.createTextNode(styles))
        $head.appendChild($style)
    }

    ui.css('__interface_css_style')

    return ui
})
