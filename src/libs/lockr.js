/**
 * https://github.com/tsironis/lockr
 */
;(function(root, factory) {
    define('Lockr', factory(root, {}))
}(this, function(root, Lockr) {
    'use strict'

    Lockr.prefix = ''

    Lockr._getPrefixedKey = function(key, options) {
        options = options || {}

        if (options.noPrefix) {
            return key
        } else {
            return this.prefix + key
        }

    }

    Lockr.set = function(key, value, options) {
        var query_key = this._getPrefixedKey(key, options)

        try {
            localStorage.setItem(query_key, JSON.stringify({
                data: value
            }))
        } catch (e) {}
    }

    Lockr.get = function(key, missing, options) {
        var query_key = this._getPrefixedKey(key, options),
            value

        try {
            value = JSON.parse(localStorage.getItem(query_key))
        } catch (e) {
            if (localStorage[query_key]) {
                value = {
                    data: localStorage.getItem(query_key)
                }
            } else {
                value = null
            }
        }
        
        if (value === null) {
            return missing
        } else if (typeof value === 'object' && typeof value.data !== 'undefined') {
            return value.data
        } else {
            return missing
        }
    }

    return Lockr
}))
