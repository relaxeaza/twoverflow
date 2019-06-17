define('two/farmOverflow/events', [], function () {
    angular.extend(eventTypeProvider, {
        // FARM_NO_PRESET: 'farmoverflow_no_preset',
        // FARM_NO_VILLAGE_SELECTED: 'farmoverflow_no_village_selected',
        // FARM_NO_TARGETS: 'farmoverflow_no_targets',
        // FARM_NO_UNITS: 'farmoverflow_no_units',
        // FARM_NO_UNITS_NO_COMMANDS: 'farmoverflow_no_units_no_commands',
        // FARM_COMMAND_LIMIT_SINGLE: 'farmoverflow_command_limit_single',
        // FARM_COMMAND_LIMIT_MULTI: 'farmoverflow_command_limit_multi',
        // FARM_FULL_STORAGE: 'farmoverflow_full_storage',
        // FARM_SEND_COMMAND: 'farmoverflow_send_command',
        // FARM_SEND_COMMAND_ERROR: 'farmoverflow_send_command_error',
        // FARM_VILLAGES_UPDATE: 'farmoverflow_villages_update',
        // FARM_PRESETS_LOADED: 'farmoverflow_presets_loaded',
        // FARM_PRIORITY_TARGET_ADDED: 'farmoverflow_priority_target_added',
        // FARM_REMOTE_COMMAND: 'farmoverflow_remote_command',
        // FARM_PRESETS_CHANGE: 'farmoverflow_presets_change',
        // FARM_GROUPS_CHANGED: 'farmoverflow_groups_changed',
        // FARM_LOGS_UPDATED: 'farmoverflow_logs_updated',
        // FARM_LOGS_RESETED: 'farmoverflow_logs_reseted',
        // FARM_IGNORED_VILLAGE: 'farmoverflow_ignored_village',
        // FARM_LOADING_TARGETS_START: 'farmoverflow_loading_targets_start',
        // FARM_LOADING_TARGETS_END: 'farmoverflow_loading_targets_end',
        // FARM_STATUS_CHANGE: 'farmoverflow_status_change',
        // FARM_START: 'farmoverflow_start',
        // FARM_PAUSE: 'farmoverflow_pause',
        // FARM_RESET_LOGS: 'farmoverflow_reset_logs',
        // FARM_SETTINGS_CHANGE: 'farmoverflow_settings_change',
        // FARM_IGNORED_TARGET: 'farmoverflow_ignored_target',
        // FARM_NEXT_VILLAGE: 'farmoverflow_next_village',
        // FARM_NO_VILLAGES: 'farmoverflow_no_villages',
        // FARM_STEP_CYCLE_RESTART: 'farmoverflow_step_cycle_restart',
        // FARM_STEP_CYCLE_START: 'farmoverflow_step_cycle_start',
        // FARM_STEP_CYCLE_END: 'farmoverflow_step_cycle_end',
        // FARM_STEP_CYCLE_NEXT: 'farmoverflow_step_cycle_next',
        // FARM_STEP_CYCLE_NEXT_NO_VILLAGES: 'farmoverflow_step_cycle_next_no_villages',
        // FARM_STEP_CYCLE_END_NO_VILLAGES: 'farmoverflow_step_cycle_end_no_villages',
        // FARM_ERROR: 'farmoverflow_error'

        FARM_OVERFLOW_START: 'farm_overflow_start',
        FARM_OVERFLOW_STOP: 'farm_overflow_stop',
        FARM_OVERFLOW_INSTANCE_READY: 'farm_overflow_instance_ready',
        FARM_OVERFLOW_INSTANCE_START: 'farm_overflow_instance_start',
        FARM_OVERFLOW_INSTANCE_STOP: 'farm_overflow_instance_stop',
        FARM_OVERFLOW_INSTANCE_ERROR_NO_TARGETS: 'farm_overflow_instance_error_no_targets',
        FARM_OVERFLOW_INSTANCE_ERROR_NOT_READY: 'farm_overflow_instance_error_not_ready',
        FARM_OVERFLOW_PRESETS_LOADED: 'farm_overflow_presets_loaded'
    })
})
