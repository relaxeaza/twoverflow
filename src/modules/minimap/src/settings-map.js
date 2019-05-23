define('two/minimap/settingsMap', [
    'two/minimap/settings',
    'two/minimap/actionTypes'
], function (
    SETTINGS,
    ACTION_TYPES
) {
    return {
        [SETTINGS.RIGHT_CLICK_ACTION]: {
            default: ACTION_TYPES.HIGHLIGHT_PLAYER,
            inputType: 'select',
            disabledOption: false,
            update: false
        },
        // [SETTINGS.FLOATING_MINIMAP]: {
        //     default: false,
        //     inputType: 'checkbox',
        //     update: false
        // }
        [SETTINGS.SHOW_CROSS]: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.SHOW_DEMARCATIONS]: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.SHOW_BARBARIANS]: {
            default: false,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.SHOW_GHOST_VILLAGES]: {
            default: false,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]: {
            default: false,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.HIGHLIGHT_OWN]: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.HIGHLIGHT_SELECTED]: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.HIGHLIGHT_DIPLOMACY]: {
            default: true,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.COLOR_SELECTED]: {
            default: '#ffffff',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_BARBARIAN]: {
            default: '#969696',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_PLAYER]: {
            default: '#f0c800',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_QUICK_HIGHLIGHT]: {
            default: '#ffffff',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_BACKGROUND]: {
            default: '#436213',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_PROVINCE]: {
            default: '#ffffff',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_CONTINENT]: {
            default: '#cccccc',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_CROSS]: {
            default: '#999999',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_TRIBE]: {
            default: '#0000DB',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_ALLY]: {
            default: '#00a0f4',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_ENEMY]: {
            default: '#ED1212',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_FRIENDLY]: {
            default: '#BF4DA4',
            inputType: 'color',
            update: true
        },
        [SETTINGS.COLOR_GHOST]: {
            default: '#3E551C',
            inputType: 'color',
            update: true
        }
    }
})
