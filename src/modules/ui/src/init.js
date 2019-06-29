require([
    'two/ui'
], function (interfaceOverflow) {
    if (interfaceOverflow.isInitialized()) {
        return false
    }

    interfaceOverflow.init()
})
