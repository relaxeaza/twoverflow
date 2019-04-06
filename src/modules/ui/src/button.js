define('two/FrontButton', [], function () {
    function FrontButton (label, options) {
        this.options = options = angular.merge({
            label: label,
            className: '',
            classHover: 'expand-button',
            classBlur: 'contract-button',
            tooltip: false,
            onClick: function() {}
        }, options)

        this.buildWrapper()
        this.appendButton()

        var $elem = this.$elem

        var $label = $elem.find('.label')
        var $quick = $elem.find('.quickview')

        if (options.classHover) {
            $elem.on('mouseenter', function () {
                $elem.addClass(options.classHover)
                $elem.removeClass(options.classBlur)

                $label.hide()
                $quick.show()
            })
        }

        if (options.classBlur) {
            $elem.on('mouseleave', function () {
                $elem.addClass(options.classBlur)
                $elem.removeClass(options.classHover)

                $quick.hide()
                $label.show()
            })
        }

        if (options.tooltip) {
            $elem.on('mouseenter', function (event) {
                $rootScope.$broadcast(
                    eventTypeProvider.TOOLTIP_SHOW,
                    'twoverflow-tooltip',
                    options.tooltip,
                    true,
                    event
                )
            })

            $elem.on('mouseleave', function () {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            })
        }

        if (options.onClick) {
            this.click(options.onClick)
        }

        return this
    }

    FrontButton.prototype.updateQuickview = function (text) {
        this.$elem.find('.quickview').html(text)
    }

    FrontButton.prototype.hover = function (handler) {
        this.$elem.on('mouseenter', handler)
    }

    FrontButton.prototype.click = function (handler) {
        this.$elem.on('click', handler)
    }

    FrontButton.prototype.buildWrapper = function () {
        var $wrapper = document.getElementById('twOverflow-leftbar')

        if (!$wrapper) {
            $wrapper = document.createElement('div')
            $wrapper.id = 'twOverflow-leftbar'
            $('#toolbar-left').prepend($wrapper)
        }

        this.$wrapper = $wrapper
    }

    FrontButton.prototype.appendButton = function () {
        var $container = document.createElement('div')
        $container.innerHTML = '<div class="btn-border btn-green button ' + this.options.className + '"><div class="top-left"></div><div class="top-right"></div><div class="middle-top"></div><div class="middle-bottom"></div><div class="middle-left"></div><div class="middle-right"></div><div class="bottom-left"></div><div class="bottom-right"></div><div class="label">' + this.options.label + '</div><div class="quickview"></div></div>'
        var $elem = $container.children[0]

        this.$wrapper.appendChild($elem)
        this.$elem = $($elem)
    }

    FrontButton.prototype.destroy = function () {
        this.$elem.remove()
    }

    return FrontButton
})
