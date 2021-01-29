define('two/autoMinter', [
    'two/Settings',
    'two/autoMinter/settings',
    'two/autoMinter/settings/map',
    'two/autoMinter/settings/updates',
    'two/ready',
    'two/utils',
    'queues/EventQueue',
    'humanInterval'
], function (
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    ready,
    utils,
    eventQueue,
    humanInterval
) {
    let initialized = false;
    let running = false;
    let settings;
    let minterSettings;
    let intervalId;
    const costPerCoin = modelDataService.getGameData().getCostsPerCoin();
    let checkInterval;

    const preveseResources = {};
    let selectedVillages = [];

    const STORAGE_KEYS = {
        SETTINGS: 'auto_minter_settings'
    };

    const RESOURCE_TYPES = ['wood', 'clay', 'iron'];

    const updateGroups = function () {
        const selectedGroups = [];
        selectedVillages = [];

        const allGroups = modelDataService.getGroupList().getGroups();
        const enabledGroups = minterSettings[SETTINGS.ENABLED_GROUPS];

        for (const groupId of enabledGroups) {
            selectedGroups.push(allGroups[groupId]);
        }

        for (const group of selectedGroups) {
            const groupVillages = modelDataService.getGroupList().getGroupVillageIds(group.id);

            for (const villageId of groupVillages) {
                selectedVillages.push(modelDataService.getVillage(villageId));
            }
        }
    };

    const updateSettingValues = function () {
        preveseResources.wood = minterSettings[SETTINGS.PRESERVE_WOOD];
        preveseResources.clay = minterSettings[SETTINGS.PRESERVE_CLAY];
        preveseResources.iron = minterSettings[SETTINGS.PRESERVE_IRON];
        checkInterval = humanInterval(minterSettings[SETTINGS.CHECK_INTERVAL]);
    };

    const getVillageMaxCoins = function (village) {
        const academyLevel = village.getBuildingData().getBuildingLevel('academy');

        if (!academyLevel) {
            return false;
        }

        const availableResources = {};
        const maxCoinsByResource = {};
        const resources = village.getResources().getComputed();

        for (const resourceType of RESOURCE_TYPES) {
            availableResources[resourceType] = Math.max(0, resources[resourceType].currentStock - preveseResources[resourceType]);
            maxCoinsByResource[resourceType] = Math.floor(availableResources[resourceType] / costPerCoin[resourceType]);
        }

        const maxCoins = Math.min(...Object.values(maxCoinsByResource));

        if (!maxCoins) {
            return false;
        }

        return {
            village_id: village.getId(),
            amount: maxCoins
        };
    };

    const massCoinVillages = function () {
        const massMintVillages = [];

        for (const village of selectedVillages) {
            const villageMaxCoins = getVillageMaxCoins(village);

            if (villageMaxCoins) {
                massMintVillages.push(villageMaxCoins);
            }
        }

        socketService.emit(routeProvider.MASS_MINT_COINS, {
            villages: massMintVillages
        });
    };

    const startChecker = function () {
        running = true;
        massCoinVillages();
        intervalId = setInterval(massCoinVillages, checkInterval);
    };

    const stopChecker = function () {
        running = false;
        clearInterval(intervalId);
    };

    const autoMinter = {};

    autoMinter.init = function () {
        initialized = true;

        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        });

        settings.onChange(function (changes, updates) {
            minterSettings = settings.getAll();

            if (updates[UPDATES.VALUES]) {
                updateSettingValues();
            }

            if (updates[UPDATES.GROUPS]) {
                updateGroups();
            }

            if (updates[UPDATES.CHECKER]) {
                stopChecker();
                startChecker();
            }
        });

        minterSettings = settings.getAll();

        $rootScope.$on(eventTypeProvider.GROUPS_CREATED, updateGroups);
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, updateGroups);
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_LINKED, updateGroups);
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_UNLINKED, updateGroups);

        ready(function () {
            updateGroups();
            updateSettingValues();
        }, 'all_villages_ready');
    };

    autoMinter.start = function () {
        startChecker();
        eventQueue.trigger(eventTypeProvider.AUTO_MINTER_START);
    };

    autoMinter.stop = function () {
        stopChecker();
        eventQueue.trigger(eventTypeProvider.AUTO_MINTER_STOP);
    };

    autoMinter.getSettings = function () {
        return settings;
    };

    autoMinter.isInitialized = function () {
        return initialized;
    };

    autoMinter.isRunning = function () {
        return running;
    };

    return autoMinter;
});
