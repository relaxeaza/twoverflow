define('two/farmOverflow/settings', [], function () {
    return {
        PRESETS: 'presets',
        GROUP_IGNORE: 'group_ignore',
        GROUP_INCLUDE: 'group_include',
        GROUP_ONLY: 'group_only',
        MAX_DISTANCE: 'max_distance',
        MIN_DISTANCE: 'min_distance',
        IGNORE_FULL_STORAGE: 'ignore_full_storage',        
        ATTACK_INTERVAL: 'attack_interval',
        MAX_TRAVEL_TIME: 'max_travel_time',
        TARGET_SINGLE_ATTACK: 'target_single_attack',
        TARGET_MULTIPLE_FARMERS: 'target_multiple_farmers',
        PRESERVE_COMMAND_SLOTS: 'preserve_command_slots',
        FARMER_CYCLE_INTERVAL: 'farmer_cycle_interval',
        MIN_POINTS: 'min_points',
        MAX_POINTS: 'max_points',
        LOGS_LIMIT: 'logs_limit',
        IGNORE_ON_LOSS: 'ignore_on_loss'
    }
})

define('two/farmOverflow/settings/updates', function () {
    return {
        PRESET: 'preset',
        GROUPS: 'groups',
        TARGETS: 'targets',
        VILLAGES: 'villages',
        WAITING_VILLAGES: 'waiting_villages',
        FULL_STORAGE: 'full_storage',
        LOGS: 'logs',
        INTERVAL_TIMERS: 'interval_timers'
    }
})

define('two/farmOverflow/settings/map', [
    'two/farmOverflow/settings',
    'two/farmOverflow/settings/updates'
], function (
    SETTINGS,
    SETTINGS_UPDATE
) {
    return {
        [SETTINGS.PRESETS]: {
            default: [],
            updates: [
                SETTINGS_UPDATE.PRESET,
                SETTINGS_UPDATE.INTERVAL_TIMERS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.GROUP_IGNORE]: {
            default: false,
            updates: [
                SETTINGS_UPDATE.GROUPS,
                SETTINGS_UPDATE.INTERVAL_TIMERS
            ],
            disabledOption: true,
            inputType: 'select',
            type: 'groups'
        },
        [SETTINGS.GROUP_INCLUDE]: {
            default: [],
            updates: [
                SETTINGS_UPDATE.GROUPS,
                SETTINGS_UPDATE.TARGETS,
                SETTINGS_UPDATE.INTERVAL_TIMERS
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
                SETTINGS_UPDATE.TARGETS,
                SETTINGS_UPDATE.INTERVAL_TIMERS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.ATTACK_INTERVAL]: {
            default: 2,
            updates: [SETTINGS_UPDATE.INTERVAL_TIMERS]
        },
        [SETTINGS.FARMER_CYCLE_INTERVAL]: {
            default: 5,
            updates: [SETTINGS_UPDATE.INTERVAL_TIMERS]
        },
        [SETTINGS.TARGET_SINGLE_ATTACK]: {
            default: true,
            updates: [],
            inputType: 'checkbox'
        },
        [SETTINGS.TARGET_MULTIPLE_FARMERS]: {
            default: true,
            updates: [SETTINGS_UPDATE.INTERVAL_TIMERS],
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
            updates: [SETTINGS_UPDATE.INTERVAL_TIMERS],
            inputType: 'checkbox'
        },
        [SETTINGS.MIN_DISTANCE]: {
            default: 0,
            updates: [
                SETTINGS_UPDATE.TARGETS,
                SETTINGS_UPDATE.INTERVAL_TIMERS
            ]
        },
        [SETTINGS.MAX_DISTANCE]: {
            default: 15,
            updates: [
                SETTINGS_UPDATE.TARGETS,
                SETTINGS_UPDATE.INTERVAL_TIMERS
            ]
        },
        [SETTINGS.MIN_POINTS]: {
            default: 0,
            updates: [
                SETTINGS_UPDATE.TARGETS,
                SETTINGS_UPDATE.INTERVAL_TIMERS
            ]
        },
        [SETTINGS.MAX_POINTS]: {
            default: 12500,
            updates: [
                SETTINGS_UPDATE.TARGETS,
                SETTINGS_UPDATE.INTERVAL_TIMERS
            ]
        },
        [SETTINGS.MAX_TRAVEL_TIME]: {
            default: 90,
            updates: [SETTINGS_UPDATE.INTERVAL_TIMERS]
        },
        [SETTINGS.LOGS_LIMIT]: {
            default: 500,
            updates: [SETTINGS_UPDATE.LOGS]
        }
    }
})
