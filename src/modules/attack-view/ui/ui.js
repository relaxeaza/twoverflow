define('two/attackView/ui', [
    'two/attackView',
    'two/queue',
    'two/locale',
    'two/ui',
    'two/FrontButton',
    'two/utils',
    'two/eventQueue',
    'helper/time',
    'conf/unitTypes',
    'ejs'
], function (
    attackView,
    Queue,
    Locale,
    Interface,
    FrontButton,
    utils,
    eventQueue,
    $timeHelper,
    UNIT_TYPES,
    ejs
) {
    var ui
    var opener
    var $window
    var $commands
    var $empty
    var $filters
    var $filtersBase
    var $sortings
    
    var init = function () {
        ui = new Interface('AttackView', {
            template: '__attackView_html_window',
            activeTab: 'attacks',
            replaces: {
                version: attackView.version,
                author: __overflow_author,
                locale: Locale,
                UNIT_SPEED_ORDER: attackView.UNIT_SPEED_ORDER
            },
            css: '__attackView_css_style',
            onClose: function () {
                attackView.unregisterListeners()
            }
        })

        opener = new FrontButton('AttackView', {
            onClick: function () {
                attackView.registerListeners()
                attackView.loadCommands()
                checkCommands()
                ui.openWindow()
            },
            classHover: false,
            classBlur: false
        })

        $window = $(ui.$window)
        $commands = $window.find('.commands')
        $empty = $window.find('.empty')
        $filtersBase = $window.find('.filters')
        $filters = {
            village: $filtersBase.find('.village'),
            commandTypes: {
                ATTACK: $filtersBase.find('.attack'),
                SUPPORT: $filtersBase.find('.support'),
                RELOCATE: $filtersBase.find('.relocate')
            },
            incomingUnits: {
                light_cavalry: $filtersBase.find('.light_cavalry'),
                heavy_cavalry: $filtersBase.find('.heavy_cavalry'),
                axe: $filtersBase.find('.axe'),
                sword: $filtersBase.find('.sword'),
                ram: $filtersBase.find('.ram'),
                snob: $filtersBase.find('.snob'),
                trebuchet: $filtersBase.find('.trebuchet'),
            }
        }
        $sortings = $window.find('.sorting th[data-sort]')

        $filters.village.on('click', function () {
            attackView.toggleFilter(attackView.FILTER_TYPES.VILLAGE)
        })

        $filtersBase.find('.commandTypes').on('click', function () {
            attackView.toggleFilter(attackView.FILTER_TYPES.COMMAND_TYPES, this.dataset.filter)
        })

        $filtersBase.find('.incomingUnits').on('click', function () {
            attackView.toggleFilter(attackView.FILTER_TYPES.INCOMING_UNITS, this.dataset.filter)
        })

        $sortings.on('click', function () {
            attackView.toggleSorting(this.dataset.sort)
        })

        setInterval(function () {
            if (ui.isVisible('attacks')) {
                checkCommands()
            }
        }, 1000)

        eventQueue.bind('attackView/commandsLoaded', populateCommandsView)
        eventQueue.bind('attackView/commandCancelled', onCommandCancelled)
        eventQueue.bind('attackView/commandIgnored', onCommandIgnored)
        eventQueue.bind('attackView/villageRenamed', onVillageRenamed)
        eventQueue.bind('attackView/filtersChanged', updateFilterElements)
        eventQueue.bind('attackView/sortingChanged', updateSortingElements)
        rootScope.$on(eventTypeProvider.MAP_SELECTED_VILLAGE, onVillageSwitched)

        updateFilterElements()

        return ui
    }

    /**
     * If the a command finishes in a certain way , there is no event, so we have to trigger the reload ourselfs.
     * (e.g.: the troops die at the village of the enemy)
     */
    var checkCommands = function () {
        var commands = attackView.getCommands()
        var nowInSeconds = Date.now() * 1E-3
        var progress
        
        for (var i = 0; i < commands.length; i++) {
            progress = commands[i].model.percent()

            if (progress === 100) {
                commands[i].$command.remove()
                continue
            }

            commands[i].$arrivalProgress.style.width = progress + '%'
            commands[i].$arrivalIn.innerHTML = $timeHelper.readableSeconds($timeHelper.server2ClientTimeInSeconds(commands[i].time_completed - nowInSeconds))
        }
    }

    var populateCommandsView = function (commands) {
        $commands.children().remove()
        var now = Date.now()

        if (commands.length) {
            $empty.hide()
        } else {
            return $empty.css('display', '')
        }

        commands.forEach(function (command) {
            var $command = document.createElement('tr')

            var arriveTime = command.time_completed * 1000
            var arriveTimeFormated = utils.formatDate(arriveTime, 'HH:mm:ss dd/MM/yyyy')
            var arrivalIn = $timeHelper.server2ClientTimeInSeconds(arriveTime - now)
            var arrivalInFormated = $timeHelper.readableMilliseconds(arrivalIn, false, true)
            var duration = command.time_completed - command.time_start
            var backTime = (command.time_completed + duration) * 1000
            var backTimeFormated = utils.formatDate(backTime, 'HH:mm:ss dd/MM/yyyy')
            var commandClass = 'command-' + command.command_id + ' ' + command.command_type

            if (command.slowestUnit === UNIT_TYPES.SNOB) {
                commandClass += ' snob'
            }
            
            $command.className = commandClass
            $command.innerHTML = ejs.render('__attackView_html_command', {
                locale: Locale,
                originCharacter: command.originCharacter,
                originVillage: command.originVillage,
                targetVillage: command.targetVillage,
                arrivalDate: arriveTimeFormated,
                arrivalIn: arrivalInFormated,
                slowestUnit: command.slowestUnit,
                progress: command.model.percent(),
                commandType: command.command_type
            })

            var $characterName = $command.querySelector('.originCharacter .name')
            var $originName = $command.querySelector('.originVillage .name')
            var $originCoords = $command.querySelector('.originVillage .coords')
            var $targetName = $command.querySelector('.targetVillage .name')
            var $targetCoords = $command.querySelector('.targetVillage .coords')
            var $arrivalProgress = $command.querySelector('.arrivalProgress')
            var $arrivalIn = $command.querySelector('.arrivalIn')
            var $removeTroops = $command.querySelector('.removeTroops')
            var $copyArriveTime = $command.querySelector('.copyArriveTime')
            var $copyBackTime = $command.querySelector('.copyBackTime')

            $characterName.addEventListener('click', function () {
                windowDisplayService.openCharacterProfile(command.originCharacter.id)
            })

            $originName.addEventListener('click', function () {
                windowDisplayService.openVillageInfo(command.originVillage.id)
            })

            $originCoords.addEventListener('click', function () {
                mapService.jumpToVillage(command.originVillage.x, command.originVillage.y)
            })

            $targetName.addEventListener('click', function () {
                windowDisplayService.openVillageInfo(command.targetVillage.id)
            })

            $targetCoords.addEventListener('click', function () {
                mapService.jumpToVillage(command.targetVillage.x, command.targetVillage.y)
            })

            $removeTroops.addEventListener('click', function () {
                var outDate = utils.formatDate((command.time_completed - 10) * 1000, 'HH:mm:ss:sss dd/MM/yyyy')
                attackView.setQueueCommand(command, outDate)
            })

            $copyArriveTime.addEventListener('click', function () {
                document.execCommand('copy')
            })

            $copyArriveTime.addEventListener('copy', function (event) {
                event.preventDefault()
                event.clipboardData.setData('text/plain', arriveTimeFormated)
                utils.emitNotif('success', 'Arrive time copied!')
            })

            $copyBackTime.addEventListener('click', function () {
                document.execCommand('copy')
            })

            $copyBackTime.addEventListener('copy', function (event) {
                event.preventDefault()
                event.clipboardData.setData('text/plain', backTimeFormated)
                utils.emitNotif('success', 'Back time copied!')
            })

            $commands.append($command)

            command.$command = $command
            command.$arrivalProgress = $arrivalProgress
            command.$arrivalIn = $arrivalIn
        })

        ui.setTooltips()
        ui.recalcScrollbar()
        highlightSelectedVillage()
    }

    var onCommandCancelled = function (commandId) {
        $commands.find('.command-' + commandId).remove()
        ui.recalcScrollbar()
    }

    var onCommandIgnored = function (commandId) {
        $commands.find('.command-' + commandId).remove()
        ui.recalcScrollbar()
    }

    var onVillageRenamed = function (village) {
        var _class = '.village-' + village.village_id + ' .name'

        $commands.find(_class).html(village.name)
    }

    var onVillageSwitched = function (e, vid) {
        var filters = attackView.getFilters()

        if (!filters[attackView.FILTER_TYPES.VILLAGE]) {
            highlightSelectedVillage(vid)
        }
    }

    var removeHighlightVillage = function () {
        $commands.find('.village.selected').removeClass('selected')
    }

    var highlightSelectedVillage = function (vid) {
        removeHighlightVillage()

        vid = vid || modelDataService.getSelectedVillage().getId()
        $commands.find('.village-' + vid).addClass('selected')
    }

    var updateFilterElements = function () {
        var filters = attackView.getFilters()
        var type
        var sub
        var fn

        for (type in filters) {
            if (angular.isObject(filters[type])) {
                for (sub in filters[type]) {
                    fn = filters[type][sub] ? 'addClass': 'removeClass'
                    $filters[type][sub][fn]('active')
                }
            } else {
                fn = filters[type] ? 'addClass': 'removeClass'
                $filters[type][fn]('active')
            }
        }
    }

    var updateSortingElements = function () {
        var sorting = attackView.getSortings()
        var $arrow = document.createElement('span')
        $arrow.className = 'float-right arrow '
        $arrow.className += sorting.reverse ? 'icon-26x26-normal-arrow-up' : 'icon-26x26-normal-arrow-down'
        
        $sortings.find('.arrow').remove()
        
        $sortings.some(function ($elem, i) {
            var sort = $elem.dataset.sort

            if (sorting.column === attackView.COLUMN_TYPES[sort]) {
                $elem.appendChild($arrow)
                return true
            }
        })
    }

    attackView.interface = function () {
        attackView.interface = init()
    }
})
