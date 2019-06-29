define('two/ui/button', [], function () {
    function FrontButton (label, options) {
        this.options = options = angular.merge({
            label: label,
            className: '',
            classHover: 'expand-button',
            classBlur: 'contract-button',
            tooltip: false,
            onClick: function() {}
        }, options)

        // this.buildWrapper()
        this.appendButton()

        var $elem = this.$elem

        var $label = $elem.querySelector('.label')
        var $quick = $elem.querySelector('.quickview')

        if (options.classHover) {
            $elem.addEventListener('mouseenter', function () {
                $elem.classList.add(options.classHover)
                $elem.classList.remove(options.classBlur)

                // $label.hide()
                $label.style.display = 'none'
                // $quick.show()
                $quick.style.display = ''
            })
        }

        if (options.classBlur) {
            $elem.addEventListener('mouseleave', function () {
                $elem.classList.add(options.classBlur)
                $elem.classList.remove(options.classHover)

                // $quick.hide()
                $quick.style.display = 'none'
                // $label.show()
                $label.style.display = ''
            })
        }

        if (options.tooltip) {
            $elem.addEventListener('mouseenter', function (event) {
                $rootScope.$broadcast(
                    eventTypeProvider.TOOLTIP_SHOW,
                    'twoverflow-tooltip',
                    options.tooltip,
                    true,
                    event
                )
            })

            $elem.addEventListener('mouseleave', function () {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            })
        }

        if (options.onClick) {
            $elem.addEventListener('click', options.onClick)
        }

        return this
    }

    FrontButton.prototype.updateQuickview = function (text) {
        this.$elem.querySelector('.quickview').innerHTML = text
    }

    FrontButton.prototype.hover = function (handler) {
        this.$elem.addEventListener('mouseenter', handler)
    }

    FrontButton.prototype.click = function (handler) {
        this.$elem.addEventListener('click', handler)
    }

    // FrontButton.prototype.buildWrapper = function () {
    //     var $wrapper = document.getElementById('two-bar')

    //     if (!$wrapper) {
    //         $wrapper = document.createElement('div')
    //         $wrapper.id = 'two-bar'
    //         document.querySelector('#wrapper').appendChild($wrapper)
    //     }

    //     this.$wrapper = $wrapper
    // }

    FrontButton.prototype.appendButton = function () {
        var $container = document.createElement('div')
        $container.innerHTML = '<div class="btn-border btn-green button ' + this.options.className + '"><div class="top-left"></div><div class="top-right"></div><div class="middle-top"></div><div class="middle-bottom"></div><div class="middle-left"></div><div class="middle-right"></div><div class="bottom-left"></div><div class="bottom-right"></div><div class="label">' + this.options.label + '</div><div class="quickview"></div></div>'
        this.$elem = $container.children[0]

        document.querySelector('#two-bar').appendChild(this.$elem)

        
    }

    FrontButton.prototype.destroy = function () {
        this.$elem.remove()
    }

    return FrontButton
})
