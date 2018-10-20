define('two/minimap/colorPicker', [
    'two/minimap',
    'two/utils',
    'ejs'
], function (
    Minimap,
    utils,
    ejs
) {
    var $colorPicker
    var $custom
    var $colors
    var rhex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

    var createElementFragment = function (html) {
        var $template = document.createElement('template')
        $template.innerHTML = html.trim()
        return $($template.content.firstChild)
    }

    var colorPicker = {
        callback: function () {},
        visible: false
    }

    colorPicker.init = function () {
        colorPicker.makeContainer()

        $custom.on('keypress', function (event) {
            if (event.keyCode === 13) {
                if (rhex.test(this.value)) {
                    colorPicker.callback(this.value)
                    colorPicker.hide()
                }
            }
        })

        $colors.on('mouseover', function () {
            $custom.val(this.dataset.color)
        })

        $colors.on('click', function () {
            colorPicker.callback(this.dataset.color)
            colorPicker.hide()
        })
    }

    colorPicker.makeContainer = function () {
        $colorPicker = createElementFragment(ejs.render('__minimap_html_colorpicker', {
            colorPalette: Minimap.colorPalette
        }))
        $custom = $colorPicker.find('.custom input')
        $colors = $colorPicker.find('.color')

        document.body.appendChild($colorPicker[0])
    }

    colorPicker.setCallback = function (callback) {
        colorPicker.callback = callback
    }

    colorPicker.hideHandler = function (event) {
        var elem = event.srcElement || event.target

        if (!utils.matchesElem(elem, '.color-picker')) {
            colorPicker.hide()
        }
    }

    colorPicker.show = function () {
        $colorPicker[0].style.display = ''
        colorPicker.visible = true
    }

    colorPicker.hide = function () {
        $colorPicker.hide()
        colorPicker.visible = false
        $(window).off('click', colorPicker.hideHandler)
    }

    colorPicker.set = function ($ref, callback) {
        if (colorPicker.visible) {
            colorPicker.hide()
        }

        colorPicker.show()
        colorPicker.setCallback(callback)

        var referenceRect = $ref.getBoundingClientRect()
        var colorPickerRect = $colorPicker[0].getBoundingClientRect()

        $colorPicker.css('left', referenceRect.left - (colorPickerRect.width) + 'px')
        $colorPicker.css('top', referenceRect.top - (colorPickerRect.height / 2) + 'px')

        setTimeout(function () {
            $(window).on('click', colorPicker.hideHandler)
        }, 100)
    }

    return colorPicker
})
