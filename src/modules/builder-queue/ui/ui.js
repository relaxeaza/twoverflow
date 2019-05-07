define('two/builder/ui', [
    'two/builder',
    'two/ui2',
    'two/FrontButton',
    'queues/EventQueue',
    'two/utils',
    'conf/buildingTypes',
    'helper/time',
    'two/ready',
    'two/builder/settings',
    'two/builder/settingsMap',
    'two/EventScope'
], function (
    builderQueue,
    interfaceOverflow,
    FrontButton,
    eventQueue,
    utils,
    BUILDING_TYPES,
    $timeHelper,
    ready,
    SETTINGS,
    SETTINGS_MAP,
    EventScope
) {
    var eventScope
    var $scope
    var textObject = 'builder_queue'
    var textObjectCommon = 'common'
    var groupList = modelDataService.getGroupList()
    var groups = []
    var activePresetId = null
    var selectedEditPreset
    var buildingsLevelPoints = {}
    var running = false
    var gameDataBuildings

    var TAB_TYPES = {
        SETTINGS: 'settings',
        PRESETS: 'presets',
        LOGS: 'logs'
    }

    var parseSettings = function (rawSettings) {
        var settings = angular.copy(rawSettings)
        var selectedGroup = groups[settings[SETTINGS.GROUP_VILLAGES]]

        if (selectedGroup) {
            settings[SETTINGS.GROUP_VILLAGES] = {
                name: groups[settings[SETTINGS.GROUP_VILLAGES]].name,
                value: settings[SETTINGS.GROUP_VILLAGES]
            }
        } else {
            settings[SETTINGS.GROUP_VILLAGES] = {
                name: $filter('i18n')('disabled', $rootScope.loc.ale, textObjectCommon),
                value: false
            }
        }

        settings[SETTINGS.BUILDING_PRESET] = {
            name: settings[SETTINGS.BUILDING_PRESET],
            value: settings[SETTINGS.BUILDING_PRESET]
        }

        return settings
    }

    var buildingLevelReached = function (building, level) {
        var buildingData = modelDataService.getSelectedVillage().getBuildingData()
        return buildingData.getBuildingLevel(building) >= level
    }

    var buildingLevelProgress = function (building, level) {
        var queue = modelDataService.getSelectedVillage().getBuildingQueue().getQueue()
        var progress = false

        queue.some(function (job) {
            if (job.building === building && job.level === level) {
                return progress = true
            }
        })

        return progress
    }

    var generateBuildingSequence = function (_presetId) {
        var presetId = _presetId || $scope.settings[SETTINGS.BUILDING_PRESET].value
        var buildingSequenceRaw = $scope.settings[SETTINGS.BUILDING_ORDERS][presetId]
        var buildingData = modelDataService.getGameData().getBuildings()
        var buildingLevels = {}
        var building
        var level
        var state
        var price

        activePresetId = presetId

        for (building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        $scope.buildingSequence = buildingSequenceRaw.map(function (building) {
            level = ++buildingLevels[building]
            price = buildingData[building].individual_level_costs[level]
            state = 'not-reached'

            if (buildingLevelReached(building, level)) {
                state = 'reached'
            } else if (buildingLevelProgress(building, level)) {
                state = 'progress'
            }

            return {
                level: level,
                price: buildingData[building].individual_level_costs[level],
                building: building,
                duration: $timeHelper.readableSeconds(price.build_time),
                levelPoints: buildingsLevelPoints[building][level - 1],
                state: state
            }
        })
    }

    var generateBuildingSequenceEditor = function (_presetId) {
        var presetId = _presetId || $scope.selectedEditPreset.value
        var buildingSequenceRaw = $scope.settings[SETTINGS.BUILDING_ORDERS][presetId]
        var buildingLevels = {}
        var building

        activePresetId = presetId

        for (building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        $scope.buildingSequenceEditor = buildingSequenceRaw.map(function (building) {
            return {
                level: ++buildingLevels[building],
                building: building,
                checked: false
            }
        })
    }

    var updateBuildingSequenceEditorLevels = function (sequence, building) {
        var buildingLevel = 0
        var modifiedSequence = []
        var i
        var item
        var limitExceeded = false

        for (i = 0; i < sequence.length; i++) {
            item = sequence[i]

            if (item.building === building) {
                buildingLevel++

                if (buildingLevel > gameDataBuildings[building].max_level) {
                    limitExceeded = true
                    break
                }

                modifiedSequence.push({
                    level: buildingLevel,
                    building: building,
                    checked: false
                })
            } else {
                modifiedSequence.push(item)
            }
        }

        if (limitExceeded) {
            return false
        }

        return modifiedSequence
    }

    var generateBuildingSequenceFinal = function (_presetId) {
        var selectedPreset = $scope.settings[SETTINGS.BUILDING_PRESET].value
        var presetBuildings = $scope.settings[SETTINGS.BUILDING_ORDERS][_presetId || selectedPreset]
        var sequenceObj = {}
        var sequence = []
        var building

        for (building in gameDataBuildings) {
            sequenceObj[building] = {
                level: 0,
                order: gameDataBuildings[building].order
            }
        }

        presetBuildings.forEach(function (building) {
            sequenceObj[building].level++
        })

        for (building in sequenceObj) {
            if (sequenceObj[building].level !== 0) {
                sequence.push({
                    building: building,
                    level: sequenceObj[building].level,
                    order: sequenceObj[building].order
                })
            }
        }

        $scope.buildingSequenceFinal = sequence
    }

    /**
     * Calculate the total of points accumulated ultil the specified level.
     */
    var getLevelScale = function (factor, base, level) {
        return level ? parseInt(Math.round(factor * Math.pow(base, level - 1)), 10) : 0
    }

    var generateBuildingsLevelPoints = function () {
        var $gameData = modelDataService.getGameData()
        var buildingName
        var buildingData
        var buildingTotalPoints
        var levelPoints
        var currentLevelPoints
        var level

        for(buildingName in $gameData.data.buildings) {
            buildingData = $gameData.getBuildingDataForBuilding(buildingName)
            buildingTotalPoints = 0
            buildingsLevelPoints[buildingName] = []

            for (level = 1; level <= buildingData.max_level; level++) {
                currentLevelPoints  = getLevelScale(buildingData.points, buildingData.points_factor, level)
                levelPoints = currentLevelPoints - buildingTotalPoints
                buildingTotalPoints += levelPoints
                buildingsLevelPoints[buildingName].push(levelPoints)
            }
        }
    }

    var moveArrayItem = function (obj, oldIndex, newIndex) {
        if (newIndex >= obj.length) {
            var i = newIndex - obj.length + 1
            
            while (i--) {
                obj.push(undefined)
            }
        }

        obj.splice(newIndex, 0, obj.splice(oldIndex, 1)[0])
    }

    var updateVisibleBuildingSequence = function () {
        var offset = $scope.pagination.buildingSequence.offset
        var limit = $scope.pagination.buildingSequence.limit

        $scope.visibleBuildingSequence = $scope.buildingSequence.slice(offset, offset + limit)
        $scope.pagination.buildingSequence.count = $scope.buildingSequence.length
    }

    var updateVisibleBuildingSequenceEditor = function () {
        var offset = $scope.pagination.buildingSequenceEditor.offset
        var limit = $scope.pagination.buildingSequenceEditor.limit

        $scope.visibleBuildingSequenceEditor = $scope.buildingSequenceEditor.slice(offset, offset + limit)
        $scope.pagination.buildingSequenceEditor.count = $scope.buildingSequenceEditor.length
    }

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var saveSettings = function () {
        $scope.presetBuildings = $scope.settings[SETTINGS.BUILDING_ORDERS][SETTINGS.BUILDING_PRESET]
        builderQueue.updateSettings($scope.settings)
    }

    var switchBuilder = function () {
        if (builderQueue.isRunning()) {
            builderQueue.start()
        } else {
            builderQueue.stop()
        }
    }

    var clearLogs = function () {
        builderQueue.clearLogs()
    }

    var checkAll = function () {
        $scope.buildingSequenceEditor.forEach(function (item) {
            item.checked = $scope.checkAllValue
        })
    }

    var moveUp = function () {
        var copy = angular.copy($scope.buildingSequenceEditor)
        var index
        var item

        for (index = 0; index < copy.length; index++) {
            item = copy[index]

            if (!item.checked) {
                continue
            }

            if (index === 0) {
                continue
            }

            if (copy[index - 1].checked) {
                continue
            }

            if (copy[index - 1].building === item.building) {
                copy[index - 1].level++
                item.level--
            }

            moveArrayItem(copy, index, index - 1)
        }

        $scope.buildingSequenceEditor = copy
        updateVisibleBuildingSequenceEditor()
    }

    var moveDown = function () {
        var copy = angular.copy($scope.buildingSequenceEditor)
        var index
        var item

        for (index = copy.length - 1; index >= 0; index--) {
            item = copy[index]

            if (!item.checked) {
                continue
            }

            if (index === copy.length - 1) {
                continue
            }

            if (copy[index + 1].checked) {
                continue
            }

            if (copy[index + 1].building === item.building) {
                copy[index + 1].level--
                item.level++
            }

            moveArrayItem(copy, index, index + 1)
        }

        $scope.buildingSequenceEditor = copy
        updateVisibleBuildingSequenceEditor()
    }

    var addBuilding = function (building, position) {
        var index = position - 1
        var newSequence = $scope.buildingSequenceEditor.slice()
        var updated

        newSequence.splice(index, 0, {
            level: null,
            building: building,
            checked: false
        })

        newSequence = updateBuildingSequenceEditorLevels(newSequence, building)

        if (!newSequence) {
            return false
        }

        $scope.buildingSequenceEditor = newSequence
        updateVisibleBuildingSequenceEditor()

        return true
    }

    var openAddBuildingModal = function () {
        var modalScope = $rootScope.$new()
        var building

        modalScope.buildings = []
        modalScope.position = 1
        modalScope.buildingSequenceCount = $scope.buildingSequence.length
        modalScope.selectedBuilding = {
            name: $filter('i18n')(BUILDING_TYPES.HEADQUARTER, $rootScope.loc.ale, 'building_names'),
            value: BUILDING_TYPES.HEADQUARTER
        }

        for (building in gameDataBuildings) {
            modalScope.buildings.push({
                name: $filter('i18n')(building, $rootScope.loc.ale, 'building_names'),
                value: building
            })
        }

        modalScope.add = function () {
            var building = modalScope.selectedBuilding.value
            var position = modalScope.position
            var buildingName = $filter('i18n')(building, $rootScope.loc.ale, 'building_names')
            var buildingLimit = gameDataBuildings[building].max_level

            if (addBuilding(building, position)) {
                modalScope.closeWindow()
                utils.emitNotif('success', $filter('i18n')('add_building_success', $rootScope.loc.ale, textObject, buildingName, position))
            } else {
                utils.emitNotif('error', $filter('i18n')('add_building_limit_exceeded', $rootScope.loc.ale, textObject, buildingName, buildingLimit))
            }
        }

        windowManagerService.getModal('!twoverflow_builder_queue_add_building_modal', modalScope)
    }

    var removeBuildingEditor = function (index) {
        var building = $scope.buildingSequenceEditor[index].building

        $scope.buildingSequenceEditor.splice(index, 1)
        $scope.buildingSequenceEditor = updateBuildingSequenceEditorLevels($scope.buildingSequenceEditor, building)

        updateVisibleBuildingSequenceEditor()
    }

    var saveBuildingSequence = function () {

    }

    var eventHandlers = {
        updateGroups: function () {
            var id

            groups = utils.obj2selectOptions(groupList.getGroups(), true)

            $scope.villageGroups.push({
                name: $filter('i18n')('disabled', $rootScope.loc.ale, textObjectCommon),
                value: false
            })

            for (id in groups) {
                if (groups.hasOwnProperty(id)) {
                    $scope.villageGroups.push({
                        name: groups[id].name,
                        value: id,
                        leftIcon: groups[id].leftIcon
                    })
                }
            }
        },
        updatePresets: function () {
            var presetList = []
            var presets = $scope.settings[SETTINGS.BUILDING_ORDERS]
            var id

            for (id in presets) {
                presetList.push({
                    name: id,
                    value: id
                })
            }

            $scope.presetList = presetList
        },
        updateBuildingSequence: function () {
            generateBuildingSequence()
            generateBuildingSequenceFinal()
            updateVisibleBuildingSequence()
        },
        updateBuildingSequenceEditor: function () {
            generateBuildingSequenceEditor()
            updateVisibleBuildingSequenceEditor()
            $scope.checkAllValue = false
        },
        updateLogs: function () {
            $scope.logs = builderQueue.getLogs()
        },
        buildingSequenceUpdate: function (event, presetId) {
            if (activePresetId === presetId) {
                generateBuildingSequence()
                generateBuildingSequenceFinal()
            }

            utils.emitNotif('success', $filter('i18n')('preset.updated', $rootScope.loc.ale, textObject, presetId))
        },
        buildingSequenceAdd: function (event, presetId) {
            utils.emitNotif('success', $filter('i18n')('preset.added', $rootScope.loc.ale, textObject, presetId))
        }
    }

    var init = function () {
        gameDataBuildings = modelDataService.getGameData().getBuildings()

        var opener = new FrontButton('Builder', {
            classHover: false,
            classBlur: false,
            onClick: buildWindow
        })

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_START, function () {
            running = true
            opener.$elem.removeClass('btn-green').addClass('btn-red')
            utils.emitNotif('success', $filter('i18n')('general.started', $rootScope.loc.ale, textObject))
        })

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_STOP, function () {
            running = false
            opener.$elem.removeClass('btn-red').addClass('btn-green')
            utils.emitNotif('success', $filter('i18n')('general.stopped', $rootScope.loc.ale, textObject))
        })

        interfaceOverflow.addTemplate('twoverflow_builder_queue_window', `__builder_html_main`)
        interfaceOverflow.addTemplate('twoverflow_builder_queue_add_building_modal', `__builder_html_modal-add-building`)
        interfaceOverflow.addStyle('__builder_css_style')
    }

    var buildWindow = function () {
        $scope = window.$scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.selectedTab = TAB_TYPES.SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.SETTINGS = SETTINGS
        $scope.running = running
        $scope.buildingSequenceFinal = {}
        $scope.buildingSequence = {}
        $scope.buildingSequenceEditor = {}
        $scope.settings = parseSettings(builderQueue.getSettings())
        $scope.logs = builderQueue.getLogs()
        $scope.presetBuildings = $scope.settings[SETTINGS.BUILDING_ORDERS][SETTINGS.BUILDING_PRESET]
        $scope.villageGroups = []
        $scope.presetList = []
        $scope.selectedEditPreset = angular.copy($scope.settings[SETTINGS.BUILDING_PRESET])
        $scope.checkAllValue = false
        $scope.pagination = {}

        // methods
        $scope.selectTab = selectTab
        $scope.switchBuilder = switchBuilder
        $scope.clearLogs = clearLogs
        $scope.saveSettings = saveSettings
        $scope.moveUp = moveUp
        $scope.moveDown = moveDown
        $scope.openAddBuildingModal = openAddBuildingModal
        $scope.addBuilding = addBuilding
        $scope.saveBuildingSequence = saveBuildingSequence
        $scope.checkAll = checkAll
        $scope.removeBuildingEditor = removeBuildingEditor

        eventHandlers.updateGroups()
        eventHandlers.updatePresets()
        generateBuildingsLevelPoints()
        generateBuildingSequence()
        generateBuildingSequenceEditor()
        generateBuildingSequenceFinal()

        $scope.pagination.buildingSequence = {
            count: $scope.buildingSequence.length,
            offset: 0,
            loader: updateVisibleBuildingSequence,
            limit: storageService.getPaginationLimit()
        }

        $scope.pagination.buildingSequenceEditor = {
            count: $scope.buildingSequenceEditor.length,
            offset: 0,
            loader: updateVisibleBuildingSequenceEditor,
            limit: storageService.getPaginationLimit()
        }

        updateVisibleBuildingSequence()
        updateVisibleBuildingSequenceEditor()

        $scope.$watch('settings[SETTINGS.BUILDING_PRESET].value', eventHandlers.updateBuildingSequence)
        $scope.$watch('selectedEditPreset.value', eventHandlers.updateBuildingSequenceEditor)

        eventScope = new EventScope('twoverflow_builder_queue_window')
        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.VILLAGE_SELECTED_CHANGED, eventHandlers.updateBuildingSequence, true)
        eventScope.register(eventTypeProvider.BUILDING_UPGRADING, eventHandlers.updateBuildingSequence, true)
        eventScope.register(eventTypeProvider.BUILDING_LEVEL_CHANGED, eventHandlers.updateBuildingSequence, true)
        eventScope.register(eventTypeProvider.BUILDING_TEARING_DOWN, eventHandlers.updateBuildingSequence, true)
        eventScope.register(eventTypeProvider.VILLAGE_BUILDING_QUEUE_CHANGED, eventHandlers.updateBuildingSequence, true)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_JOB_STARTED, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_ORDERS_UPDATED, eventHandlers.buildingSequenceUpdate)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_ORDERS_ADDED, eventHandlers.buildingSequenceAdd)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_builder_queue_window', $scope)
    }

    return init
})
