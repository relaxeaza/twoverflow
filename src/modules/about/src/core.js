define('two/about', [], function () {
    let initialized = false

    let about = {}

    about.isInitialized = function () {
        return initialized
    }

    about.init = function () {
        initialized = true
    }

    return about
})
