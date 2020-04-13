define('two/Settings', [
    'Lockr'
], function (
    Lockr
) {
    const hasOwn = Object.prototype.hasOwnProperty

    const generateDiff = function (before, after) {
        let changes = {}

        for (let id in before) {
            if (hasOwn.call(after, id)) {
                if (!angular.equals(before[id], after[id])) {
                    changes[id] = after[id]
                }
            } else {
                changes[id] = before[id]
            }
        }

        return angular.equals({}, changes) ? false : changes
    }

    const generateDefaults = function (map) {
        let defaults = {}

        for (let key in map) {
            defaults[key] = map[key].default
        }

        return defaults
    }

    const disabledOption = function () {
        return {
            name: $filter('i18n')('disabled', $rootScope.loc.ale, 'common'),
            value: false
        }
    }

    const getUpdates = function (map, changes) {
        let updates = {}

        for (let id in changes) {
            (map[id].updates || []).forEach(function (updateItem) {
                updates[updateItem] = true
            })
        }

        if (angular.equals(updates, {})) {
            return false
        }

        return updates
    }

    let Settings = function (configs) {
        this.settingsMap = configs.settingsMap
        this.storageKey = configs.storageKey
        this.defaults = generateDefaults(this.settingsMap)
        this.settings = angular.merge({}, this.defaults, Lockr.get(this.storageKey, {}))
        this.events = {
            settingsChange: noop
        }
        this.injected = false
    }

    Settings.prototype.get = function (id) {
        return this.settings[id]
    }

    Settings.prototype.getAll = function () {
        return this.settings
    }

    Settings.prototype.getDefault = function (id) {
        return hasOwn.call(this.defaults, id) ? this.defaults[id] : undefined
    }

    Settings.prototype.store = function () {
        Lockr.set(this.storageKey, this.settings)
    }

    Settings.prototype.set = function (id, value, opt) {
        if (!hasOwn.call(this.settingsMap, id)) {
            return false
        }

        const before = angular.copy(this.settings)
        this.settings[id] = value
        const after = angular.copy(this.settings)
        const changes = generateDiff(before, after)

        if (!changes) {
            return false
        }

        const updates = getUpdates(this.settingsMap, changes)

        this.store()
        this.updateScope()
        this.events.settingsChange(changes, updates, opt || {})

        return true
    }

    Settings.prototype.setAll = function (values, opt) {
        const before = angular.copy(this.settings)

        for (let id in values) {
            if (hasOwn.call(this.settingsMap, id)) {
                this.settings[id] = values[id]
            }
        }

        const after = angular.copy(this.settings)
        const changes = generateDiff(before, after)

        if (!changes) {
            return false
        }

        const updates = getUpdates(this.settingsMap, changes)

        this.store()
        this.updateScope()
        this.events.settingsChange(changes, updates, opt || {})

        return true
    }

    Settings.prototype.reset = function (id, opt) {
        this.set(id, this.defaults[id], opt)

        return true
    }

    Settings.prototype.resetAll = function (opt) {
        this.setAll(angular.copy(this.defaults), opt)

        return true
    }

    Settings.prototype.each = function (callback) {
        for (let id in this.settings) {
            let map = this.settingsMap[id]

            if (map.inputType === 'checkbox') {
                callback.call(this, id, !!this.settings[id], map)
            } else {
                callback.call(this, id, this.settings[id], map)
            }
        }
    }

    Settings.prototype.onChange = function (callback) {
        if (typeof callback === 'function') {
            this.events.settingsChange = callback
        }
    }

    Settings.prototype.injectScope = function ($scope, opt) {
        this.injected = {
            $scope: $scope,
            opt: opt
        }

        $scope.settings = this.encode(opt)

        angular.forEach(this.settingsMap, function (map, id) {
            if (map.inputType === 'select') {
                $scope.$watch(function () {
                    return $scope.settings[id]
                }, function (value) {
                    if (map.multiSelect) {
                        if (!value.length) {
                            $scope.settings[id] = [disabledOption()]
                        }
                    } else if (!value) {
                        $scope.settings[id] = disabledOption()
                    }
                }, true)
            }
        })
    }

    Settings.prototype.updateScope = function () {
        if (!this.injected) {
            return false
        }

        this.injected.$scope.settings = this.encode(this.injected.opt)
    }

    Settings.prototype.encode = function (opt) {
        let encoded = {}
        const presets = modelDataService.getPresetList().getPresets()
        const groups = modelDataService.getGroupList().getGroups()

        opt = opt || {}

        this.each(function (id, value, map) {
            if (map.inputType === 'select') {
                if (!value && map.disabledOption) {
                    encoded[id] = map.multiSelect ? [disabledOption()] : disabledOption()
                    return
                }

                switch (map.type) {
                case 'presets':
                    if (map.multiSelect) {
                        let multiValues = []

                        value.forEach(function (presetId) {
                            if (!presets[presetId]) {
                                return
                            }

                            multiValues.push({
                                name: presets[presetId].name,
                                value: presetId
                            })
                        })

                        encoded[id] = multiValues.length ? multiValues : [disabledOption()]
                    } else {
                        if (!presets[value] && map.disabledOption) {
                            encoded[id] = disabledOption()
                            return
                        }

                        encoded[id] = {
                            name: presets[value].name,
                            value: value
                        }
                    }

                    break
                case 'groups':
                    if (map.multiSelect) {
                        let multiValues = []

                        value.forEach(function (groupId) {
                            if (!groups[groupId]) {
                                return
                            }

                            multiValues.push({
                                name: groups[groupId].name,
                                value: groupId,
                                leftIcon: groups[groupId].icon
                            })
                        })

                        encoded[id] = multiValues.length ? multiValues : [disabledOption()]
                    } else {
                        if (!groups[value] && map.disabledOption) {
                            encoded[id] = disabledOption()
                            return
                        }

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

                    if (opt.multiSelect) {
                        encoded[id] = [encoded[id]]
                    }

                    break
                }
            } else {
                encoded[id] = value
            }
        })

        return encoded
    }

    Settings.prototype.decode = function (encoded) {
        let decoded = {}

        for (let id in encoded) {
            let map = this.settingsMap[id]

            if (map.inputType === 'select') {
                if (map.multiSelect) {
                    if (encoded[id].length === 1 && encoded[id][0].value === false) {
                        decoded[id] = []
                    } else {
                        let multiValues = []

                        encoded[id].forEach(function (item) {
                            multiValues.push(item.value)
                        })

                        decoded[id] = multiValues
                    }
                } else {
                    decoded[id] = encoded[id].value
                }
            } else {
                decoded[id] = encoded[id]
            }
        }

        return decoded
    }

    Settings.encodeList = function (list, opt) {
        let encoded = []

        opt = opt || {}

        if (opt.disabled) {
            encoded.push(disabledOption())
        }

        switch (opt.type) {
        case 'keys':
            for (let prop in list) {
                encoded.push({
                    name: prop,
                    value: prop
                })
            }

            break
        case 'groups':
            for (let prop in list) {
                let value = list[prop]

                encoded.push({
                    name: value.name,
                    value: value.id,
                    leftIcon: value.icon
                })
            }

            break
        case 'presets':
            for (let prop in list) {
                let value = list[prop]

                encoded.push({
                    name: value.name,
                    value: value.id
                })
            }

            break
        case 'values':
        default:
            for (let prop in list) {
                let value = list[prop]

                encoded.push({
                    name: opt.textObject ? $filter('i18n')(value, $rootScope.loc.ale, opt.textObject) : value,
                    value: value
                })
            }
        }

        return encoded
    }

    Settings.disabledOption = disabledOption

    return Settings
})
