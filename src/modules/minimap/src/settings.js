define('two/minimap/settings', [], function () {
    return {
        RIGHT_CLICK_ACTION: 'right_click_action',
        FLOATING_MINIMAP: 'floating_minimap',
        SHOW_CROSS: 'show_cross',
        SHOW_CONTINENT_DEMARCATIONS: 'show_continent_demarcations',
        SHOW_PROVINCE_DEMARCATIONS: 'show_province_demarcations',
        SHOW_BARBARIANS: 'show_barbarians',
        SHOW_GHOST_VILLAGES: 'show_ghost_villages',
        SHOW_ONLY_CUSTOM_HIGHLIGHTS: 'show_only_custom_highlights',
        HIGHLIGHT_OWN: 'highlight_own',
        HIGHLIGHT_SELECTED: 'highlight_selected',
        HIGHLIGHT_DIPLOMACY: 'highlight_diplomacy',
        COLOR_GHOST: 'color_ghost',
        COLOR_QUICK_HIGHLIGHT: 'color_quick_highlight',
        COLOR_BACKGROUND: 'color_background',
        COLOR_PROVINCE: 'color_province',
        COLOR_CONTINENT: 'color_continent',
        COLOR_CROSS: 'color_cross'
    }
})

define('two/minimap/settings/updates', function () {
    return {
        MINIMAP: 'minimap'
    }
})

define('two/minimap/settings/map', [
    'two/minimap/settings',
    'two/minimap/types/actions',
    'two/minimap/settings/updates'
], function (
    SETTINGS,
    ACTION_TYPES,
    UPDATES
) {
    return {
        [SETTINGS.RIGHT_CLICK_ACTION]: {
            default: ACTION_TYPES.HIGHLIGHT_PLAYER,
            inputType: 'select',
            disabledOption: false
        },
        [SETTINGS.SHOW_CROSS]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_CONTINENT_DEMARCATIONS]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_PROVINCE_DEMARCATIONS]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_BARBARIANS]: {
            default: false,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_GHOST_VILLAGES]: {
            default: false,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]: {
            default: false,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.HIGHLIGHT_OWN]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.HIGHLIGHT_SELECTED]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.HIGHLIGHT_DIPLOMACY]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_SELECTED]: {
            default: '#ffffff',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_BARBARIAN]: {
            default: '#969696',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_PLAYER]: {
            default: '#f0c800',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_QUICK_HIGHLIGHT]: {
            default: '#ffffff',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_BACKGROUND]: {
            default: '#436213',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_PROVINCE]: {
            default: '#ffffff',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_CONTINENT]: {
            default: '#cccccc',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_CROSS]: {
            default: '#999999',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_TRIBE]: {
            default: '#0000DB',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_ALLY]: {
            default: '#00a0f4',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_ENEMY]: {
            default: '#ED1212',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_FRIENDLY]: {
            default: '#BF4DA4',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_GHOST]: {
            default: '#3E551C',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        }
    }
})
