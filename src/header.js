/*!
 * ___overflow_name v___overflow_version
 * ___overflow_date
 * Developed by ___overflow_author_name <___overflow_author_email>
 *
 * This work is free. You can redistribute it and/or modify it under the
 * terms of the Do What The Fuck You Want To Public License, Version 2,
 * as published by Sam Hocevar. See the LICENCE file for more details.
 */

;(function (window, undefined) {

const $rootScope = injector.get('$rootScope')
const transferredSharedDataService = injector.get('transferredSharedDataService')
const modelDataService = injector.get('modelDataService')
const socketService = injector.get('socketService')
const routeProvider = injector.get('routeProvider')
const eventTypeProvider = injector.get('eventTypeProvider')
const windowDisplayService = injector.get('windowDisplayService')
const windowManagerService = injector.get('windowManagerService')
const angularHotkeys = injector.get('hotkeys')
const armyService = injector.get('armyService')
const villageService = injector.get('villageService')
const mapService = injector.get('mapService')
const $filter = injector.get('$filter')
const $timeout = injector.get('$timeout')
const storageService = injector.get('storageService')
const reportService = injector.get('reportService')
const noop = function () {}

