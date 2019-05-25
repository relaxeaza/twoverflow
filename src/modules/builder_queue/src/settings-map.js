define('two/builderQueue/settingsMap', [
    'two/builderQueue/defaultOrders',
    'two/builderQueue/settings'
], function (
    DEFAULT_ORDERS,
    SETTINGS
) {
    return {
        [SETTINGS.GROUP_VILLAGES]: {
            default: false,
            inputType: 'select',
            disabledOption: true,
            type: 'groups'
        },
        [SETTINGS.ACTIVE_SEQUENCE]: {
            default: 'Essential',
            inputType: 'select'
        },
        [SETTINGS.BUILDING_SEQUENCES]: {
            default: DEFAULT_ORDERS,
            inputType: 'buildingOrder'
        }
    }
})
