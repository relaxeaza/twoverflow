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
    'two/builder/errorCodes',
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
    ERROR_CODES,
    EventScope
) {
    var eventScope
    var $scope
    var textObject = 'builder_queue'
    var textObjectCommon = 'common'
    var groupList = modelDataService.getGroupList()
    var groups = []
    var activeSequence = null
    var buildingsLevelPoints = {}
    var running = false
    var gameDataBuildings
    var editorView = {
        modal: {}
    }

    var TAB_TYPES = {
        SETTINGS: 'settings',
        SEQUENCES: 'sequences',
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

        settings[SETTINGS.BUILDING_SEQUENCE] = {
            name: settings[SETTINGS.BUILDING_SEQUENCE],
            value: settings[SETTINGS.BUILDING_SEQUENCE]
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

    var generateBuildingSequence = function (_sequenceId) {
        var sequenceId = _sequenceId || $scope.settings[SETTINGS.BUILDING_SEQUENCE].value
        var buildingSequenceRaw = $scope.settings[SETTINGS.BUILDING_ORDERS][sequenceId]
        var buildingData = modelDataService.getGameData().getBuildings()
        var buildingLevels = {}
        var building
        var level
        var state
        var price

        activeSequence = sequenceId

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

    var generateBuildingSequenceFinal = function (_sequenceId) {
        var selectedSequence = $scope.settings[SETTINGS.BUILDING_SEQUENCE].value
        var sequenceBuildings = $scope.settings[SETTINGS.BUILDING_ORDERS][_sequenceId || selectedSequence]
        var sequenceObj = {}
        var sequence = []
        var building

        for (building in gameDataBuildings) {
            sequenceObj[building] = {
                level: 0,
                order: gameDataBuildings[building].order
            }
        }

        sequenceBuildings.forEach(function (building) {
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

    var parseBuildingSequence = function (sequence) {
        return sequence.map(function (item) {
            return item.building
        })
    }

    var createBuildingSequence = function (sequenceId, sequence) {
        var error = builderQueue.addBuildingSequence(sequenceId, sequence)

        switch (error) {
        case ERROR_CODES.SEQUENCE_EXISTS:
            utils.emitNotif('error', $filter('i18n')('error_sequence_exits', $rootScope.loc.ale, textObject))
            return false

            break
        case ERROR_CODES.SEQUENCE_INVALID:
            utils.emitNotif('error', $filter('i18n')('error_sequence_invalid', $rootScope.loc.ale, textObject))
            return false

            break
        }

        return true
    }

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var saveSettings = function () {
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

    editorView.moveUp = function () {
        var copy = angular.copy(editorView.buildingSequence)
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

        editorView.buildingSequence = copy
        editorView.updateVisibleBuildingSequence()
    }

    editorView.moveDown = function () {
        var copy = angular.copy(editorView.buildingSequence)
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

        editorView.buildingSequence = copy
        editorView.updateVisibleBuildingSequence()
    }

    editorView.addBuilding = function (building, position) {
        var index = position - 1
        var newSequence = editorView.buildingSequence.slice()
        var updated

        newSequence.splice(index, 0, {
            level: null,
            building: building,
            checked: false
        })

        newSequence = editorView.updateLevels(newSequence, building)

        if (!newSequence) {
            return false
        }

        editorView.buildingSequence = newSequence
        editorView.updateVisibleBuildingSequence()

        return true
    }

    editorView.removeBuilding = function (index) {
        var building = editorView.buildingSequence[index].building

        editorView.buildingSequence.splice(index, 1)
        editorView.buildingSequence = editorView.updateLevels(editorView.buildingSequence, building)

        editorView.updateVisibleBuildingSequence()
    }

    editorView.updateLevels = function (sequence, building) {
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

    editorView.generateBuildingSequence = function (_sequenceId) {
        var sequenceId = _sequenceId || editorView.selectedSequence.value
        var buildingSequenceRaw = $scope.settings[SETTINGS.BUILDING_ORDERS][sequenceId]
        var buildingLevels = {}
        var building

        activeSequence = sequenceId

        for (building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        editorView.buildingSequence = buildingSequenceRaw.map(function (building) {
            return {
                level: ++buildingLevels[building],
                building: building,
                checked: false
            }
        })
    }

    editorView.updateVisibleBuildingSequence = function () {
        var offset = $scope.pagination.buildingSequenceEditor.offset
        var limit = $scope.pagination.buildingSequenceEditor.limit

        editorView.visibleBuildingSequence = editorView.buildingSequence.slice(offset, offset + limit)
        $scope.pagination.buildingSequenceEditor.count = editorView.buildingSequence.length
    }

    editorView.modal.addBuilding = function () {
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

            if (editorView.addBuilding(building, position)) {
                modalScope.closeWindow()
                utils.emitNotif('success', $filter('i18n')('add_building_success', $rootScope.loc.ale, textObject, buildingName, position))
            } else {
                utils.emitNotif('error', $filter('i18n')('add_building_limit_exceeded', $rootScope.loc.ale, textObject, buildingName, buildingLimit))
            }
        }

        windowManagerService.getModal('!twoverflow_builder_queue_add_building_modal', modalScope)
    }

    editorView.modal.nameSequence = function () {
        var modalScope = $rootScope.$new()
        var selectedSequenceName = editorView.selectedSequence.name
        var selectedSequence = $scope.settings[SETTINGS.BUILDING_ORDERS][selectedSequenceName]
        
        modalScope.name = selectedSequenceName

        modalScope.submit = function () {
            if (modalScope.name.length < 3) {
                utils.emitNotif('error', $filter('i18n')('name_sequence_min_lenght', $rootScope.loc.ale, textObject))
                return false
            }

            var success = createBuildingSequence(modalScope.name, selectedSequence)

            if (success) {
                modalScope.closeWindow()
            }
        }

        windowManagerService.getModal('!twoverflow_builder_queue_name_sequence_modal', modalScope)
    }

    var updateBuildingSequence = function () {
        var selectedSequence = editorView.selectedSequence.value
        var parsedSequence = parseBuildingSequence(editorView.buildingSequence)
        var error = builderQueue.updateBuildingOrder(selectedSequence, parsedSequence)

        switch (error) {
        case ERROR_CODES.SEQUENCE_NO_EXISTS:
            utils.emitNotif('error', $filter('i18n')('error_sequence_no_exits', $rootScope.loc.ale, textObject))

            break
        case ERROR_CODES.SEQUENCE_INVALID:
            utils.emitNotif('error', $filter('i18n')('error_sequence_invalid', $rootScope.loc.ale, textObject))

            break
        }
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
        updateSequences: function () {
            var sequenceList = []
            var sequences = $scope.settings[SETTINGS.BUILDING_ORDERS]
            var id

            for (id in sequences) {
                sequenceList.push({
                    name: id,
                    value: id
                })
            }

            $scope.sequenceList = sequenceList
        },
        generateBuildingSequences: function () {
            generateBuildingSequence()
            generateBuildingSequenceFinal()
            updateVisibleBuildingSequence()
        },
        generateBuildingSequencesEditor: function () {
            editorView.generateBuildingSequence()
            editorView.updateVisibleBuildingSequence()
        },
        updateLogs: function () {
            $scope.logs = builderQueue.getLogs()
        },
        buildingSequenceUpdate: function (event, sequenceId) {
            var settings = builderQueue.getSettings()

            $scope.settings[SETTINGS.BUILDING_ORDERS][sequenceId] = settings[SETTINGS.BUILDING_ORDERS][sequenceId]

            if (activeSequence === sequenceId) {
                generateBuildingSequence()
                generateBuildingSequenceFinal()
                updateVisibleBuildingSequence()
            }

            utils.emitNotif('success', $filter('i18n')('sequence_updated', $rootScope.loc.ale, textObject, sequenceId))
        },
        buildingSequenceAdd: function (event, sequenceId) {
            var settings = builderQueue.getSettings()
            
            $scope.settings[SETTINGS.BUILDING_ORDERS][sequenceId] = settings[SETTINGS.BUILDING_ORDERS][sequenceId]
            eventHandlers.updateSequences()
            utils.emitNotif('success', $filter('i18n')('sequence_created', $rootScope.loc.ale, textObject, sequenceId))
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
            utils.emitNotif('success', $filter('i18n')('started', $rootScope.loc.ale, textObject))
        })

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_STOP, function () {
            running = false
            opener.$elem.removeClass('btn-red').addClass('btn-green')
            utils.emitNotif('success', $filter('i18n')('stopped', $rootScope.loc.ale, textObject))
        })

        interfaceOverflow.addTemplate('twoverflow_builder_queue_window', `__builder_html_main`)
        interfaceOverflow.addTemplate('twoverflow_builder_queue_add_building_modal', `__builder_html_modal-add-building`)
        interfaceOverflow.addTemplate('twoverflow_builder_queue_name_sequence_modal', `__builder_html_modal-name-sequence`)
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
        $scope.settings = parseSettings(builderQueue.getSettings())
        $scope.logs = builderQueue.getLogs()
        $scope.villageGroups = []
        $scope.sequenceList = []
        
        $scope.pagination = {}

        // editor
        $scope.editorView = editorView
        $scope.editorView.buildingSequence = {}
        $scope.editorView.visibleBuildingSequence = {}
        $scope.editorView.selectedSequence = angular.copy($scope.settings[SETTINGS.BUILDING_SEQUENCE])

        // methods
        $scope.selectTab = selectTab
        $scope.switchBuilder = switchBuilder
        $scope.clearLogs = clearLogs
        $scope.saveSettings = saveSettings
        $scope.updateBuildingSequence = updateBuildingSequence

        eventHandlers.updateGroups()
        eventHandlers.updateSequences()
        generateBuildingsLevelPoints()
        generateBuildingSequence()
        editorView.generateBuildingSequence()
        generateBuildingSequenceFinal()

        $scope.pagination.buildingSequence = {
            count: $scope.buildingSequence.length,
            offset: 0,
            loader: updateVisibleBuildingSequence,
            limit: storageService.getPaginationLimit()
        }

        $scope.pagination.buildingSequenceEditor = {
            count: editorView.buildingSequence.length,
            offset: 0,
            loader: editorView.updateVisibleBuildingSequence,
            limit: storageService.getPaginationLimit()
        }

        updateVisibleBuildingSequence()
        editorView.updateVisibleBuildingSequence()

        $scope.$watch('settings[SETTINGS.BUILDING_SEQUENCE].value', eventHandlers.generateBuildingSequences)
        $scope.$watch('editorView.selectedSequence.value', eventHandlers.generateBuildingSequencesEditor)

        eventScope = new EventScope('twoverflow_builder_queue_window')
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.VILLAGE_SELECTED_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_UPGRADING, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_LEVEL_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_TEARING_DOWN, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.VILLAGE_BUILDING_QUEUE_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_JOB_STARTED, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_ORDERS_UPDATED, eventHandlers.buildingSequenceUpdate)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_ORDERS_ADDED, eventHandlers.buildingSequenceAdd)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_builder_queue_window', $scope)
    }

    return init
})
