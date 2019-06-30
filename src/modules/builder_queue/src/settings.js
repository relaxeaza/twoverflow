define('two/builderQueue/settings', [], function () {
    return {
        GROUP_VILLAGES: 'group_villages',
        ACTIVE_SEQUENCE: 'building_sequence',
        BUILDING_SEQUENCES: 'building_orders',
        PRESERVE_WOOD: 'preserve_wood',
        PRESERVE_CLAY: 'preserve_clay',
        PRESERVE_IRON: 'preserve_iron'
    }
})

define('two/builderQueue/settings/map', [
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
        },
        [SETTINGS.PRESERVE_WOOD]: {
            default: 0
        },
        [SETTINGS.PRESERVE_CLAY]: {
            default: 0,
            inputType: 'number'
        },
        [SETTINGS.PRESERVE_IRON]: {
            default: 0
        }
    }
})
