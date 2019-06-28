/*!
 * __overflow_title v__overflow_version
 *
 * Copyright (C) 2019 Relaxeaza
 * This work is free. You can redistribute it and/or modify it under the
 * terms of the Do What The Fuck You Want To Public License, Version 2,
 * as published by Sam Hocevar. See the LICENCE file for more details.
 */

;(function (window, undefined) {

var $rootScope = injector.get('$rootScope')
var transferredSharedDataService = injector.get('transferredSharedDataService')
var modelDataService = injector.get('modelDataService')
var socketService = injector.get('socketService')
var routeProvider = injector.get('routeProvider')
var eventTypeProvider = injector.get('eventTypeProvider')
var windowDisplayService = injector.get('windowDisplayService')
var windowManagerService = injector.get('windowManagerService')
var angularHotkeys = injector.get('hotkeys')
var armyService = injector.get('armyService')
var villageService = injector.get('villageService')
var mapService = injector.get('mapService')
var $filter = injector.get('$filter')
var $timeout = injector.get('$timeout')
var storageService = injector.get('storageService')
var noop = function () {}
