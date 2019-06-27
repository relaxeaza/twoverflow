define('two/farmOverflow/settingsMap', [
    'two/farmOverflow/settings',
    'two/farmOverflow/settingsUpdate'
], function (
    SETTINGS,
    SETTINGS_UPDATE
) {
    return {
        [SETTINGS.PRESETS]: {
            // default: [],
            default: [843831, 3578472, 9737990],
            updates: [SETTINGS_UPDATE.PRESET],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.GROUP_IGNORE]: {
            // default: false,
            default: 12440,
            updates: [SETTINGS_UPDATE.GROUPS],
            disabledOption: true,
            inputType: 'select',
            type: 'groups'
        },
        [SETTINGS.GROUP_INCLUDE]: {
            // default: [],
            default: [5487],
            updates: [
                SETTINGS_UPDATE.GROUPS,
                SETTINGS_UPDATE.TARGETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP_ONLY]: {
            // default: [],
            default: [12804],
            updates: [
                SETTINGS_UPDATE.GROUPS,
                SETTINGS_UPDATE.VILLAGES,
                SETTINGS_UPDATE.TARGETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.RANDOM_BASE]: {
            default: 0,
            updates: []
        },
        [SETTINGS.TARGET_SINGLE_ATTACK]: {
            default: true,
            updates: [],
            inputType: 'checkbox'
        },
        [SETTINGS.TARGET_MULTIPLE_FARMERS]: {
            default: true,
            updates: [],
            inputType: 'checkbox'
        },
        [SETTINGS.PRESERVE_COMMAND_SLOTS]: {
            default: 5,
            updates: []
        },
        // [SETTINGS.PRIORITY_TARGETS]: {
        //     default: true,
        //     updates: []
        // },
        [SETTINGS.IGNORE_ON_LOSS]: {
            default: true,
            updates: []
        },
        [SETTINGS.IGNORE_FULL_STORAGE]: {
            default: true,
            updates: []
        },
        // [SETTINGS.STEP_CYCLE]: {
        //     default: false,
        //     updates: [SETTINGS_UPDATE.VILLAGES]
        // },
        // [SETTINGS.STEP_CYCLE_NOTIFS]: {
        //     default: false,
        //     updates: []
        // },
        [SETTINGS.FARMER_CYCLE_INTERVAL]: {
            default: 0,
            updates: []
        },
        [SETTINGS.MAX_DISTANCE]: {
            default: 30,
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
            default: 120,
            updates: []
        },
        [SETTINGS.LOGS_LIMIT]: {
            default: 500,
            updates: [SETTINGS_UPDATE.LOGS]
        },
        // [SETTINGS.EVENT_ATTACK]: {
        //     default: true,
        //     updates: [SETTINGS_UPDATE.LOGS]
        // },
        // [SETTINGS.EVENT_VILLAGE_CHANGE]: {
        //     default: true,
        //     updates: [SETTINGS_UPDATE.LOGS]
        // },
        // [SETTINGS.EVENT_PRIORITY_ADD]: {
        //     default: true,
        //     updates: [SETTINGS_UPDATE.LOGS]
        // },
        // [SETTINGS.EVENT_IGNORED_VILLAGE]: {
        //     default: true,
        //     updates: [SETTINGS_UPDATE.LOGS]
        // },
        // [SETTINGS.REMOTE_ID]: {
        //     default: 'remote',
        //     updates: []
        // },
        // [SETTINGS.HOTKEY_SWITCH]: {
        //     default: 'shift+z',
        //     updates: []
        // },
        // [SETTINGS.HOTKEY_WINDOW]: {
        //     default: 'z',
        //     updates: []
        // }
    }
})
