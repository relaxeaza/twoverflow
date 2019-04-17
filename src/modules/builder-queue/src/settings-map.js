define('two/builder/settingsMap', [
    'two/builder/defaultOrders',
    'two/builder/settings'
], function (
    DEFAULT_ORDERS,
    SETTINGS
) {
    return {
        [SETTINGS.GROUP_VILLAGES]: {
            default: '',
            inputType: 'select'
        },
        [SETTINGS.BUILDING_PRESET]: {
            default: 'Essential',
            inputType: 'select'
        },
        [SETTINGS.BUILDING_ORDERS]: {
            default: DEFAULT_ORDERS,
            inputType: 'buildingOrder'
        }
    }
})
