define('two/builderQueue/ui', [
    'two/ui',
    'two/builderQueue',
    'two/utils',
    'two/ready',
    'two/Settings',
    'two/builderQueue/settings',
    'two/builderQueue/settings/map',
    'two/builderQueue/types/errors',
    'conf/buildingTypes',
    'two/EventScope',
    'queues/EventQueue',
    'helper/time'
], function (
    interfaceOverflow,
    builderQueue,
    utils,
    ready,
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    ERROR_CODES,
    BUILDING_TYPES,
    EventScope,
    eventQueue,
    timeHelper
) {
    var eventScope
    var $scope
    var textObject = 'builder_queue'
    var textObjectCommon = 'common'
    var $opener
    var groupList = modelDataService.getGroupList()
    var groups = []
    var buildingsLevelPoints = {}
    var running = false
    var gameDataBuildings
    var editorView = {
        sequencesAvail: true,
        modal: {}
    }
    var settings
    var settingsView = {
        sequencesAvail: true
    }
    var logsView = {}
    var TAB_TYPES = {
        SETTINGS: 'settings',
        SEQUENCES: 'sequences',
        LOGS: 'logs'
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

    /**
     * Calculate the total of points accumulated ultil the specified level.
     */
    var getLevelScale = function (factor, base, level) {
        return level ? parseInt(Math.round(factor * Math.pow(base, level - 1)), 10) : 0
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

    var parseBuildingSequence = function (sequence) {
        return sequence.map(function (item) {
            return item.building
        })
    }

    var createBuildingSequence = function (sequenceId, sequence) {
        var error = builderQueue.addBuildingSequence(sequenceId, sequence)

        switch (error) {
        case ERROR_CODES.SEQUENCE_EXISTS:
            utils.emitNotif('error', $filter('i18n')('error_sequence_exists', $rootScope.loc.ale, textObject))
            return false

            break
        case ERROR_CODES.SEQUENCE_INVALID:
            utils.emitNotif('error', $filter('i18n')('error_sequence_invalid', $rootScope.loc.ale, textObject))
            return false

            break
        }

        return true
    }

    var selectSome = function (obj) {
        for (var i in obj) {
            if (obj.hasOwnProperty(i)) {
                return i
            }
        }

        return false
    }

    settingsView.generateSequences = function () {
        var sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
        var sequencesAvail = Object.keys(sequences).length

        settingsView.sequencesAvail = sequencesAvail

        if (!sequencesAvail) {
            return false
        }

        settingsView.generateBuildingSequence()
        settingsView.generateBuildingSequenceFinal()
        settingsView.updateVisibleBuildingSequence()
    }

    settingsView.generateBuildingSequence = function () {
        var sequenceId = $scope.settings[SETTINGS.ACTIVE_SEQUENCE].value
        var buildingSequenceRaw = $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]
        var buildingData = modelDataService.getGameData().getBuildings()
        var buildingLevels = {}
        var building
        var level
        var state
        var price

        settingsView.sequencesAvail = !!buildingSequenceRaw

        if (!settingsView.sequencesAvail) {
            return false
        }

        for (building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        settingsView.buildingSequence = buildingSequenceRaw.map(function (building) {
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
                duration: timeHelper.readableSeconds(price.build_time),
                levelPoints: buildingsLevelPoints[building][level - 1],
                state: state
            }
        })
    }

    settingsView.generateBuildingSequenceFinal = function (_sequenceId) {
        var selectedSequence = $scope.settings[SETTINGS.ACTIVE_SEQUENCE].value
        var sequenceBuildings = $scope.settings[SETTINGS.BUILDING_SEQUENCES][_sequenceId || selectedSequence]
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

        settingsView.buildingSequenceFinal = sequence
    }

    settingsView.updateVisibleBuildingSequence = function () {
        var offset = $scope.pagination.buildingSequence.offset
        var limit = $scope.pagination.buildingSequence.limit

        settingsView.visibleBuildingSequence = settingsView.buildingSequence.slice(offset, offset + limit)
        $scope.pagination.buildingSequence.count = settingsView.buildingSequence.length
    }

    settingsView.generateBuildingsLevelPoints = function () {
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

    editorView.generateBuildingSequence = function () {
        var sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
        var sequencesAvail = Object.keys(sequences).length

        editorView.sequencesAvail = sequencesAvail

        if (!sequencesAvail) {
            return false
        }

        var sequenceId = editorView.selectedSequence.value
        var buildingSequenceRaw = sequences[sequenceId]
        var buildingLevels = {}
        var building

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

        editorView.updateVisibleBuildingSequence()
    }

    editorView.updateVisibleBuildingSequence = function () {
        var offset = $scope.pagination.buildingSequenceEditor.offset
        var limit = $scope.pagination.buildingSequenceEditor.limit

        editorView.visibleBuildingSequence = editorView.buildingSequence.slice(offset, offset + limit)
        $scope.pagination.buildingSequenceEditor.count = editorView.buildingSequence.length
    }

    editorView.updateBuildingSequence = function () {
        var selectedSequence = editorView.selectedSequence.value
        var parsedSequence = parseBuildingSequence(editorView.buildingSequence)
        var error = builderQueue.updateBuildingSequence(selectedSequence, parsedSequence)

        switch (error) {
        case ERROR_CODES.SEQUENCE_NO_EXISTS:
            utils.emitNotif('error', $filter('i18n')('error_sequence_no_exits', $rootScope.loc.ale, textObject))

            break
        case ERROR_CODES.SEQUENCE_INVALID:
            utils.emitNotif('error', $filter('i18n')('error_sequence_invalid', $rootScope.loc.ale, textObject))

            break
        }
    }

    editorView.modal.removeSequence = function () {
        var modalScope = $rootScope.$new()
        var textObject = 'builder_queue_remove_sequence_modal'

        modalScope.title = $filter('i18n')('title', $rootScope.loc.ale, textObject)
        modalScope.text = $filter('i18n')('text', $rootScope.loc.ale, textObject)
        modalScope.submitText = $filter('i18n')('remove', $rootScope.loc.ale, textObjectCommon)
        modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, textObjectCommon)

        modalScope.submit = function () {
            modalScope.closeWindow()
            builderQueue.removeSequence(editorView.selectedSequence.value)
        }

        modalScope.cancel = function () {
            modalScope.closeWindow()
        }

        windowManagerService.getModal('modal_attention', modalScope)
    }

    editorView.modal.addBuilding = function () {
        var modalScope = $rootScope.$new()
        var building

        modalScope.buildings = []
        modalScope.position = 1
        modalScope.indexLimit = editorView.buildingSequence.length + 1
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
        var selectedSequence = $scope.settings[SETTINGS.BUILDING_SEQUENCES][selectedSequenceName]
        
        modalScope.name = selectedSequenceName

        modalScope.submit = function () {
            if (modalScope.name.length < 3) {
                utils.emitNotif('error', $filter('i18n')('name_sequence_min_lenght', $rootScope.loc.ale, textObject))
                return false
            }

            if (createBuildingSequence(modalScope.name, selectedSequence)) {
                modalScope.closeWindow()
            }
        }

        windowManagerService.getModal('!twoverflow_builder_queue_name_sequence_modal', modalScope)
    }

    logsView.updateVisibleLogs = function () {
        var offset = $scope.pagination.logs.offset
        var limit = $scope.pagination.logs.limit

        logsView.visibleLogs = logsView.logs.slice(offset, offset + limit)
        $scope.pagination.logs.count = logsView.logs.length
    }

    logsView.clearLogs = function () {
        builderQueue.clearLogs()
    }

    var createFirstSequence = function () {
        var modalScope = $rootScope.$new()
        var initialSequence = [BUILDING_TYPES.HEADQUARTER]

        modalScope.name = ''
        
        modalScope.submit = function () {
            if (modalScope.name.length < 3) {
                utils.emitNotif('error', $filter('i18n')('name_sequence_min_lenght', $rootScope.loc.ale, textObject))
                return false
            }

            if (createBuildingSequence(modalScope.name, initialSequence)) {
                $scope.settings[SETTINGS.ACTIVE_SEQUENCE] = { name: modalScope.name, value: modalScope.name }
                $scope.settings[SETTINGS.BUILDING_SEQUENCES][modalScope.name] = initialSequence

                saveSettings()

                settingsView.selectedSequence = { name: modalScope.name, value: modalScope.name }
                editorView.selectedSequence = { name: modalScope.name, value: modalScope.name }

                settingsView.generateSequences()
                editorView.generateBuildingSequence()

                modalScope.closeWindow()
                selectTab(TAB_TYPES.SEQUENCES)
            }
        }

        windowManagerService.getModal('!twoverflow_builder_queue_name_sequence_modal', modalScope)
    }

    var selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    var saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))
    }

    var switchBuilder = function () {
        if (builderQueue.isRunning()) {
            builderQueue.stop()
        } else {
            builderQueue.start()
        }
    }

    var eventHandlers = {
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                type: 'groups',
                disabled: true
            })
        },
        updateSequences: function () {
            var sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
            
            $scope.sequences = Settings.encodeList(sequences, {
                type: 'keys',
                disabled: false
            })
        },
        generateBuildingSequences: function () {
            settingsView.generateSequences()
        },
        generateBuildingSequencesEditor: function () {
            editorView.generateBuildingSequence()
        },
        updateLogs: function () {
            $scope.logs = builderQueue.getLogs()
            logsView.updateVisibleLogs()
        },
        clearLogs: function () {
            utils.emitNotif('success', $filter('i18n')('logs_cleared', $rootScope.loc.ale, textObject))
            eventHandlers.updateLogs()
        },
        buildingSequenceUpdate: function (event, sequenceId) {
            var sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
            $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId] = sequences[sequenceId]

            if ($scope.settings[SETTINGS.ACTIVE_SEQUENCE].value === sequenceId) {
                settingsView.generateSequences()
            }

            utils.emitNotif('success', $filter('i18n')('sequence_updated', $rootScope.loc.ale, textObject, sequenceId))
        },
        buildingSequenceAdd: function (event, sequenceId) {
            var sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
            $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId] = sequences[sequenceId]
            eventHandlers.updateSequences()
            utils.emitNotif('success', $filter('i18n')('sequence_created', $rootScope.loc.ale, textObject, sequenceId))
        },
        buildingSequenceRemoved: function (event, sequenceId) {
            var substituteSequence

            delete $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]

            substituteSequence = selectSome($scope.settings[SETTINGS.BUILDING_SEQUENCES])
            editorView.selectedSequence = { name: substituteSequence, value: substituteSequence }
            eventHandlers.updateSequences()
            editorView.generateBuildingSequence()

            if (settings.get(SETTINGS.ACTIVE_SEQUENCE) === sequenceId) {
                settings.set(SETTINGS.ACTIVE_SEQUENCE, substituteSequence, {
                    quiet: true
                })
                settingsView.generateSequences()
            }

            utils.emitNotif('success', $filter('i18n')('sequence_removed', $rootScope.loc.ale, textObject, sequenceId))
        },
        saveSettings: function () {
            utils.emitNotif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, textObject))
        },
        started: function () {
            $scope.running = true
        },
        stopped: function () {
            $scope.running = false
        }
    }

    var init = function () {
        gameDataBuildings = modelDataService.getGameData().getBuildings()
        settingsView.generateBuildingsLevelPoints()
        settings = builderQueue.getSettings()

        $opener = interfaceOverflow.addMenuButton('Builder', 30)
        $opener.addEventListener('click', buildWindow)

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_START, function () {
            running = true
            $opener.classList.remove('btn-green')
            $opener.classList.add('btn-red')
            utils.emitNotif('success', $filter('i18n')('started', $rootScope.loc.ale, textObject))
        })

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_STOP, function () {
            running = false
            $opener.classList.remove('btn-red')
            $opener.classList.add('btn-green')
            utils.emitNotif('success', $filter('i18n')('stopped', $rootScope.loc.ale, textObject))
        })

        interfaceOverflow.addTemplate('twoverflow_builder_queue_window', `__builder_queue_html_main`)
        interfaceOverflow.addTemplate('twoverflow_builder_queue_add_building_modal', `__builder_queue_html_modal-add-building`)
        interfaceOverflow.addTemplate('twoverflow_builder_queue_name_sequence_modal', `__builder_queue_html_modal-name-sequence`)
        interfaceOverflow.addStyle('__builder_queue_css_style')
    }

    var buildWindow = function () {
        var activeSequence = settings.get(SETTINGS.ACTIVE_SEQUENCE)

        $scope = $rootScope.$new()
        $scope.textObject = textObject
        $scope.textObjectCommon = textObjectCommon
        $scope.selectedTab = TAB_TYPES.SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.SETTINGS = SETTINGS
        $scope.running = running
        $scope.pagination = {}

        $scope.editorView = editorView
        $scope.editorView.buildingSequence = {}
        $scope.editorView.visibleBuildingSequence = {}
        $scope.editorView.selectedSequence = { name: activeSequence, value: activeSequence }

        $scope.settingsView = settingsView
        $scope.settingsView.buildingSequence = {}
        $scope.settingsView.buildingSequenceFinal = {}

        $scope.logsView = logsView
        $scope.logsView.logs = builderQueue.getLogs()

        // methods
        $scope.selectTab = selectTab
        $scope.switchBuilder = switchBuilder
        $scope.saveSettings = saveSettings
        $scope.createFirstSequence = createFirstSequence
        $scope.openVillageInfo = windowDisplayService.openVillageInfo

        settings.injectScope($scope)
        eventHandlers.updateGroups()
        eventHandlers.updateSequences()

        $scope.pagination.buildingSequence = {
            count: settingsView.buildingSequence.length,
            offset: 0,
            loader: settingsView.updateVisibleBuildingSequence,
            limit: storageService.getPaginationLimit()
        }

        $scope.pagination.buildingSequenceEditor = {
            count: editorView.buildingSequence.length,
            offset: 0,
            loader: editorView.updateVisibleBuildingSequence,
            limit: storageService.getPaginationLimit()
        }

        $scope.pagination.logs = {
            count: logsView.logs.length,
            offset: 0,
            loader: logsView.updateVisibleLogs,
            limit: storageService.getPaginationLimit()
        }

        settingsView.generateSequences()
        editorView.generateBuildingSequence()

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
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS, eventHandlers.clearLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED, eventHandlers.buildingSequenceUpdate)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED, eventHandlers.buildingSequenceAdd)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED, eventHandlers.buildingSequenceRemoved)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_SETTINGS_CHANGE, eventHandlers.saveSettings)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_START, eventHandlers.started)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_STOP, eventHandlers.stopped)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_builder_queue_window', $scope)

        $scope.$watch('settings[SETTINGS.ACTIVE_SEQUENCE].value', function (newValue, oldValue) {
            if (newValue !== oldValue) {
                eventHandlers.generateBuildingSequences()
            }
        })

        $scope.$watch('editorView.selectedSequence.value', function (newValue, oldValue) {
            if (newValue !== oldValue) {
                eventHandlers.generateBuildingSequencesEditor()
            }
        })
    }

    return init
})
