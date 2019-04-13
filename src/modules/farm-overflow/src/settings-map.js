define('two/farm/settingsMap', [
    'two/farm/settings',
    'two/farm/settingsUpdate'
], function (
    SETTINGS,
    SETTINGS_UPDATE
) {
    return {
        [SETTINGS.PRESETS]: {
            default: [],
            updates: [SETTINGS_UPDATE.PRESET]
        },
        [SETTINGS.GROUP_IGNORE]: {
            default: false,
            updates: [SETTINGS_UPDATE.GROUPS]
        },
        [SETTINGS.GROUP_INCLUDE]: {
            default: [],
            updates: [SETTINGS_UPDATE.GROUPS, SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.GROUP_ONLY]: {
            default: [],
            updates: [SETTINGS_UPDATE.GROUPS, SETTINGS_UPDATE.VILLAGES, SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.RANDOM_BASE]: {
            default: 3,
            updates: []
        },
        [SETTINGS.COMMANDS_PER_VILLAGE]: {
            default: 48,
            updates: [SETTINGS_UPDATE.WAITING_VILLAGES]
        },
        [SETTINGS.PRIORITY_TARGETS]: {
            default: true,
            updates: []
        },
        [SETTINGS.IGNORE_ON_LOSS]: {
            default: true,
            updates: []
        },
        [SETTINGS.IGNORE_FULL_STORAGE]: {
            default: true,
            updates: [SETTINGS_UPDATE.FULL_STORAGE]
        },
        [SETTINGS.STEP_CYCLE]: {
            default: false,
            updates: [SETTINGS_UPDATE.VILLAGES]
        },
        [SETTINGS.STEP_CYCLE_NOTIFS]: {
            default: false,
            updates: []
        },
        [SETTINGS.STEP_CYCLE_INTERVAL]: {
            default: 0,
            updates: []
        },
        [SETTINGS.MAX_DISTANCE]: {
            default: 10,
            updates: [SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.MIN_DISTANCE]: {
            default: 0,
            updates: [SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.MIN_POINTS]: {
            default: 0,
            updates: [SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.MAX_POINTS]: {
            default: 12500,
            updates: [SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.MAX_TRAVEL_TIME]: {
            default: 60,
            updates: []
        },
        [SETTINGS.LOGS_LIMIT]: {
            default: 500,
            updates: [SETTINGS_UPDATE.LOGS]
        },
        [SETTINGS.EVENT_ATTACK]: {
            default: true,
            updates: [SETTINGS_UPDATE.LOGS]
        },
        [SETTINGS.EVENT_VILLAGE_CHANGE]: {
            default: true,
            updates: [SETTINGS_UPDATE.LOGS]
        },
        [SETTINGS.EVENT_PRIORITY_ADD]: {
            default: true,
            updates: [SETTINGS_UPDATE.LOGS]
        },
        [SETTINGS.EVENT_IGNORED_VILLAGE]: {
            default: true,
            updates: [SETTINGS_UPDATE.LOGS]
        },
        [SETTINGS.REMOTE_ID]: {
            default: 'remote',
            updates: []
        },
        [SETTINGS.HOTKEY_SWITCH]: {
            default: 'shift+z',
            updates: []
        },
        [SETTINGS.HOTKEY_WINDOW]: {
            default: 'z',
            updates: []
        }
    }
})
