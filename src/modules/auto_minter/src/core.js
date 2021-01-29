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
    let checkInterval;

    const coinCost = modelDataService.getGameData().getCostsPerCoin();
    const groupList = modelDataService.getGroupList();

    const preserve = {};
    let selectedVillages = [];

    const STORAGE_KEYS = {
        SETTINGS: 'auto_minter_settings'
    };

    const RESOURCE_TYPES = ['wood', 'clay', 'iron'];

    const updateSelectedVillages = function () {
        selectedVillages = [];

        const enabledGroups = minterSettings[SETTINGS.ENABLED_GROUPS];

        for (const groupId of enabledGroups) {
            for (const villageId of groupList.getGroupVillageIds(groupId)) {
                selectedVillages.push(modelDataService.getVillage(villageId));
            }
        }
    };

    const updatePreserveResources = function () {
        preserve.wood = minterSettings[SETTINGS.PRESERVE_WOOD];
        preserve.clay = minterSettings[SETTINGS.PRESERVE_CLAY];
        preserve.iron = minterSettings[SETTINGS.PRESERVE_IRON];
    };

    const updateCheckInterval = function () {
        checkInterval = humanInterval(minterSettings[SETTINGS.CHECK_INTERVAL]);
    };

    const getVillageMaxCoins = function (village) {
        const academyLevel = village.getBuildingData().getBuildingLevel('academy');

        if (!academyLevel) {
            return false;
        }

        const maxCoinsPerResource = [];
        const villageResources = village.getResources().getComputed();

        for (const resourceType of RESOURCE_TYPES) {
            const available = Math.max(0, villageResources[resourceType].currentStock - preserve[resourceType]);
            maxCoinsPerResource.push(Math.floor(available / coinCost[resourceType]));
        }

        const villageMaxCoins = Math.min(...maxCoinsPerResource);

        if (!villageMaxCoins) {
            return false;
        }

        return {
            village_id: village.getId(),
            amount: villageMaxCoins
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

        if (!massMintVillages.length) {
            return;
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

            if (updates[UPDATES.PRESERVE_RESOURSES]) {
                updatePreserveResources();
            }

            if (updates[UPDATES.GROUPS]) {
                updateSelectedVillages();
            }

            if (updates[UPDATES.UPDATE_INTERVAL]) {
                stopChecker();
                startChecker();
            }
        });

        minterSettings = settings.getAll();

        $rootScope.$on(eventTypeProvider.GROUPS_CREATED, updateSelectedVillages);
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, updateSelectedVillages);
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_LINKED, updateSelectedVillages);
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_UNLINKED, updateSelectedVillages);

        ready(function () {
            updateSelectedVillages();
            updatePreserveResources();
            updateCheckInterval();
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
