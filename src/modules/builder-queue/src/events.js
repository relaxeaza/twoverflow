define('two/builder/events', [], function () {
    angular.extend(eventTypeProvider, {
        BUILDER_QUEUE_JOB_STARTED: 'Builder/jobStarted',
        BUILDER_QUEUE_START: 'Builder/start',
        BUILDER_QUEUE_STOP: 'Builder/stop',
        BUILDER_QUEUE_UNKNOWN_SETTING: 'Builder/settings/unknownSetting',
        BUILDER_QUEUE_CLEAR_LOGS: 'Builder/clearLogs',
        BUILDER_QUEUE_BUILDING_ORDERS_UPDATED: 'Builder/buildingOrders/updated',
        BUILDER_QUEUE_BUILDING_ORDERS_ADDED: 'Builder/buildingOrders/added',
        BUILDER_QUEUE_BUILDING_ORDERS_REMOVED: 'Builder/buildingOrders/removed'
    })
})

