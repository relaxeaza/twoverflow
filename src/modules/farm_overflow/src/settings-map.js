define('two/farmOverflow/settingsMap', [
    'two/farmOverflow/settings',
    'two/farmOverflow/settingsUpdate'
], function (
    SETTINGS,
    SETTINGS_UPDATE
) {
    return {
        [SETTINGS.PRESETS]: {
            default: [],
            updates: [SETTINGS_UPDATE.PRESET],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.GROUP_IGNORE]: {
            default: false,
            updates: [SETTINGS_UPDATE.GROUPS],
            disabledOption: true,
            inputType: 'select',
            type: 'groups'
        },
        [SETTINGS.GROUP_INCLUDE]: {
            default: [],
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
            default: [],
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
        [SETTINGS.ATTACK_INTERVAL]: {
            default: 2,
            updates: []
        },
        [SETTINGS.FARMER_CYCLE_INTERVAL]: {
            default: 5,
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
        [SETTINGS.IGNORE_ON_LOSS]: {
            default: true,
            updates: [],
            inputType: 'checkbox'
        },
        [SETTINGS.IGNORE_FULL_STORAGE]: {
            default: true,
            updates: [],
            inputType: 'checkbox'
        },
        [SETTINGS.MIN_DISTANCE]: {
            default: 0,
            updates: [SETTINGS_UPDATE.TARGETS]
        },
        [SETTINGS.MAX_DISTANCE]: {
            default: 15,
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
            default: 90,
            updates: []
        },
        [SETTINGS.LOGS_LIMIT]: {
            default: 500,
            updates: [SETTINGS_UPDATE.LOGS]
        }
    }
})
