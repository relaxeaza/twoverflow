define('two/ui/buttonLink', [
    'ejs'
], function (ejs) {
    /**
     * Cria um botão com icone e link.
     *
     * @param {String} type - Tipo do botão (character||village).
     * @param {String} text - Texto dentro do botão.
     * @param {Number} id - item id
     *
     * @return {Object}
     */
    return function (type, text, id) {
        var uid = Math.round(Math.random() * 1e5)
        var template = '<a id="l<#= uid #>" class="img-link icon-20x20-' +
            '<#= type #> btn btn-orange padded"><#= text #></a>'

        var html = ejs.render(template, {
            type: type,
            text: text,
            uid: uid
        })

        var elem = document.createElement('div')
        elem.innerHTML = html
        elem = elem.firstChild

        var handler

        switch (type) {
        case 'village':
            handler = function () {
                windowDisplayService.openVillageInfo(id)
            }

            break
        case 'character':
            handler = function () {
                windowDisplayService.openCharacterProfile(id)
            }

            break
        }

        elem.addEventListener('click', handler)

        return {
            html: html,
            id: 'l' + uid,
            elem: elem
        }
    }
})
