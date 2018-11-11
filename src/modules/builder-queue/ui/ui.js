define('two/builder/ui', [
    'two/builder',
    'two/locale',
    'two/ui',
    'two/FrontButton',
    'two/eventQueue',
    'two/utils',
    'ejs',
    'conf/buildingTypes',
    'helper/time',
    'two/ready'
], function (
    Builder,
    Locale,
    Interface,
    FrontButton,
    eventQueue,
    utils,
    ejs,
    BUILDING_TYPES,
    $timeHelper,
    ready
) {
    var ui
    var opener
    var groups
    var $window
    var $buildingOrder
    var $groupVillages
    var $buildingPresets
    var $settings
    var $save
    var $switch
    var $buildLog
    var $noBuilds
    var $clearLogs
    var disabled
    var buildingsLevelPoints = {}
    var activePresetId = null
    var ordenedBuildings = [
        BUILDING_TYPES.HEADQUARTER,
        BUILDING_TYPES.TIMBER_CAMP,
        BUILDING_TYPES.CLAY_PIT,
        BUILDING_TYPES.IRON_MINE,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.WAREHOUSE,
        BUILDING_TYPES.CHURCH,
        BUILDING_TYPES.CHAPEL,
        BUILDING_TYPES.RALLY_POINT,
        BUILDING_TYPES.BARRACKS,
        BUILDING_TYPES.STATUE,
        BUILDING_TYPES.HOSPITAL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.MARKET,
        BUILDING_TYPES.TAVERN,
        BUILDING_TYPES.ACADEMY,
        BUILDING_TYPES.PRECEPTORY
    ]

    var editorActivePreset = null
    var $editorSelectPreset
    var $editorSelectedPreset
    var $editorSelectedPresetOrder
    var $editorMoveUp
    var $editorMoveDown
    var $editorAddBuilding
    var $editorSave

    var init = function () {
        groups = modelDataService.getGroupList().getGroups()
        disabled = Locale('builder', 'general.disabled')

        ui = new Interface('BuilderQueue', {
            activeTab: 'settings',
            template: '__builder_html_window',
            replaces: {
                locale: Locale,
                version: '__builder_version'
            },
            css: '__builder_css_style'
        })

        opener = new FrontButton('Builder', {
            classHover: false,
            classBlur: false,
            onClick: function () {
                ui.openWindow()
                updateReachedLevelItems()
            }
        })

        buildingsLevelPoints = getBuildingsLevelPoints()

        $window = $(ui.$window)
        $buildingOrder = $window.find('.buildingOrder')
        $buildingOrderFinal = $window.find('.buildingOrderFinal')
        $groupVillages = $window.find('.groupVillages')
        $buildingPresets = $window.find('.buildingPreset')
        $settings = $window.find('.settings')
        $save = $window.find('.save')
        $switch = $window.find('.switch')
        $buildLog = $window.find('.buildLog')
        $noBuilds = $window.find('.noBuilds')
        $clearLogs = $window.find('.clearLogs')

        $editorSelectPreset = $window.find('.select-preset')
        $editorSelectedPreset = $window.find('.selected-preset')
        $editorSelectedPresetOrder = $window.find('.selected-preset-order')
        $editorMoveUp = $window.find('.move-up')
        $editorMoveDown = $window.find('.move-down')
        $editorAddBuilding = $window.find('.add-building')
        $editorSave = $window.find('.editor-save')

        populateSettings()
        updateGroupVillages()
        updateBuildingPresets()
        updateEditorPresets()
        populateLog()
        bindEvents()

        return ui
    }

    var moveArrayIndex = function (arr, from, to) {
        arr.splice(to, 0, arr.splice(from, 1)[0])
    }

    var bindEvents = function () {
        $editorMoveUp.on('click', function () {
            if (!editorActivePreset) {
                return false
            }

            var selectedItems = getSelectedPresetItems()
            var newSelectedItems = []
            var newIndex

            selectedItems.forEach(function (index) {
                if (index === 0) {
                    return false
                }

                newIndex = index - 1
                newSelectedItems.push(newIndex)
                moveArrayIndex(editorActivePreset.value, index, newIndex)
            })

            populateEditorPresetOrder()
            editorSelectPresetItems(newSelectedItems)
        })

        $editorMoveDown.on('click', function () {
            if (!editorActivePreset) {
                return false
            }

            var selectedItems = getSelectedPresetItems()
            var newSelectedItems = []
            var newIndex

            selectedItems.reverse().forEach(function (index) {
                if (index === editorActivePreset.value.length - 1) {
                    return false
                }

                newIndex = index + 1
                newSelectedItems.push(newIndex)
                moveArrayIndex(editorActivePreset.value, index, newIndex)

            })

            populateEditorPresetOrder()
            editorSelectPresetItems(newSelectedItems)
        })

        $editorSave.on('click', function () {
            if (!editorActivePreset) {
                return false
            }

            Builder.updateBuildingOrder(
                editorActivePreset.id,
                editorActivePreset.value
            )
        })

        $buildingPresets.on('selectSelected', function () {
            populateBuildingOrder(this.dataset.value)
            populateBuildingOrderFinal(this.dataset.value)
            updateReachedLevelItems()
        })

        $editorSelectPreset.on('selectSelected', function () {
            populateEditorPresetOrder(this.dataset.value)
        })

        $save.on('click', function (event) {
            saveSettings()
        })

        $switch.on('click', function (event) {
            if (Builder.isRunning()) {
                Builder.stop()
            } else {
                Builder.start()
            }
        })

        $clearLogs.on('click', function (event) {
            Builder.clearLogs()
        })

        eventQueue.bind('Builder/start', function () {
            $switch.html(Locale('common', 'stop'))
            $switch.removeClass('btn-green').addClass('btn-red')
            opener.$elem.removeClass('btn-green').addClass('btn-red')
            utils.emitNotif('success', Locale('builder', 'general.started'))
        })

        eventQueue.bind('Builder/stop', function () {
            $switch.html(Locale('common', 'start'))
            $switch.removeClass('btn-red').addClass('btn-green')
            opener.$elem.removeClass('btn-red').addClass('btn-green')
            utils.emitNotif('success', Locale('builder', 'general.stopped'))
        })

        eventQueue.bind('Builder/jobStarted', insertLog)
        eventQueue.bind('Builder/clearLogs', clearLogs)

        eventQueue.bind('Builder/buildingOrders/updated', function (presetId) {
            if (activePresetId === presetId) {
                populateBuildingOrder()
                populateBuildingOrderFinal()
                updateReachedLevelItems()
            }

            utils.emitNotif('success', Locale('builder', 'preset.updated', {
                presetId: presetId
            }))
        })

        eventQueue.bind('Builder/buildingOrders/added', function (presetId) {
            utils.emitNotif('success', Locale('builder', 'preset.added', {
                presetId: presetId
            }))
        })

        rootScope.$on(eventTypeProvider.GROUPS_UPDATED, function () {
            updateGroupVillages()
        })

        rootScope.$on(eventTypeProvider.VILLAGE_SELECTED_CHANGED, function () {
            if (ui.isVisible()) {
                updateReachedLevelItems()
            }
        })

        rootScope.$on(eventTypeProvider.BUILDING_UPGRADING, updateLevels)
        rootScope.$on(eventTypeProvider.BUILDING_LEVEL_CHANGED, updateLevels)
        rootScope.$on(eventTypeProvider.BUILDING_TEARING_DOWN, updateLevels)
        rootScope.$on(eventTypeProvider.VILLAGE_BUILDING_QUEUE_CHANGED, updateLevels)
    }

    /**
     * Update/populate the list of building presets on settings tab.
     */
    var updateBuildingPresets = function updateBuildingPresets () {
        var $selectedOption = $buildingPresets.find('.custom-select-handler').html('')
        var $data = $buildingPresets.find('.custom-select-data').html('')
        var settings = Builder.getSettings()

        for (var presetName in settings.buildingOrders) {
            var selected = settings.buildingPreset == presetName

            if (selected) {
                $selectedOption.html(presetName)
                $buildingPresets[0].dataset.name = presetName
                $buildingPresets[0].dataset.value = presetName
            }

            appendSelectData($data, {
                name: presetName,
                value: presetName
            })

            $buildingPresets.append($data)
        }
    }

    /**
     * Update/populate the list of building presets on presets tab.
     */
    var updateEditorPresets = function updateEditorPresets () {
        var $selectedOption = $editorSelectPreset.find('.custom-select-handler').html('')
        var $data = $editorSelectPreset.find('.custom-select-data').html('')
        var presetName
        var settings = Builder.getSettings()
        var presetsText = Locale('builder', 'presets.presets')

        // Create a first, non-value option.
        appendSelectData($data, {
            name: presetsText,
            value: 0
        })
        $selectedOption.html(presetsText)

        for (presetName in settings.buildingOrders) {
            appendSelectData($data, {
                name: presetName,
                value: presetName
            })

            $editorSelectPreset.append($data)
        }
    }

    /**
     * Update/populate the list of groups on settings tab.
     */
    var updateGroupVillages = function updateGroupVillages () {
        var $selectedOption = $groupVillages.find('.custom-select-handler').html('')
        var $data = $groupVillages.find('.custom-select-data').html('')
        var settings = Builder.getSettings()

        appendDisabledOption($data, '')

        for (var id in groups) {
            var name = groups[id].name
            var selected = settings.groupVillages == id

            if (settings.groupVillages === '') {
                $selectedOption.html(disabled)
                $groupVillages[0].dataset.name = disabled
                $groupVillages[0].dataset.value = ''
            } else if (settings.groupVillages == id) {
                $selectedOption.html(name)
                $groupVillages[0].dataset.name = name
                $groupVillages[0].dataset.value = id
            }

            appendSelectData($data, {
                name: name,
                value: id,
                icon: groups[id].icon
            })

            $groupVillages.append($data)
        }

        if (!settings.groupVillages) {
            $selectedOption.html(disabled)
        }
    }

    /**
     * Gera uma opção "desativada" padrão em um custom-select
     *
     * @param  {jqLite} $data - Elemento que armazenada o <span> com dataset.
     * @param {String=} _disabledValue - Valor da opção "desativada".
     */
    var appendDisabledOption = function appendDisabledOption ($data, _disabledValue) {
        var dataElem = document.createElement('span')
        dataElem.dataset.name = disabled
        dataElem.dataset.value = _disabledValue || ''

        $data.append(dataElem)
    }

    /**
     * Popula o dataset um elemento <span>
     *
     * @param  {jqLite} $data - Elemento que armazenada o <span> com dataset.
     * @param  {[type]} data - Dados a serem adicionados no dataset.
     */
    var appendSelectData = function appendSelectData ($data, data) {
        var dataElem = document.createElement('span')

        for (var key in data) {
            dataElem.dataset[key] = data[key]
        }

        $data.append(dataElem)
    }

    /**
     * Loop em todas configurações do BuilderQueue
     *
     * @param {Function} callback
     */
    var eachSetting = function eachSetting (callback) {
        $window.find('[data-setting]').forEach(function ($input) {
            var settingId = $input.dataset.setting

            callback($input, settingId)
        })
    }

    var saveSettings = function saveSettings () {
        var newSettings = {}

        eachSetting(function ($input, settingId) {
            var inputType = Builder.settingsMap[settingId].inputType

            switch (inputType) {
            case 'text':
                newSettings[settingId] = $input.type === 'number'
                    ? parseInt($input.value, 10)
                    : $input.value

                break
            case 'select':
                newSettings[settingId] = $input.dataset.value

                break
            case 'checkbox':
                newSettings[settingId] = $input.checked

                break
            }
        })

        if (Builder.updateSettings(newSettings)) {
            utils.emitNotif('success', Locale('builder', 'settings.saved'))

            return true
        }

        return false
    }

    /**
     * Insere as configurações na interface.
     */
    var populateSettings = function populateSettings () {
        var settings = Builder.getSettings()

        eachSetting(function ($input, settingId) {
            var inputType = Builder.settingsMap[settingId].inputType

            switch (inputType) {
            case 'text':
                $input.value = settings[settingId]

                break
            case 'select':
                $input.dataset.value = settings[settingId]

                break
            case 'checkbox':
                if (settings[settingId]) {
                    $input.checked = true
                    $input.parentElement.classList.add('icon-26x26-checkbox-checked')
                }

                break
            }
        })

        ready(function () {
            populateBuildingOrder()
            populateBuildingOrderFinal()
            updateReachedLevelItems()
        }, ['initial_village'])
    }

    /**
     * @param {String=} _presetId Use a specific building order preset
     *   instead of the selected one.
     */
    var populateBuildingOrder = function populateBuildingOrder (_presetId) {
        var buildingOrder = {}
        var settings = Builder.getSettings()

        _presetId = _presetId || settings.buildingPreset
        activePresetId = _presetId

        var presetBuildings = settings.buildingOrders[_presetId]
        var buildingData = modelDataService.getGameData().getBuildings()

        for (var buildingName in BUILDING_TYPES) {
            buildingOrder[BUILDING_TYPES[buildingName]] = 0
        }

        $buildingOrder.html('')

        presetBuildings.forEach(function (building) {
            var level = ++buildingOrder[building]
            var $item = document.createElement('tr')
            var price = buildingData[building].individual_level_costs[level]
            
            $item.innerHTML = ejs.render('__builder_html_order-item', {
                locale: Locale,
                building: building,
                level: level,
                duration: $timeHelper.readableSeconds(price.build_time),
                wood: price.wood,
                clay: price.clay,
                iron: price.iron,
                levelPoints: buildingsLevelPoints[building][level - 1]
            })

            $item.dataset.building = building
            $item.dataset.level = level

            $buildingOrder.append($item)
        })

        ui.recalcScrollbar()
    }

    /**
     * @param {String=} preset Use a specific building order preset
     *   instead of the selected one.
     */
    var populateBuildingOrderFinal = function populateBuildingOrderFinal (_preset) {
        var buildingOrderFinal = {}
        var settings = Builder.getSettings()
        var presetBuildings = settings.buildingOrders[_preset || settings.buildingPreset]        

        $buildingOrderFinal.html('')

        presetBuildings.forEach(function (building) {
            buildingOrderFinal[building] = buildingOrderFinal[building] || 0
            ++buildingOrderFinal[building]
        })

        ordenedBuildings.forEach(function (building) {
            if (building in buildingOrderFinal) {
                var $item = document.createElement('tr')
                var level = buildingOrderFinal[building]
            
                $item.innerHTML = ejs.render('__builder_html_order-item-final', {
                    locale: Locale,
                    building: building,
                    level: level
                })

                $item.dataset.building = building
                $item.dataset.level = level

                $buildingOrderFinal.append($item)
            }
        })

        ui.recalcScrollbar()
    }

    /**
     * Check if the level building was already reached in the current selected village.
     *
     * @param {String} building Building name to check
     * @param {Number} level Level of the building
     * @return {Boolean}
     */
    var buildingLevelReached = function (building, level) {
        var buildingData = modelDataService.getSelectedVillage().getBuildingData()
        return buildingData.getBuildingLevel(building) >= level
    }

    /**
     * Check if the building is currently in build progress on the current selected village.
     *
     * @param {String} building Building name to check
     * @param {Number} level Level of the building
     * @return {Boolean}
     */
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
     * Update the building reached level element states.
     */
    var updateReachedLevelItems = function () {
        $buildingOrder.find('tr').forEach(function ($item) {
            var building = $item.dataset.building
            var level = parseInt($item.dataset.level, 10)
            var _class = ''
            
            if (buildingLevelReached(building, level)) {
                _class = 'reached'
            } else if (buildingLevelProgress(building, level)) {
                _class = 'progress'
            }

            $item.className = _class
        })

        $buildingOrderFinal.find('tr').forEach(function ($item) {
            var reached = buildingLevelReached($item.dataset.building, $item.dataset.level)
            $item.className = reached ? 'reached' : ''
        })
    }

    /**
     * Update the reached building levels if the selected village
     * changed some level.
     *
     * @param {Object} event rootScope.$on event info
     * @param {Object} data Event data about the chages.
     */
    var updateLevels = function (event, data) {
        var id = data.village_id || data.id

        if (ui.isVisible() && modelDataService.getSelectedVillage().getId() === id) {
            updateReachedLevelItems()
        }
    }

    /**
     * 
     *
     * @param {Object<x,y,name,id>} origin Village where the build was started.
     * @param {String} building
     * @param {Number} level
     * @param {Number} startDate
     */
    var insertLog = function (origin, building, level, startDate) {
        $noBuilds.hide()

        var $log = document.createElement('tr')

        $log.innerHTML = ejs.render('__builder_html_log-item', {
            locale: Locale,
            village: utils.genVillageLabel(origin),
            building: building,
            level: level,
            started: utils.formatDate(startDate)
        })

        $log.querySelector('.village').addEventListener('click', function () {
            windowDisplayService.openVillageInfo(origin.id)
        })

        $buildLog.prepend($log)
        ui.recalcScrollbar()
    }

    var clearLogs = function () {
        $buildLog.find('tr:not(.noBuilds)').remove()
        $noBuilds.css('display', '')
    }

    var populateLog = function () {
        Builder.getBuildLog().forEach(function (log) {
            insertLog.apply(this, log)
        })
    }

    /**
     * Calculate the total of points accumulated ultil the specified level.
     */
    var getLevelScale = function (factor, base, level) {
        return level ? parseInt(Math.round(factor * Math.pow(base, level - 1)), 10) : 0
    }

    /**
     * Calculate the points gained by each level of each building.
     * 
     * @return {Object<Array>}
     */
    var getBuildingsLevelPoints = function () {
        var $gameData = modelDataService.getGameData()
        var buildingsLevelPoints = {}
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

        return buildingsLevelPoints
    }

    /**
     * Populate the selected preset in the view to be edited.
     *
     * If no _presetId is specified, the current selected preset
     * will be re-populated.
     *
     * @param {String} _presetId
     */
    var populateEditorPresetOrder = function populateEditorPresetOrder (_presetId) {
        if (_presetId === '0') {
            return clearEditorPresetOrder()
        }

        if (!editorActivePreset) {
            enableMoveButtons()
        } else if (editorActivePreset && _presetId) {
            editorActivePreset = null
        }

        var buildingOrder = {}
        var settings = Builder.getSettings()
        var presetBuildings
        var buildingData = modelDataService.getGameData().getBuildings()
        var orderNum = 0
        var buildingName

        if (editorActivePreset) {
            presetBuildings = editorActivePreset.value
        } else {
            presetBuildings = settings.buildingOrders[_presetId]
            editorActivePreset = {
                id: _presetId,
                value: angular.copy(presetBuildings)
            }
        }

        for (buildingName in BUILDING_TYPES) {
            buildingOrder[BUILDING_TYPES[buildingName]] = 0
        }

        $editorSelectedPresetOrder.html('')

        presetBuildings.forEach(function (building) {
            var level = ++buildingOrder[building]
            var $item = document.createElement('tr')
            
            $item.innerHTML = ejs.render('__builder_html_editor-order-item', {
                locale: Locale,
                orderNum: orderNum++,
                building: building,
                level: level
            })

            $item.dataset.building = building
            $item.dataset.level = level
            $item.dataset.level = level

            $editorSelectedPresetOrder.append($item)
        })

        $editorSelectedPresetOrder.find('input').on('change', function () {
            var $label = this.parentElement
            var $tr = $label.parentElement.parentElement

            if (this.checked) {
                $label.classList.add('icon-26x26-checkbox-checked')
                $tr.classList.add('selected')
            } else {
                $label.classList.remove('icon-26x26-checkbox-checked')
                $tr.classList.remove('selected')
            }
        })

        $editorSelectedPreset.show()
        ui.recalcScrollbar()
    }

    var enableMoveButtons = function () {
        $editorMoveUp.removeClass('btn-grey').addClass('btn-green')
        $editorMoveDown.removeClass('btn-grey').addClass('btn-green')
    }

    var disableMoveButtons = function () {
        $editorMoveUp.removeClass('btn-green').addClass('btn-grey')
        $editorMoveDown.removeClass('btn-green').addClass('btn-grey')
    }

    var clearEditorPresetOrder = function () {
        editorActivePreset = null
        $editorSelectedPreset.hide()
        $editorSelectedPresetOrder.html('')
        disableMoveButtons()
        ui.recalcScrollbar()
    }

    /**
     * @return {Array} - Checked input indexes.
     */
    var getSelectedPresetItems = function () {
        if (!editorActivePreset) {
            return false
        }

        var selectedItems = []

        $editorSelectedPresetOrder.find('input:checked').forEach(function (elem) {
            selectedItems.push(parseInt(elem.dataset.ordernum, 10))
        })

        return selectedItems
    }

    /**
     * Check multiple checkbox inputs from the active editing preset.
     *
     * @param {Array<Number>} itemsToSelect - List of input index to be checked.
     */
    var editorSelectPresetItems = function (itemsToSelect) {
        var $inputs = $editorSelectedPresetOrder.find('input')

        itemsToSelect.forEach(function (index) {
            $inputs[index].checked = true
            $($inputs[index]).trigger('change')
        })
    }

    Builder.interface = function () {
        Builder.interface = init()
    }
})
