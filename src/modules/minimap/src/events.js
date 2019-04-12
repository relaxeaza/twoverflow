define('two/minimap/Events', [], function () {
    angular.extend(eventTypeProvider, {
        MINIMAP_SETTINGS_RESET: 'minimap_settings_reset',
        MINIMAP_SETTINGS_SAVE: 'minimap_settings_save',
        MINIMAP_HIGHLIGHT_ADD: 'minimap_highlight_add',
        MINIMAP_HIGHLIGHT_UPDATE: 'minimap_highlight_update',
        MINIMAP_HIGHLIGHT_REMOVE: 'minimap_highlight_remove',
        MINIMAP_HIGHLIGHT_ADD_ERROR_EXISTS: 'minimap_highlight_add_error_exists',
        MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY: 'minimap_highlight_add_error_no_entry',
        MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR: 'minimap_highlight_add_error_invalid_color',
        MINIMAP_VILLAGE_CLICK: 'minimap_village_click',
        MINIMAP_VILLAGE_HOVER: 'minimap_village_hover',
        MINIMAP_VILLAGE_BLUR: 'minimap_village_blur',
        MINIMAP_MOUSE_LEAVE: 'minimap_mouse_leave',
        MINIMAP_START_MOVE: 'minimap_start_move',
        MINIMAP_STOP_MOVE: 'minimap_stop_move'
    })
})
