define('two/farmOverflow/ui', [
    'two/ui',
    'two/farmOverflow',
    'two/farmOverflow/types/status',
    'two/farmOverflow/types/errors',
    'two/farmOverflow/types/logs',
    'two/farmOverflow/settings',
    'two/Settings',
    'two/EventScope',
    'two/utils',
    'queues/EventQueue',
    'helper/time'
], function (
    interfaceOverflow,
    farmOverflow,
    STATUS,
    ERROR_TYPES,
    LOG_TYPES,
    SETTINGS,
    Settings,
    EventScope,
    utils,
    eventQueue,
    timeHelper
) {
    let $scope;
    let settings;
    const presetList = modelDataService.getPresetList();
    const groupList = modelDataService.getGroupList();
    let $button;
    const villagesInfo = {};
    const villagesLabel = {};
    let cycleCountdownTimer = null;
    const TAB_TYPES = {
        SETTINGS: 'settings',
        VILLAGES: 'villages',
        LOGS: 'logs'
    };

    const updateVisibleLogs = function () {
        const offset = $scope.pagination.offset;
        const limit = $scope.pagination.limit;

        $scope.visibleLogs = $scope.logs.slice(offset, offset + limit);
        $scope.pagination.count = $scope.logs.length;

        $scope.visibleLogs.forEach(function (log) {
            if (log.villageId) {
                loadVillageInfo(log.villageId);
            }

            if (log.targetId) {
                loadVillageInfo(log.targetId);
            }
        });
    };

    // TODO: make it shared with other modules
    const loadVillageInfo = function (villageId) {
        if (villagesInfo[villageId]) {
            return villagesInfo[villageId];
        }

        villagesInfo[villageId] = true;
        villagesLabel[villageId] = 'LOADING...';

        socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
            my_village_id: modelDataService.getSelectedVillage().getId(),
            village_id: villageId,
            num_reports: 1
        }, function (data) {
            villagesInfo[villageId] = {
                x: data.village_x,
                y: data.village_y,
                name: data.village_name,
                last_report: data.last_reports[0]
            };

            villagesLabel[villageId] = `${data.village_name} (${data.village_x}|${data.village_y})`;
        });
    };

    const loadExceptionsInfo = function () {
        $scope.exceptionVillages.included.forEach(function (villageId) {
            loadVillageInfo(villageId);
        });
        $scope.exceptionVillages.ignored.forEach(function (villageId) {
            loadVillageInfo(villageId);
        });
    };

    const switchFarm = function () {
        if (farmOverflow.isRunning()) {
            farmOverflow.stop();
        } else {
            farmOverflow.start();
        }
    };

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType;
    };

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings));
        $scope.saveButtonColor = 'orange';

        utils.notif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, 'farm_overflow'));
    };

    const removeIgnored = function (villageId) {
        const groupIgnore = settings.get(SETTINGS.GROUP_IGNORE);
        const groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupIgnore);

        if (!groupVillages.includes(villageId)) {
            return false;
        }

        socketService.emit(routeProvider.GROUPS_UNLINK_VILLAGE, {
            group_id: groupIgnore,
            village_id: villageId
        });
    };

    const removeIncluded = function (villageId) {
        const groupsInclude = settings.get(SETTINGS.GROUP_INCLUDE);

        groupsInclude.forEach(function (groupId) {
            const groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId);

            if (groupVillages.includes(villageId)) {
                socketService.emit(routeProvider.GROUPS_UNLINK_VILLAGE, {
                    group_id: groupId,
                    village_id: villageId
                });
            }
        });
    };

    const checkCycleInterval = function () {
        const nextCycleDate = farmOverflow.getNextCycleDate();

        if (nextCycleDate) {
            $scope.showCycleTimer = true;
            $scope.nextCycleCountdown = nextCycleDate - timeHelper.gameTime();

            cycleCountdownTimer = setInterval(function () {
                $scope.nextCycleCountdown -= 1000;
            }, 1000);
        }
    };

    const eventHandlers = {
        updatePresets: function () {
            $scope.presets = Settings.encodeList(presetList.getPresets(), {
                disabled: false,
                type: 'presets'
            });
        },
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                disabled: false,
                type: 'groups'
            });

            $scope.groupsWithDisabled = Settings.encodeList(groupList.getGroups(), {
                disabled: true,
                type: 'groups'
            });
        },
        start: function () {
            $scope.running = true;

            utils.notif('success', $filter('i18n')('farm_started', $rootScope.loc.ale, 'farm_overflow'));
        },
        stop: function (event, data) {
            $scope.running = false;
            $scope.showCycleTimer = false;
            clearInterval(cycleCountdownTimer);

            switch (data.reason) {
                case ERROR_TYPES.NO_PRESETS: {
                    utils.notif('success', $filter('i18n')('no_preset', $rootScope.loc.ale, 'farm_overflow'));
                    break;
                }
                case ERROR_TYPES.USER_STOP: {
                    utils.notif('success', $filter('i18n')('farm_stopped', $rootScope.loc.ale, 'farm_overflow'));
                    break;
                }
            }
        },
        updateLogs: function () {
            $scope.logs = angular.copy(farmOverflow.getLogs());
            updateVisibleLogs();

            if (!$scope.logs.length) {
                utils.notif('success', $filter('i18n')('reseted_logs', $rootScope.loc.ale, 'farm_overflow'));
            }
        },
        updateFarmerVillages: function () {
            $scope.farmers = farmOverflow.getFarmers();
        },
        updateExceptionVillages: function () {
            $scope.exceptionVillages = farmOverflow.getExceptionVillages();
            loadExceptionsInfo();
        },
        updateExceptionLogs: function () {
            $scope.exceptionLogs = farmOverflow.getExceptionLogs();
        },
        onCycleBegin: function () {
            $scope.showCycleTimer = false;
            clearInterval(cycleCountdownTimer);
        },
        onCycleEnd: function (event, reason) {
            if (reason === STATUS.USER_STOP) {
                return;
            }
            
            $scope.showCycleTimer = true;
            $scope.nextCycleCountdown = farmOverflow.getCycleInterval();

            cycleCountdownTimer = setInterval(function () {
                $scope.nextCycleCountdown -= 1000;
            }, 1000);
        }
    };

    const init = function () {
        settings = farmOverflow.getSettings();
        $button = interfaceOverflow.addMenuButton('Farmer', 10);

        $button.addEventListener('click', function () {
            buildWindow();
        });

        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_START, function () {
            $button.classList.remove('btn-orange');
            $button.classList.add('btn-red');
        });

        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_STOP, function () {
            $button.classList.remove('btn-red');
            $button.classList.add('btn-orange');
        });

        interfaceOverflow.addTemplate('twoverflow_farm_overflow_window', `___farm_overflow_html_main`);
        interfaceOverflow.addStyle('___farm_overflow_css_style');
    };

    const buildWindow = function () {
        let ignoreWatch = true;

        $scope = $rootScope.$new();
        $scope.SETTINGS = SETTINGS;
        $scope.TAB_TYPES = TAB_TYPES;
        $scope.LOG_TYPES = LOG_TYPES;
        $scope.running = farmOverflow.isRunning();
        $scope.selectedTab = TAB_TYPES.SETTINGS;
        $scope.farmers = farmOverflow.getFarmers();
        $scope.villagesLabel = villagesLabel;
        $scope.villagesInfo = villagesInfo;
        $scope.exceptionVillages = farmOverflow.getExceptionVillages();
        $scope.exceptionLogs = farmOverflow.getExceptionLogs();
        $scope.logs = farmOverflow.getLogs();
        $scope.visibleLogs = [];
        $scope.showCycleTimer = false;
        $scope.nextCycleCountdown = 0;
        $scope.saveButtonColor = 'orange';
        $scope.settingsMap = settings.settingsMap;

        $scope.pagination = {
            count: $scope.logs.length,
            offset: 0,
            loader: updateVisibleLogs,
            limit: storageService.getPaginationLimit()
        };

        settings.injectScope($scope);
        eventHandlers.updatePresets();
        eventHandlers.updateGroups();
        updateVisibleLogs();
        loadExceptionsInfo();
        checkCycleInterval();

        // scope functions
        $scope.switchFarm = switchFarm;
        $scope.selectTab = selectTab;
        $scope.saveSettings = saveSettings;
        $scope.clearLogs = farmOverflow.clearLogs;
        $scope.jumpToVillage = mapService.jumpToVillage;
        $scope.openVillageInfo = windowDisplayService.openVillageInfo;
        $scope.showReport = reportService.showReport;
        $scope.removeIgnored = removeIgnored;
        $scope.removeIncluded = removeIncluded;

        const eventScope = new EventScope('twoverflow_farm_overflow_window', function onDestroy () {
            clearInterval(cycleCountdownTimer);
        });

        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true);
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true);
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true);
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true);
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true);
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_START, eventHandlers.start);
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_STOP, eventHandlers.stop);
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED, eventHandlers.updateLogs);
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED, eventHandlers.updateFarmerVillages);
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_VILLAGES_UPDATED, eventHandlers.updateExceptionVillages);
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_LOGS_UPDATED, eventHandlers.updateExceptionLogs);
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN, eventHandlers.onCycleBegin);
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_CYCLE_END, eventHandlers.onCycleEnd);

        windowManagerService.getScreenWithInjectedScope('!twoverflow_farm_overflow_window', $scope);

        $scope.$watch('settings', function () {
            if (!ignoreWatch) {
                $scope.saveButtonColor = 'red';
            }

            ignoreWatch = false;
        }, true);
    };

    return init;
});
