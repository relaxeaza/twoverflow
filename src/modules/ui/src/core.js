define('two/ui', [
    'two/utils',
    'queues/EventQueue',
    'helper/dom',
    'ejs'
], function (
    utils,
    $eventQueue,
    domHelper,
    ejs
) {
    /**
     * Previne os recursos da interface de serem
     * incluidas no documento mais de uma vez.
     *
     * @type {Boolean}
     */
    var initialized = false

    /**
     * Lista com todas janelas criadas pelo Interface()
     *
     * @type {Array}
     */
    var interfaceInstances = []

    /**
     * Fecha todas as janelas criadas pelo Interface()
     */
    var closeAllInstances = function () {
        interfaceInstances.forEach(function (ui) {
            ui.closeWindow()
        })
    }

    /**
     * Gera um elemento <style>
     *
     * @param  {String} id - ID do element
     * @param  {String} css - Estilos formato CSS
     */
    var buildStyle = function (id, css) {
        var $style = document.createElement('style')
        $style.type = 'text/css'
        $style.id = 'twOverflow-style-' + id
        $style.innerHTML = css

        document.querySelector('head').appendChild($style)
    }

    /**
     * Gera um <select> customizado
     *
     * @param  {Element} $originalSelect - Elemento <select> que será substituido
     */
    var createSelect = function ($originalSelect) {
        var visible = false
        var selectId = 'custom-select'
        var $select = document.createElement('span')
        var $selectedOption = document.createElement('span')
        var $selectArrow = document.createElement('span')
        var $dataContainer = document.createElement('span')

        var clickHandler = function (event) {
            var elem = event.srcElement || event.target

            if (!utils.matchesElem(elem, '.custom-select')) {
                hideSelect()
            }
        }

        var hideSelect = function () {
            rootScope.$broadcast(eventTypeProvider.SELECT_HIDE, selectId)

            $(window).off('click', clickHandler)
            $('.win-main').off('mousewheel', hideSelect)

            visible = false

            onHide()
        }

        var onSelect = function (data, event) {
            $selectedOption.innerHTML = data.name
            $select.dataset.name = data.name
            $select.dataset.value = data.value

            $($select).trigger('selectSelected')

            hideSelect()
        }

        var onShow = function () {
            $selectArrow.classList.remove('icon-26x26-arrow-down')
            $selectArrow.classList.add('icon-26x26-arrow-up')
        }

        var onHide = function () {
            $selectArrow.classList.remove('icon-26x26-arrow-up')
            $selectArrow.classList.add('icon-26x26-arrow-down')
        }

        var $options = $originalSelect.querySelectorAll('option')

        $options.forEach(function ($option) {
            var dataElem = document.createElement('span')
            dataElem.dataset.name = $option.innerText
            dataElem.dataset.value = $option.value

            $dataContainer.appendChild(dataElem)

            if ($option.hasAttribute('selected')) {
                $selectedOption.innerHTML = $option.innerText
                $select.dataset.name = $option.innerText
                $select.dataset.value = $option.value
            }
        })

        for (var i in $originalSelect.dataset) {
            $select.dataset[i] = $originalSelect.dataset[i]
        }

        $select.className = 'custom-select ' + $originalSelect.className
        $selectArrow.className = 'custom-select-button icon-26x26-arrow-down'
        $selectedOption.className = 'custom-select-handler'
        $dataContainer.className = 'custom-select-data'

        $select.appendChild($selectedOption)
        $select.appendChild($selectArrow)
        $select.appendChild($dataContainer)

        $select.addEventListener('click', function () {
            if (visible) {
                return hideSelect()
            }

            var dataElements = $dataContainer.querySelectorAll('span')
            var selectData = []
            var selectedData = {}

            dataElements.forEach(function (elem) {
                var data = {
                    name: elem.dataset.name,
                    value: elem.dataset.value
                }

                if (elem.dataset.icon) {
                    data.leftIcon = isNaN(elem.dataset.icon)
                        ? elem.dataset.icon
                        : parseInt(elem.dataset.icon, 10)
                }

                if (elem.dataset.name === $selectedOption.innerHTML) {
                    selectedData = data
                }

                selectData.push(data)
            })

            rootScope.$broadcast(
                eventTypeProvider.SELECT_SHOW,
                selectId,
                selectData,
                selectedData,
                onSelect,
                $select,
                true /*dropdown please*/
            )

            visible = true

            onShow()

            $('.win-main').on('mousewheel', hideSelect)
            $(window).on('click', clickHandler)
        })

        $originalSelect.replaceWith($select)
    }

    /**
     * @class
     */
    function Interface (windowId, settings) {
        var self = this

        interfaceInstances.push(self)

        self.windowId = windowId
        self.activeTab = settings.activeTab
        self.settings = settings

        buildStyle(windowId, settings.css)

        self.buildWindow()
        self.bindTabs()
        self.setCollapse()
        self.setTooltips()
        self.setCheckboxes()
        self.setSelects()

        var $close = self.$window.querySelector('.twOverflow-close')

        $close.addEventListener('click', function () {
            self.closeWindow()
        })

        rootScope.$on(eventTypeProvider.WINDOW_CLOSED, function (event, templateName, force) {
            if (force || templateName === windowId) {
                self.closeWindow()
            }
        })

        return self
    }

    /**
     * Injeta a estrutura.
     */
    Interface.prototype.buildWindow = function () {
        this.$wrapper = $('#wrapper')

        this.$window = document.createElement('section')
        this.$window.id = this.windowId
        this.$window.className = 'twOverflow-window twx-window screen left'
        this.$window.style.visibility = 'hidden'

        this.$window.innerHTML = ejs.render(this.settings.template, this.settings.replaces)
        this.$wrapper.append(this.$window)

        this.$scrollbar = jsScrollbar(this.$window.querySelector('.win-main'))
    }

    /**
     * Abrir janela.
     */
    Interface.prototype.openWindow = function () {
        windowManagerService.closeAll()
        closeAllInstances()

        this.$window.style.visibility = 'visible'
        this.$wrapper.addClass('window-open')
        this.resizeWindowFrame()
    }

    /**
     * Atualiza a area ocupada pela janela para que o resto do jogo
     * se adapite a ela.
     */
    Interface.prototype.resizeWindowFrame = function () {
        $eventQueue.trigger($eventQueue.types.RESIZE, {
            'instant': true,
            'right': true
        })
    }

    /**
     * Fecha janela.
     */
    Interface.prototype.closeWindow = function () {
        if (this.$window.style.visibility === 'visible') {
            if (this.settings.onClose) {
                this.settings.onClose()
            }

            this.$window.style.visibility = 'hidden'
            this.$wrapper.removeClass('window-open')

            this.resizeWindowFrame()
        }
    }

    /**
     * Altera o estado da janela.
     *
     * @param {String} state - Estado da visibilidade (hidden || visible)
     */
    Interface.prototype.toggleWindow = function (state) {
        this.$window.style.visibility = state
        this.$wrapper.toggleClass('window-open')

        this.resizeWindowFrame()
    }

    /**
     * Controla o estado das abas.
     */
    Interface.prototype.tabsState = function (oldTab, newTab) {
        var self = this

        if (oldTab === newTab) {
            return false
        }

        self.$tabs.forEach(function ($tab) {
            var name = $tab.getAttribute('tab')

            if (name !== oldTab && name !== newTab) {
                return false
            }
            
            if (name === oldTab) {
                self.disableTab(name, $tab)
            } else if (name === newTab) {
                self.enableTab(name, $tab)
            }
        })
    }

    /**
     * Listener das abas.
     */
    Interface.prototype.bindTabs = function () {
        var self = this

        self.$tabs = self.$window.querySelectorAll('.tab')

        self.$tabs.forEach(function ($tab) {
            var name = $tab.getAttribute('tab')

            $tab.addEventListener('click', function () {
                self.tabsState(self.activeTab, name)
                self.activeTab = name

                if (self.settings.onTabClick) {
                    self.settings.onTabClick(name)
                }
            })

            if (self.activeTab === name) {
                self.enableTab(name, $tab)
            } else {
                self.disableTab(name, $tab)
            }

            self.recalcScrollbar()
        })
    }

    /**
     * Altera o estado da aba aba para ativado e exibe o conteúdo quando
     * selecionado pelo usuário.
     */
    Interface.prototype.enableTab = function (name, $tab) {
        var $content = this.$window.querySelector('.twOverflow-content-' + name)
        var $buttons = this.$window.querySelectorAll('.twOverflow-button-' + name)
        var $neutralButtons = this.$window.querySelectorAll('.twOverflow-button')
        var $inner = $tab.querySelector('.tab-inner > div')
        var $a = $tab.querySelector('a')
        var $footer = this.$window.querySelector('footer')

        $content.style.display = ''
        $tab.classList.add('tab-active')
        $inner.classList.add('box-border-light')
        $a.classList.remove('btn-icon', 'btn-orange')

        if ($footer) {
            $footer.style.display = ($buttons.length || $neutralButtons.length) ? '' : 'none'

            if ($buttons.length) {
                $buttons.forEach(function ($button) {
                    $button.style.display = ''
                })
            }
        }

        this.$scrollbar.content = $content
        this.recalcScrollbar()
    }

    /**
     * Altera o estado da aba aba para desativado e oculta o conteúdo.
     */
    Interface.prototype.disableTab = function (name, $tab) {
        var $content = this.$window.querySelector('.twOverflow-content-' + name)
        var $buttons = this.$window.querySelectorAll('.twOverflow-button-' + name)
        var $neutralButtons = this.$window.querySelectorAll('.twOverflow-button')
        var $inner = $tab.querySelector('.tab-inner > div')
        var $a = $tab.querySelector('a')
        var $footer = this.$window.querySelector('footer')

        $content.style.display = 'none'
        $tab.classList.remove('tab-active')
        $inner.classList.remove('box-border-light')
        $a.classList.add('btn-icon', 'btn-orange')

        if ($footer) {
            if ($buttons.length) {
                $buttons.forEach(function ($button) {
                    $button.style.display = 'none'
                })
            }
        }
    }

    /**
     * Remove todo html/eventos criados.
     */
    Interface.prototype.destroy = function () {
        document.querySelector('#twOverflow-style-' + this.windowId).remove()
        this.$window.remove()
    }

    /**
     * Adiciona botão para ocutar/mostrar conteúdo da sessão
     */
    Interface.prototype.setCollapse = function () {
        var self = this

        self.$window.querySelectorAll('.twx-section.collapse').forEach(function ($section) {
            var visible = !$section.classList.contains('hidden-content')

            var $collapse = document.createElement('span')
            $collapse.className = 'min-max-btn'

            var $icon = document.createElement('a')
            $icon.className = 'btn-orange icon-26x26-' + (visible ? 'minus' : 'plus')

            if (!visible) {
                $section.nextSibling.style.display = 'none'
            }

            $collapse.appendChild($icon)
            $section.appendChild($collapse)

            $collapse.addEventListener('click', function () {
                var state = $section.nextSibling.style.display

                if (state === 'none') {
                    $section.nextSibling.style.display = ''
                    $icon.className = $icon.className.replace('plus', 'minus')
                    visible = true
                } else {
                    $section.nextSibling.style.display = 'none'
                    $icon.className = $icon.className.replace('minus', 'plus')
                    visible = false
                }

                self.recalcScrollbar()
            })
        })
    }

    Interface.prototype.setTooltips = function () {
        var self = this

        var $nativeTooltip = $('#tooltip')
        var $tooltipContent = $nativeTooltip.find('.tooltip-content-wrapper')

        self.$window.querySelectorAll('[tooltip]').forEach(function ($elem) {
            var text = $elem.getAttribute('tooltip')
            $elem.removeAttribute('tooltip')

            $elem.addEventListener('mouseenter', function (event) {
                rootScope.$broadcast(eventTypeProvider.TOOLTIP_SHOW, 'twoverflow-tooltip', text, true, event)
            })

            $elem.addEventListener('mouseleave', function () {
                rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            })
        })
    }

    Interface.prototype.setCheckboxes = function () {
        this.$window.querySelectorAll('input[type=checkbox]').forEach(function ($elem) {
            $elem.addEventListener('click', function () {
                $($elem).parent().toggleClass('icon-26x26-checkbox-checked')
            })
        })
    }

    Interface.prototype.isVisible = function (tab) {
        var visible = this.$window.style.visibility === 'visible'

        if (visible && tab) {
            visible = this.activeTab === tab
        }

        return visible
    }

    Interface.prototype.recalcScrollbar = function () {
        this.$scrollbar.recalc()
    }

    Interface.prototype.setSelects = function () {
        this.$window.querySelectorAll('select').forEach(function ($elem) {
            createSelect($elem)
        })
    }

    Interface.init = function () {
        initialized = true

        buildStyle('own', '__interface_css_style')
    }

    Interface.isInitialized = function () {
        return initialized
    }

    return Interface
})
