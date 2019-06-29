define('two/about', [], function () {
    var initialized = false
    
    var about = {}

    about.isInitialized = function () {
        return initialized
    }

    about.init = function () {
        initialized = true
    }

    return about
})