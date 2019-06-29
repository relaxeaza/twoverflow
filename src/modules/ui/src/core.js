define('two/ui', [
    'conf/conf',
    'conf/cdn'
], function (
    conf,
    cdnConf
) {
    var interfaceOverflow = {}
    var templates = {}
    var initialized = false

    var $head = document.querySelector('head')
    var $wrapper = document.querySelector('#wrapper')
    var httpService = injector.get('httpService')
    var templateManagerService = injector.get('templateManagerService')
    var $templateCache = injector.get('$templateCache')

    var $container
    var $menu
    var $mainButton

    var init = function () {
        interfaceOverflow.addStyle('__interface_css_style')
        buildMenuContainer()
    }

    var buildMenuContainer = function () {
        $container = document.createElement('div')
        $container.className = 'two-menu-container'
        $wrapper.appendChild($container)

        $mainButton = document.createElement('div')
        $mainButton.className = 'two-main-button'
        $container.appendChild($mainButton)

        $menu = document.createElement('div')
        $menu.className = 'two-menu'
        $container.appendChild($menu)
    }

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

    interfaceOverflow.addMenuButton = function (label, order, _tooltip) {
        var $button = document.createElement('div')
        $button.className = 'btn-border btn-green button'
        $button.innerHTML = label
        $button.style.order = order
        $menu.appendChild($button)

        if (typeof _tooltip === 'string') {
            $button.addEventListener('mouseenter', function (event) {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_SHOW, 'twoverflow-tooltip', _tooltip, true, event)
            })

            $button.addEventListener('mouseleave', function () {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            })
        }

        return $menu.appendChild($button)
    }

    init()

    return interfaceOverflow
})
