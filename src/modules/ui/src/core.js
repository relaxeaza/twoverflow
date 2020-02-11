define('two/ui', [
    'conf/conf',
    'conf/cdn'
], function (
    conf,
    cdnConf
) {
    let interfaceOverflow = {}
    let templates = {}
    let initialized = false
    let containerCreated = false

    let $head = document.querySelector('head')
    let $wrapper = document.querySelector('#wrapper')
    let httpService = injector.get('httpService')
    let templateManagerService = injector.get('templateManagerService')
    let $templateCache = injector.get('$templateCache')

    let $container
    let $menu
    let $mainButton

    const buildMenuContainer = function () {
        if (containerCreated) {
            return true
        }

        $container = document.createElement('div')
        $container.className = 'two-menu-container'
        $wrapper.appendChild($container)

        $mainButton = document.createElement('div')
        $mainButton.className = 'two-main-button'
        $container.appendChild($mainButton)

        $menu = document.createElement('div')
        $menu.className = 'two-menu'
        $container.appendChild($menu)

        containerCreated = true
    }

    templateManagerService.load = function (templateName, onSuccess, opt_onError) {
        let path

        const success = function (data, status, headers, config) {
            $templateCache.put(path.substr(1), data)

            if (angular.isFunction(onSuccess)) {
                onSuccess(data, status, headers, config)
            }

            if (!$rootScope.$$phase) {
                $rootScope.$apply()
            }
        }

        const error = function (data, status, headers, config) {
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

    interfaceOverflow.init = function () {
        if (initialized) {
            return false
        }

        initialized = true
        interfaceOverflow.addStyle('{: interface_css_style :}')
    }

    interfaceOverflow.addTemplate = function (path, data) {
        templates[path] = data
    }

    interfaceOverflow.addStyle = function (styles) {
        let $style = document.createElement('style')
        $style.type = 'text/css'
        $style.appendChild(document.createTextNode(styles))
        $head.appendChild($style)
    }

    interfaceOverflow.addMenuButton = function (label, order, _tooltip) {
        buildMenuContainer()

        let $button = document.createElement('div')
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

    interfaceOverflow.isInitialized = function () {
        return initialized
    }

    return interfaceOverflow
})
