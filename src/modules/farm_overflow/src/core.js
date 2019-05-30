define('two/farmOverflow', [
    'two/Settings',
    'two/farmOverflow/errorTypes',
    'two/farmOverflow/settings',
    'two/farmOverflow/settingsMap',
    'two/farmOverflow/settingsUpdate',
    'two/farmOverflow/logTypes',
    'two/mapData',
    'helper/math'
], function (
    Settings,
    ERROR_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    SETTINGS_UPDATE,
    LOG_TYPES,
    mapData,
    math
) {
    var $player = modelDataService.getSelectedCharacter()

    var farmOverflow = {}
    var Farmer
    var initialized = false
    var settings
    var farmers = window.farmers = {}
    var includedVillages = []

    var STORAGE_KEYS = {
        INDEXES: 'farm_overflow_indexes',
        LOGS: 'farm_overflow_logs',
        LAST_ATTACK: 'farm_overflow_last_attack',
        LAST_ACTIVITY: 'farm_overflow_last_activity',
        SETTINGS: 'farm_overflow_settings'
    }

    // return true = village filtered
    var targetFilters = [
        function ownPlayer (target) {
            return target.character_id === $player.getId()
        },
        function included (target) {
            return target.character_id && !includedVillages.includes(target.id)
        },
        function ignored (target) {
            return ignoredVillages.includes(target.id)
        },
        function distance (target, village) {
            var distance = math.actualDistance(village.getPosition(), {
                x: target.x,
                y: target.y
            })
            var minDistance = settings.getSetting(SETTINGS.MIN_DISTANCE)
            var maxDistance = settings.getSetting(SETTINGS.MAX_DISTANCE)

            return distance < minDistance || distance > maxDistance
        }
    ]

    var filterTargets = function (targets, village) {
        return targets.filter(function (target) {
            return targetFilters.every(function (fn) {
                return !fn(target, village)
            })
        })
    }

    var updateIncludedVillage = function () {
        var groupsInclude = settings.getSetting(SETTINGS.GROUP_INCLUDE)
        var groups

        includedVillages = []

        if (!groupsInclude.length) {
            return
        }

        groupsInclude.forEach(function (groupId) {
            groups = groupList.getGroupVillageIds(groupId)
            includedVillages = includedVillages.concat(groups)
        })
    }

    var updateIgnoredVillage = function () {
        var groupsIgnored = settings.getSetting(SETTINGS.GROUP_IGNORE)
        var groups

        ignoredVillages = []

        if (!groupsIgnored.length) {
            return
        }

        groupsIgnored.forEach(function (groupId) {
            groups = groupList.getGroupVillageIds(groupId)
            ignoredVillages = ignoredVillages.concat(groups)
        })
    }

    Farmer = (function () {
        var loadTargets = function (village, callback) {
            mapData.load(village.getX(), village.getY(), function (targets) {
                targets = filterTargets(targets, village)
                callback(targets)

                console.log('load targets ok', village.getId())
            })
        }

        var Farmer = function (villageId) {
            this.village = $player.getVillage(villageId)

            if (!this.village) {
                throw new Error('Village ' + villageId + ' does not exist.')
            }

            loadTargets(this.village, (targets) => {
                this.villages = targets
            })
        }

        return Farmer
    })()

    farmOverflow.start = function () {
        var villages = $player.getVillages()

        angular.forEach(villages, function (village, villageId) {
            farmers[villageId] = new Farmer(villageId)
        })

        console.log('ok')
    }

    farmOverflow.getSettings = function () {
        return settings
    }

    farmOverflow.isInitialized = function () {
        return initialized
    }

    farmOverflow.init = function () {
        initialized = true
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        updateIncludedVillage()
        updateIgnoredVillage()
    }

    return farmOverflow
})
