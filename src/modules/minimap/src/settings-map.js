define('two/minimap/settingsMap', [
    'two/minimap/settings',
    'two/minimap/actionTypes'
], function (
    SETTINGS,
    RIGHT_CLICK_ACTION_TYPES
) {
    return {
        [SETTINGS.RIGHT_CLICK_ACTION]: {
            default: RIGHT_CLICK_ACTION_TYPES.HIGHLIGHT_PLAYER,
            inputType: 'select',
            update: false
        },
        [SETTINGS.FLOATING_MINIMAP]: {
            default: false,
            inputType: 'checkbox',
            update: false
        },
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
            default: true,
            inputType: 'checkbox',
            update: true
        },
        [SETTINGS.SHOW_GHOST_VILLAGES]: {
            default: true,
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
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_BARBARIAN]: {
            default: '#969696',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_PLAYER]: {
            default: '#f0c800',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_TRIBE]: {
            default: '#0000DB',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_ALLY]: {
            default: '#00a0f4',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_ENEMY]: {
            default: '#ED1212',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_FRIENDLY]: {
            default: '#BF4DA4',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_UGLY]: {
            default: '#A96534',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_GHOST]: {
            default: '#3E551C',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_QUICK_HIGHLIGHT]: {
            default: '#ffffff',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_BACKGROUND]: {
            default: '#436213',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_PROVINCE]: {
            default: '#ffffff',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_CONTINENT]: {
            default: '#cccccc',
            inputType: 'colorPicker',
            update: true
        },
        [SETTINGS.COLOR_CROSS]: {
            default: '#999999',
            inputType: 'colorPicker',
            update: true
        }
    }
})
