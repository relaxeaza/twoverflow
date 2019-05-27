define('two/Settings', [
    'Lockr'
], function (
    Lockr
) {
    var textObjectCommon = 'common'
    var noop = function () {}
    var hasOwn = Object.prototype.hasOwnProperty

    var generateDiff = function (before, after) {
        var changes = {}
        var id

        for (id in before) {
            if (hasOwn.call(after, id)) {
                if (!angular.equals(before[id], after[id])) {
                    changes[id] = after[id]
                }
            } else {
                changes[id] = before[id]
            }
        }

        return changes
    }

    var generateDefaults = function (map) {
        var key
        var defaults = {}

        for (key in map) {
            defaults[key] = map[key].default
        }

        return defaults
    }

    var disabledOption = function () {
        return {
            name: $filter('i18n')('disabled', $rootScope.loc.ale, textObjectCommon),
            value: false
        }
    }

    var Settings = function (configs) {
        this.settingsMap = configs.settingsMap
        this.storageKey = configs.storageKey
        this.defaults = generateDefaults(this.settingsMap)
        this.settings = Lockr.get(this.storageKey, this.defaults, true)
        this.events = {
            settingsChange: noop
        }
    }

    Settings.prototype.getSetting = function (id) {
        return this.settings[id]
    }

    Settings.prototype.getSettings = function () {
        return this.settings
    }

    Settings.prototype.getDefault = function (id) {
        return hasOwn.call(this.defaults, id) ? this.defaults[id] : undefined
    }

    Settings.prototype.store = function () {
        Lockr.set(this.storageKey, this.settings)
    }

    Settings.prototype.setSetting = function (id, value) {
        var changes
        var before
        var after
        var update = false

        if (hasOwn.call(this.settingsMap, id)) {
            before = angular.copy(this.settings)
            this.settings[id] = value
            after = angular.copy(this.settings)
            changes = generateDiff(before, after)

            if (this.settingsMap[id].update) {
                update = true
            }

            this.store()
            this.events.settingsChange(changes, update)

            return true
        }

        return false
    }

    Settings.prototype.setSettings = function (values) {
        var changes
        var before = angular.copy(this.settings)
        var after
        var update = false
        var id

        for (id in values) {
            if (hasOwn.call(this.settingsMap, id)) {
                this.settings[id] = values[id]

                if (!update && this.settingsMap[id].update) {
                    update = true
                }
            }
        }

        after = angular.copy(this.settings)
        changes = generateDiff(before, after)

        this.store()
        this.events.settingsChange(changes, update)

        return true
    }

    Settings.prototype.resetSetting = function (id) {
        this.setSetting(id, this.defaults[id])

        return true
    }

    Settings.prototype.resetSettings = function () {
        this.setSettings(angular.copy(this.defaults))

        return true
    }

    Settings.prototype.eachSetting = function (callback) {
        var id
        var value
        var type

        for (id in this.settings) {
            type = this.settingsMap[id].inputType

            if (type === 'checkbox') {
                callback.call(this, id, !!this.settings[id], type)
            } else {
                callback.call(this, id, this.settings[id], type)
            }
        }
    }

    Settings.prototype.onSettingsChange = function (callback) {
        if (typeof callback === 'function') {
            this.events.settingsChange = callback
        }
    }

    Settings.prototype.encodeSettings = function (opt) {
        var encoded = {}
        var groupList = modelDataService.getGroupList()
        var groups

        opt = opt || {}

        this.eachSetting(function (id, value, type) {
            if (type === 'select') {
                if (this.settingsMap[id].disabledOption && !value) {
                    encoded[id] = disabledOption()
                } else {
                    switch (this.settingsMap[id].type) {
                    case 'groups':
                        groups = groupList.getGroups()

                        if (!groups[value] && this.settingsMap[id].disabledOption) {
                            encoded[id] = disabledOption()
                        } else {
                            encoded[id] = {
                                name: groups[value].name,
                                value: value
                            }
                        }

                        break
                    default:
                        encoded[id] = {
                            name: opt.textObject ? $filter('i18n')(value, $rootScope.loc.ale, opt.textObject) : value,
                            value: value
                        }

                        break
                    }
                }
            } else {
                encoded[id] = value
            }
        })

        return encoded
    }

    Settings.prototype.decodeSettings = function (encoded) {
        var id
        var decoded = {}

        for (id in encoded) {
            if (this.settingsMap[id].inputType === 'select') {
                decoded[id] = encoded[id].value
            } else {
                decoded[id] = encoded[id]
            }
        }

        return decoded
    }

    Settings.encodeList = function (list, opt) {
        var encoded = []
        var prop
        var value

        opt = opt || {}

        if (opt.disabled) {
            encoded.push(disabledOption())
        }

        if (opt.type) {
            switch (opt.type) {
            case 'keys':
                for (prop in list) {
                    value = list[prop]

                    encoded.push({
                        name: prop,
                        value: prop
                    })
                }

                break
            case 'groups':
                for (prop in list) {
                    value = list[prop]

                    encoded.push({
                        name: value.name,
                        value: value.id,
                        icon: value.icon
                    })
                }

                break
            default:
                for (prop in list) {
                    value = list[prop]

                    encoded.push({
                        name: opt.textObject ? $filter('i18n')(value, $rootScope.loc.ale, opt.textObject) : value,
                        value: value
                    })
                }
            }
        }

        return encoded
    }

    Settings.disabledOption = disabledOption

    return Settings
})
