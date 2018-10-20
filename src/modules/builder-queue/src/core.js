define('two/builder', [
    'two/locale',
    'two/utils',
    'two/eventQueue',
    'two/ready',
    'Lockr',
    'conf/upgradeabilityStates',
    'conf/buildingTypes',
    'conf/locationTypes'
], function (
    Locale,
    utils,
    eventQueue,
    ready,
    Lockr,
    UPGRADEABILITY_STATES,
    BUILDING_TYPES,
    LOCATION_TYPES
) {
    var buildingService = injector.get('buildingService')
    var initialized = false
    var running = false
    var buildingSequeOrder
    var localSettings
    var intervalCheckId
    var ANALYSES_PER_MINUTE = 1
    var VILLAGE_BUILDINGS = {}
    var groupList
    var player
    var buildLog
    var settings = {}
    var defaultBuildingOrders = {}

    defaultBuildingOrders['Essential'] = [
        BUILDING_TYPES.HEADQUARTER, // 1
        BUILDING_TYPES.FARM, // 1
        BUILDING_TYPES.WAREHOUSE, // 1
        BUILDING_TYPES.RALLY_POINT, // 1
        BUILDING_TYPES.BARRACKS, // 1

        // Quest: The Resources
        BUILDING_TYPES.TIMBER_CAMP, // 1
        BUILDING_TYPES.TIMBER_CAMP, // 2
        BUILDING_TYPES.CLAY_PIT, // 1
        BUILDING_TYPES.IRON_MINE, // 1

        BUILDING_TYPES.HEADQUARTER, // 2
        BUILDING_TYPES.RALLY_POINT, // 2

        // Quest: First Steps
        BUILDING_TYPES.FARM, // 2
        BUILDING_TYPES.WAREHOUSE, // 2
        
        // Quest: Laying Down Foundation
        BUILDING_TYPES.CLAY_PIT, // 2
        BUILDING_TYPES.IRON_MINE, // 2

        // Quest: More Resources
        BUILDING_TYPES.TIMBER_CAMP, // 3
        BUILDING_TYPES.CLAY_PIT, // 3
        BUILDING_TYPES.IRON_MINE, // 3
        
        // Quest: Resource Building
        BUILDING_TYPES.WAREHOUSE, // 3
        BUILDING_TYPES.TIMBER_CAMP, // 4
        BUILDING_TYPES.CLAY_PIT, // 4
        BUILDING_TYPES.IRON_MINE, // 4

        // Quest: Get an Overview
        BUILDING_TYPES.WAREHOUSE, // 4
        BUILDING_TYPES.TIMBER_CAMP, // 5
        BUILDING_TYPES.CLAY_PIT, // 5
        BUILDING_TYPES.IRON_MINE, // 5

        // Quest: Capital
        BUILDING_TYPES.FARM, // 3
        BUILDING_TYPES.WAREHOUSE, // 5
        BUILDING_TYPES.HEADQUARTER, // 3

        // Quest: The Hero
        BUILDING_TYPES.STATUE, // 1

        // Quest: Resource Expansions
        BUILDING_TYPES.TIMBER_CAMP, // 6
        BUILDING_TYPES.CLAY_PIT, // 6
        BUILDING_TYPES.IRON_MINE, // 6
        
        // Quest: Military
        BUILDING_TYPES.BARRACKS, // 2

        // Quest: The Hospital
        BUILDING_TYPES.HEADQUARTER, // 4
        BUILDING_TYPES.TIMBER_CAMP, // 7
        BUILDING_TYPES.CLAY_PIT, // 7
        BUILDING_TYPES.IRON_MINE, // 7
        BUILDING_TYPES.FARM, // 4
        BUILDING_TYPES.HOSPITAL, // 1

        // Quest: Resources
        BUILDING_TYPES.TIMBER_CAMP, // 8
        BUILDING_TYPES.CLAY_PIT, // 8
        BUILDING_TYPES.IRON_MINE, // 8

        // Quest: The Wall
        BUILDING_TYPES.WAREHOUSE, // 6
        BUILDING_TYPES.HEADQUARTER, // 5
        BUILDING_TYPES.WALL, // 1
        
        // Quest: Village Improvements
        BUILDING_TYPES.TIMBER_CAMP, // 9
        BUILDING_TYPES.CLAY_PIT, // 9
        BUILDING_TYPES.IRON_MINE, // 9
        BUILDING_TYPES.TIMBER_CAMP, // 10
        BUILDING_TYPES.CLAY_PIT, // 10
        BUILDING_TYPES.IRON_MINE, // 10
        BUILDING_TYPES.FARM, // 5

        BUILDING_TYPES.FARM, // 6
        BUILDING_TYPES.FARM, // 7

        // Quest: Hard work
        BUILDING_TYPES.TIMBER_CAMP, // 11
        BUILDING_TYPES.CLAY_PIT, // 11
        BUILDING_TYPES.IRON_MINE, // 11
        BUILDING_TYPES.TIMBER_CAMP, // 12
        BUILDING_TYPES.CLAY_PIT, // 12
        BUILDING_TYPES.IRON_MINE, // 12

        // Quest: The way of defence
        BUILDING_TYPES.BARRACKS, // 3

        BUILDING_TYPES.WAREHOUSE, // 7
        BUILDING_TYPES.WAREHOUSE, // 8
        BUILDING_TYPES.FARM, // 8
        BUILDING_TYPES.WAREHOUSE, // 9
        BUILDING_TYPES.WAREHOUSE, // 10

        // Quest: Market Barker
        BUILDING_TYPES.HEADQUARTER, // 6
        BUILDING_TYPES.MARKET, // 1

        // Quest: Preparations
        BUILDING_TYPES.BARRACKS, // 4
        BUILDING_TYPES.WALL, // 2
        BUILDING_TYPES.WALL, // 3

        BUILDING_TYPES.FARM, // 9
        BUILDING_TYPES.FARM, // 10

        BUILDING_TYPES.BARRACKS, // 5
        BUILDING_TYPES.WAREHOUSE, // 11
        BUILDING_TYPES.FARM, // 11

        BUILDING_TYPES.BARRACKS, // 6
        BUILDING_TYPES.WAREHOUSE, // 12
        BUILDING_TYPES.FARM, // 12

        BUILDING_TYPES.BARRACKS, // 7
        BUILDING_TYPES.WAREHOUSE, // 13
        BUILDING_TYPES.FARM, // 13

        BUILDING_TYPES.WALL, // 4
        BUILDING_TYPES.WALL, // 5
        BUILDING_TYPES.WALL, // 6

        BUILDING_TYPES.MARKET, // 2
        BUILDING_TYPES.MARKET, // 3
        BUILDING_TYPES.MARKET, // 4
        
        BUILDING_TYPES.BARRACKS, // 8
        BUILDING_TYPES.BARRACKS, // 9

        BUILDING_TYPES.HEADQUARTER, // 7
        BUILDING_TYPES.HEADQUARTER, // 8
        
        BUILDING_TYPES.TAVERN, // 1
        BUILDING_TYPES.TAVERN, // 2
        BUILDING_TYPES.TAVERN, // 3

        BUILDING_TYPES.RALLY_POINT, // 3

        BUILDING_TYPES.BARRACKS, // 10
        BUILDING_TYPES.BARRACKS, // 11

        BUILDING_TYPES.WAREHOUSE, // 14
        BUILDING_TYPES.FARM, // 14

        BUILDING_TYPES.WAREHOUSE, // 15
        BUILDING_TYPES.FARM, // 15

        BUILDING_TYPES.BARRACKS, // 12
        BUILDING_TYPES.BARRACKS, // 13

        BUILDING_TYPES.STATUE, // 2
        BUILDING_TYPES.STATUE, // 3

        BUILDING_TYPES.WALL, // 7
        BUILDING_TYPES.WALL, // 8

        BUILDING_TYPES.HEADQUARTER, // 9
        BUILDING_TYPES.HEADQUARTER, // 10

        BUILDING_TYPES.WAREHOUSE, // 16
        BUILDING_TYPES.FARM, // 16
        BUILDING_TYPES.FARM, // 17

        BUILDING_TYPES.IRON_MINE, // 13
        BUILDING_TYPES.IRON_MINE, // 14
        BUILDING_TYPES.IRON_MINE, // 15

        BUILDING_TYPES.WAREHOUSE, // 17

        BUILDING_TYPES.BARRACKS, // 14
        BUILDING_TYPES.BARRACKS, // 15

        BUILDING_TYPES.WAREHOUSE, // 18
        BUILDING_TYPES.FARM, // 18

        BUILDING_TYPES.WALL, // 9
        BUILDING_TYPES.WALL, // 10

        BUILDING_TYPES.TAVERN, // 4
        BUILDING_TYPES.TAVERN, // 5
        BUILDING_TYPES.TAVERN, // 6

        BUILDING_TYPES.MARKET, // 5
        BUILDING_TYPES.MARKET, // 6
        BUILDING_TYPES.MARKET, // 7

        BUILDING_TYPES.WAREHOUSE, // 19
        BUILDING_TYPES.FARM, // 19
        BUILDING_TYPES.WAREHOUSE, // 20
        BUILDING_TYPES.FARM, // 20
        BUILDING_TYPES.WAREHOUSE, // 21
        BUILDING_TYPES.FARM, // 21

        BUILDING_TYPES.IRON_MINE, // 16
        BUILDING_TYPES.IRON_MINE, // 17
        BUILDING_TYPES.IRON_MINE, // 18

        BUILDING_TYPES.RALLY_POINT, // 4

        BUILDING_TYPES.BARRACKS, // 16
        BUILDING_TYPES.BARRACKS, // 17

        BUILDING_TYPES.FARM, // 22
        BUILDING_TYPES.FARM, // 23
        BUILDING_TYPES.FARM, // 24
        BUILDING_TYPES.FARM, // 25

        BUILDING_TYPES.WAREHOUSE, // 22
        BUILDING_TYPES.WAREHOUSE, // 23

        BUILDING_TYPES.HEADQUARTER, // 11
        BUILDING_TYPES.HEADQUARTER, // 12

        BUILDING_TYPES.STATUE, // 4
        BUILDING_TYPES.STATUE, // 5

        BUILDING_TYPES.FARM, // 26
        BUILDING_TYPES.BARRACKS, // 18

        BUILDING_TYPES.HEADQUARTER, // 14
        BUILDING_TYPES.HEADQUARTER, // 15

        BUILDING_TYPES.FARM, // 27
        BUILDING_TYPES.BARRACKS, // 19

        BUILDING_TYPES.HEADQUARTER, // 15
        BUILDING_TYPES.HEADQUARTER, // 16

        BUILDING_TYPES.BARRACKS, // 20

        BUILDING_TYPES.HEADQUARTER, // 17
        BUILDING_TYPES.HEADQUARTER, // 18
        BUILDING_TYPES.HEADQUARTER, // 19
        BUILDING_TYPES.HEADQUARTER, // 20

        BUILDING_TYPES.ACADEMY, // 1

        BUILDING_TYPES.FARM, // 28
        BUILDING_TYPES.WAREHOUSE, // 23
        BUILDING_TYPES.WAREHOUSE, // 24
        BUILDING_TYPES.WAREHOUSE, // 25

        BUILDING_TYPES.MARKET, // 8
        BUILDING_TYPES.MARKET, // 9
        BUILDING_TYPES.MARKET, // 10

        BUILDING_TYPES.TIMBER_CAMP, // 13
        BUILDING_TYPES.CLAY_PIT, // 13
        BUILDING_TYPES.IRON_MINE, // 19

        BUILDING_TYPES.TIMBER_CAMP, // 14
        BUILDING_TYPES.CLAY_PIT, // 14
        BUILDING_TYPES.TIMBER_CAMP, // 15
        BUILDING_TYPES.CLAY_PIT, // 15

        BUILDING_TYPES.TIMBER_CAMP, // 16
        BUILDING_TYPES.TIMBER_CAMP, // 17

        BUILDING_TYPES.WALL, // 11
        BUILDING_TYPES.WALL, // 12

        BUILDING_TYPES.MARKET, // 11
        BUILDING_TYPES.MARKET, // 12
        BUILDING_TYPES.MARKET, // 13

        BUILDING_TYPES.TIMBER_CAMP, // 18
        BUILDING_TYPES.CLAY_PIT, // 16
        BUILDING_TYPES.TIMBER_CAMP, // 19
        BUILDING_TYPES.CLAY_PIT, // 17

        BUILDING_TYPES.TAVERN, // 7
        BUILDING_TYPES.TAVERN, // 8
        BUILDING_TYPES.TAVERN, // 9

        BUILDING_TYPES.WALL, // 13
        BUILDING_TYPES.WALL, // 14

        BUILDING_TYPES.TIMBER_CAMP, // 20
        BUILDING_TYPES.CLAY_PIT, // 18
        BUILDING_TYPES.IRON_MINE, // 20

        BUILDING_TYPES.TIMBER_CAMP, // 21
        BUILDING_TYPES.CLAY_PIT, // 19
        BUILDING_TYPES.IRON_MINE, // 21

        BUILDING_TYPES.BARRACKS, // 21
        BUILDING_TYPES.BARRACKS, // 22
        BUILDING_TYPES.BARRACKS, // 23

        BUILDING_TYPES.FARM, // 29
        BUILDING_TYPES.WAREHOUSE, // 26
        BUILDING_TYPES.WAREHOUSE, // 27

        BUILDING_TYPES.TAVERN, // 10
        BUILDING_TYPES.TAVERN, // 11
        BUILDING_TYPES.TAVERN, // 12

        BUILDING_TYPES.TIMBER_CAMP, // 22
        BUILDING_TYPES.CLAY_PIT, // 20
        BUILDING_TYPES.IRON_MINE, // 22

        BUILDING_TYPES.TIMBER_CAMP, // 23
        BUILDING_TYPES.CLAY_PIT, // 21
        BUILDING_TYPES.IRON_MINE, // 23

        BUILDING_TYPES.TIMBER_CAMP, // 24
        BUILDING_TYPES.CLAY_PIT, // 22
        BUILDING_TYPES.IRON_MINE, // 24

        BUILDING_TYPES.BARRACKS, // 24
        BUILDING_TYPES.BARRACKS, // 25

        BUILDING_TYPES.FARM, // 30
        BUILDING_TYPES.WAREHOUSE, // 28
        BUILDING_TYPES.WAREHOUSE, // 29

        BUILDING_TYPES.WALL, // 15
        BUILDING_TYPES.WALL, // 16
        BUILDING_TYPES.WALL, // 17
        BUILDING_TYPES.WALL, // 18

        BUILDING_TYPES.TAVERN, // 13
        BUILDING_TYPES.TAVERN, // 14

        BUILDING_TYPES.RALLY_POINT, // 5

        BUILDING_TYPES.TIMBER_CAMP, // 25
        BUILDING_TYPES.CLAY_PIT, // 23
        BUILDING_TYPES.IRON_MINE, // 25

        BUILDING_TYPES.TIMBER_CAMP, // 26
        BUILDING_TYPES.CLAY_PIT, // 24
        BUILDING_TYPES.IRON_MINE, // 26

        BUILDING_TYPES.TIMBER_CAMP, // 27
        BUILDING_TYPES.CLAY_PIT, // 25
        BUILDING_TYPES.IRON_MINE, // 27

        BUILDING_TYPES.TIMBER_CAMP, // 28
        BUILDING_TYPES.CLAY_PIT, // 26
        BUILDING_TYPES.IRON_MINE, // 28

        BUILDING_TYPES.TIMBER_CAMP, // 29
        BUILDING_TYPES.CLAY_PIT, // 27
        BUILDING_TYPES.CLAY_PIT, // 28
        BUILDING_TYPES.IRON_MINE, // 29

        BUILDING_TYPES.TIMBER_CAMP, // 30
        BUILDING_TYPES.CLAY_PIT, // 29
        BUILDING_TYPES.CLAY_PIT, // 30
        BUILDING_TYPES.IRON_MINE, // 30

        BUILDING_TYPES.WALL, // 19
        BUILDING_TYPES.WALL, // 20
    ]

    defaultBuildingOrders['Full Village'] = [
        BUILDING_TYPES.HOSPITAL, // 2
        BUILDING_TYPES.HOSPITAL, // 3
        BUILDING_TYPES.HOSPITAL, // 4
        BUILDING_TYPES.HOSPITAL, // 5

        BUILDING_TYPES.MARKET, // 14
        BUILDING_TYPES.MARKET, // 15
        BUILDING_TYPES.MARKET, // 16
        BUILDING_TYPES.MARKET, // 17

        BUILDING_TYPES.HEADQUARTER, // 21
        BUILDING_TYPES.HEADQUARTER, // 22
        BUILDING_TYPES.HEADQUARTER, // 23
        BUILDING_TYPES.HEADQUARTER, // 24
        BUILDING_TYPES.HEADQUARTER, // 25

        BUILDING_TYPES.PRECEPTORY, // 1

        BUILDING_TYPES.HOSPITAL, // 6
        BUILDING_TYPES.HOSPITAL, // 7
        BUILDING_TYPES.HOSPITAL, // 8
        BUILDING_TYPES.HOSPITAL, // 9
        BUILDING_TYPES.HOSPITAL, // 10

        BUILDING_TYPES.MARKET, // 18
        BUILDING_TYPES.MARKET, // 19
        BUILDING_TYPES.MARKET, // 20
        BUILDING_TYPES.MARKET, // 21

        BUILDING_TYPES.PRECEPTORY, // 2
        BUILDING_TYPES.PRECEPTORY, // 3

        BUILDING_TYPES.MARKET, // 22
        BUILDING_TYPES.MARKET, // 23
        BUILDING_TYPES.MARKET, // 24
        BUILDING_TYPES.MARKET, // 25

        BUILDING_TYPES.HEADQUARTER, // 26
        BUILDING_TYPES.HEADQUARTER, // 27
        BUILDING_TYPES.HEADQUARTER, // 28
        BUILDING_TYPES.HEADQUARTER, // 29
        BUILDING_TYPES.HEADQUARTER, // 30

        BUILDING_TYPES.PRECEPTORY, // 4
        BUILDING_TYPES.PRECEPTORY, // 5
        BUILDING_TYPES.PRECEPTORY, // 6
        BUILDING_TYPES.PRECEPTORY, // 7
        BUILDING_TYPES.PRECEPTORY, // 8
        BUILDING_TYPES.PRECEPTORY, // 9
        BUILDING_TYPES.PRECEPTORY, // 10
    ]

    defaultBuildingOrders['War Build'] = [
        BUILDING_TYPES.HEADQUARTER, // 1
        BUILDING_TYPES.FARM, // 1
        BUILDING_TYPES.WAREHOUSE, // 1
        BUILDING_TYPES.RALLY_POINT, // 1
        BUILDING_TYPES.BARRACKS, // 1

        // Quest: The Resources
        BUILDING_TYPES.TIMBER_CAMP, // 1
        BUILDING_TYPES.TIMBER_CAMP, // 2
        BUILDING_TYPES.CLAY_PIT, // 1
        BUILDING_TYPES.IRON_MINE, // 1

        BUILDING_TYPES.HEADQUARTER, // 2
        BUILDING_TYPES.RALLY_POINT, // 2

        // Quest: First Steps
        BUILDING_TYPES.FARM, // 2
        BUILDING_TYPES.WAREHOUSE, // 2
        
        // Quest: Laying Down Foundation
        BUILDING_TYPES.CLAY_PIT, // 2
        BUILDING_TYPES.IRON_MINE, // 2

        // Quest: More Resources
        BUILDING_TYPES.TIMBER_CAMP, // 3
        BUILDING_TYPES.CLAY_PIT, // 3
        BUILDING_TYPES.IRON_MINE, // 3
        
        // Quest: Resource Building
        BUILDING_TYPES.WAREHOUSE, // 3
        BUILDING_TYPES.TIMBER_CAMP, // 4
        BUILDING_TYPES.CLAY_PIT, // 4
        BUILDING_TYPES.IRON_MINE, // 4

        // Quest: Get an Overview
        BUILDING_TYPES.WAREHOUSE, // 4
        BUILDING_TYPES.TIMBER_CAMP, // 5
        BUILDING_TYPES.CLAY_PIT, // 5
        BUILDING_TYPES.IRON_MINE, // 5

        // Quest: Capital
        BUILDING_TYPES.FARM, // 3
        BUILDING_TYPES.WAREHOUSE, // 5
        BUILDING_TYPES.HEADQUARTER, // 3

        // Quest: The Hero
        BUILDING_TYPES.STATUE, // 1

        // Quest: Resource Expansions
        BUILDING_TYPES.TIMBER_CAMP, // 6
        BUILDING_TYPES.CLAY_PIT, // 6
        BUILDING_TYPES.IRON_MINE, // 6
        
        // Quest: Military
        BUILDING_TYPES.BARRACKS, // 2

        // Quest: The Hospital
        BUILDING_TYPES.HEADQUARTER, // 4
        BUILDING_TYPES.TIMBER_CAMP, // 7
        BUILDING_TYPES.CLAY_PIT, // 7
        BUILDING_TYPES.IRON_MINE, // 7
        BUILDING_TYPES.FARM, // 4
        BUILDING_TYPES.HOSPITAL, // 1

        // Quest: Resources
        BUILDING_TYPES.TIMBER_CAMP, // 8
        BUILDING_TYPES.CLAY_PIT, // 8
        BUILDING_TYPES.IRON_MINE, // 8

        // Quest: The Wall
        BUILDING_TYPES.WAREHOUSE, // 6
        BUILDING_TYPES.HEADQUARTER, // 5
        BUILDING_TYPES.WALL, // 1
        
        // Quest: Village Improvements
        BUILDING_TYPES.TIMBER_CAMP, // 9
        BUILDING_TYPES.CLAY_PIT, // 9
        BUILDING_TYPES.IRON_MINE, // 9
        BUILDING_TYPES.TIMBER_CAMP, // 10
        BUILDING_TYPES.CLAY_PIT, // 10
        BUILDING_TYPES.IRON_MINE, // 10
        BUILDING_TYPES.FARM, // 5

        // Quest: Hard work
        BUILDING_TYPES.TIMBER_CAMP, // 11
        BUILDING_TYPES.CLAY_PIT, // 11
        BUILDING_TYPES.IRON_MINE, // 11
        BUILDING_TYPES.TIMBER_CAMP, // 12
        BUILDING_TYPES.CLAY_PIT, // 12
        BUILDING_TYPES.IRON_MINE, // 12

        // Quest: The way of defence
        BUILDING_TYPES.BARRACKS, // 3

        BUILDING_TYPES.FARM, // 6
        BUILDING_TYPES.WAREHOUSE, // 7
        BUILDING_TYPES.FARM, // 7
        BUILDING_TYPES.WAREHOUSE, // 8
        BUILDING_TYPES.FARM, // 8
        BUILDING_TYPES.WAREHOUSE, // 9
        BUILDING_TYPES.WAREHOUSE, // 10

        // Quest: Market Barker
        BUILDING_TYPES.HEADQUARTER, // 6
        BUILDING_TYPES.MARKET, // 1

        // Quest: Preparations
        BUILDING_TYPES.BARRACKS, // 4
        BUILDING_TYPES.WALL, // 2
        BUILDING_TYPES.WALL, // 3

        BUILDING_TYPES.FARM, // 9
        BUILDING_TYPES.FARM, // 10

        BUILDING_TYPES.BARRACKS, // 5
        BUILDING_TYPES.WAREHOUSE, // 11
        BUILDING_TYPES.FARM, // 11

        BUILDING_TYPES.BARRACKS, // 6
        BUILDING_TYPES.WAREHOUSE, // 12
        BUILDING_TYPES.FARM, // 12

        BUILDING_TYPES.BARRACKS, // 7
        BUILDING_TYPES.WAREHOUSE, // 13
        BUILDING_TYPES.FARM, // 13

        BUILDING_TYPES.WALL, // 4
        BUILDING_TYPES.WALL, // 5
        BUILDING_TYPES.WALL, // 6

        BUILDING_TYPES.MARKET, // 2
        BUILDING_TYPES.MARKET, // 3
        BUILDING_TYPES.MARKET, // 4
        
        BUILDING_TYPES.BARRACKS, // 8
        BUILDING_TYPES.BARRACKS, // 9

        BUILDING_TYPES.HEADQUARTER, // 7
        BUILDING_TYPES.HEADQUARTER, // 8
        
        BUILDING_TYPES.TAVERN, // 1
        BUILDING_TYPES.TAVERN, // 2
        BUILDING_TYPES.TAVERN, // 3

        BUILDING_TYPES.RALLY_POINT, // 3

        BUILDING_TYPES.BARRACKS, // 10
        BUILDING_TYPES.BARRACKS, // 11

        BUILDING_TYPES.WAREHOUSE, // 14
        BUILDING_TYPES.FARM, // 14

        BUILDING_TYPES.WAREHOUSE, // 15
        BUILDING_TYPES.FARM, // 15

        BUILDING_TYPES.BARRACKS, // 12
        BUILDING_TYPES.BARRACKS, // 13

        BUILDING_TYPES.STATUE, // 2
        BUILDING_TYPES.STATUE, // 3

        BUILDING_TYPES.WALL, // 7
        BUILDING_TYPES.WALL, // 8

        BUILDING_TYPES.HEADQUARTER, // 9
        BUILDING_TYPES.HEADQUARTER, // 10

        BUILDING_TYPES.WAREHOUSE, // 16
        BUILDING_TYPES.FARM, // 16
        BUILDING_TYPES.FARM, // 17

        BUILDING_TYPES.IRON_MINE, // 13
        BUILDING_TYPES.IRON_MINE, // 14
        BUILDING_TYPES.IRON_MINE, // 15

        BUILDING_TYPES.WAREHOUSE, // 17

        BUILDING_TYPES.BARRACKS, // 14
        BUILDING_TYPES.BARRACKS, // 15

        BUILDING_TYPES.WAREHOUSE, // 18
        BUILDING_TYPES.FARM, // 18

        BUILDING_TYPES.WALL, // 9
        BUILDING_TYPES.WALL, // 10

        BUILDING_TYPES.TAVERN, // 4
        BUILDING_TYPES.TAVERN, // 5
        BUILDING_TYPES.TAVERN, // 6

        BUILDING_TYPES.MARKET, // 5
        BUILDING_TYPES.MARKET, // 6
        BUILDING_TYPES.MARKET, // 7

        BUILDING_TYPES.WAREHOUSE, // 19
        BUILDING_TYPES.FARM, // 19
        BUILDING_TYPES.WAREHOUSE, // 20
        BUILDING_TYPES.FARM, // 20
        BUILDING_TYPES.WAREHOUSE, // 21
        BUILDING_TYPES.FARM, // 21

        BUILDING_TYPES.IRON_MINE, // 16
        BUILDING_TYPES.IRON_MINE, // 17
        BUILDING_TYPES.IRON_MINE, // 18

        BUILDING_TYPES.RALLY_POINT, // 4

        BUILDING_TYPES.BARRACKS, // 16
        BUILDING_TYPES.BARRACKS, // 17

        BUILDING_TYPES.FARM, // 22
        BUILDING_TYPES.FARM, // 23
        BUILDING_TYPES.FARM, // 24
        BUILDING_TYPES.FARM, // 25

        BUILDING_TYPES.WAREHOUSE, // 22
        BUILDING_TYPES.WAREHOUSE, // 23

        BUILDING_TYPES.HEADQUARTER, // 11
        BUILDING_TYPES.HEADQUARTER, // 12

        BUILDING_TYPES.STATUE, // 4
        BUILDING_TYPES.STATUE, // 5

        BUILDING_TYPES.FARM, // 26
        BUILDING_TYPES.BARRACKS, // 18

        BUILDING_TYPES.HEADQUARTER, // 14
        BUILDING_TYPES.HEADQUARTER, // 15

        BUILDING_TYPES.FARM, // 27
        BUILDING_TYPES.BARRACKS, // 19

        BUILDING_TYPES.HEADQUARTER, // 15
        BUILDING_TYPES.HEADQUARTER, // 16

        BUILDING_TYPES.BARRACKS, // 20

        BUILDING_TYPES.HEADQUARTER, // 17
        BUILDING_TYPES.HEADQUARTER, // 18
        BUILDING_TYPES.HEADQUARTER, // 19
        BUILDING_TYPES.HEADQUARTER, // 20

        BUILDING_TYPES.ACADEMY, // 1
        
        BUILDING_TYPES.HEADQUARTER, // 21
        BUILDING_TYPES.HEADQUARTER, // 22
        BUILDING_TYPES.HEADQUARTER, // 23
        BUILDING_TYPES.HEADQUARTER, // 24
        BUILDING_TYPES.HEADQUARTER, // 25
        
        BUILDING_TYPES.PRECEPTORY, // 1

        BUILDING_TYPES.FARM, // 28
        BUILDING_TYPES.WAREHOUSE, // 23
        BUILDING_TYPES.WAREHOUSE, // 24
        BUILDING_TYPES.WAREHOUSE, // 25

        BUILDING_TYPES.MARKET, // 8
        BUILDING_TYPES.MARKET, // 9
        BUILDING_TYPES.MARKET, // 10

        BUILDING_TYPES.TIMBER_CAMP, // 13
        BUILDING_TYPES.CLAY_PIT, // 13
        BUILDING_TYPES.IRON_MINE, // 19

        BUILDING_TYPES.TIMBER_CAMP, // 14
        BUILDING_TYPES.CLAY_PIT, // 14
        BUILDING_TYPES.TIMBER_CAMP, // 15
        BUILDING_TYPES.CLAY_PIT, // 15

        BUILDING_TYPES.TIMBER_CAMP, // 16
        BUILDING_TYPES.TIMBER_CAMP, // 17

        BUILDING_TYPES.WALL, // 11
        BUILDING_TYPES.WALL, // 12

        BUILDING_TYPES.MARKET, // 11
        BUILDING_TYPES.MARKET, // 12
        BUILDING_TYPES.MARKET, // 13

        BUILDING_TYPES.TIMBER_CAMP, // 18
        BUILDING_TYPES.CLAY_PIT, // 16
        BUILDING_TYPES.TIMBER_CAMP, // 19
        BUILDING_TYPES.CLAY_PIT, // 17

        BUILDING_TYPES.TAVERN, // 7
        BUILDING_TYPES.TAVERN, // 8
        BUILDING_TYPES.TAVERN, // 9

        BUILDING_TYPES.WALL, // 13
        BUILDING_TYPES.WALL, // 14

        BUILDING_TYPES.TIMBER_CAMP, // 20
        BUILDING_TYPES.CLAY_PIT, // 18
        BUILDING_TYPES.IRON_MINE, // 20

        BUILDING_TYPES.TIMBER_CAMP, // 21
        BUILDING_TYPES.CLAY_PIT, // 19
        BUILDING_TYPES.IRON_MINE, // 21

        BUILDING_TYPES.BARRACKS, // 21
        BUILDING_TYPES.BARRACKS, // 22
        BUILDING_TYPES.BARRACKS, // 23

        BUILDING_TYPES.FARM, // 29
        BUILDING_TYPES.WAREHOUSE, // 26
        BUILDING_TYPES.WAREHOUSE, // 27

        BUILDING_TYPES.TAVERN, // 10
        BUILDING_TYPES.TAVERN, // 11
        BUILDING_TYPES.TAVERN, // 12

        BUILDING_TYPES.TIMBER_CAMP, // 22
        BUILDING_TYPES.CLAY_PIT, // 20
        BUILDING_TYPES.IRON_MINE, // 22

        BUILDING_TYPES.CLAY_PIT, // 21
        BUILDING_TYPES.CLAY_PIT, // 22

        BUILDING_TYPES.BARRACKS, // 24
        BUILDING_TYPES.BARRACKS, // 25

        BUILDING_TYPES.FARM, // 30
        BUILDING_TYPES.WAREHOUSE, // 28
        BUILDING_TYPES.WAREHOUSE, // 29

        BUILDING_TYPES.WALL, // 15
        BUILDING_TYPES.WALL, // 16
        BUILDING_TYPES.WALL, // 17
        BUILDING_TYPES.WALL, // 18

        BUILDING_TYPES.TAVERN, // 13
        BUILDING_TYPES.TAVERN, // 14

        BUILDING_TYPES.RALLY_POINT, // 5

        BUILDING_TYPES.WALL, // 19
        BUILDING_TYPES.WALL // 20
    ]
    
    Array.prototype.unshift.apply(
        defaultBuildingOrders['Full Village'],
        defaultBuildingOrders['Essential']
    )

    defaultBuildingOrders['Essential Without Wall'] =
        defaultBuildingOrders['Essential'].filter(function (building) {
            return building !== BUILDING_TYPES.WALL
        })

    defaultBuildingOrders['Full Wall'] = [
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL // 20
    ]

    var settingsMap = {
        groupVillages: {
            default: '',
            inputType: 'select'
        },
        buildingPreset: {
            default: 'Essential',
            inputType: 'select'
        },
        buildingOrder: {
            default: defaultBuildingOrders,
            inputType: 'buildingOrder'
        }
    }

    for (var buildingName in BUILDING_TYPES) {
        VILLAGE_BUILDINGS[BUILDING_TYPES[buildingName]] = 0
    }

    var init = function init () {
        Locale.create('builder', __builder_locale, 'en')

        initialized = true
        localSettings = Lockr.get('builder-settings', {}, true)
        buildLog = Lockr.get('builder-log', [], true)
        player = modelDataService.getSelectedCharacter()
        groupList = modelDataService.getGroupList()

        for (var key in settingsMap) {
            var defaultValue = settingsMap[key].default

            settings[key] = localSettings.hasOwnProperty(key)
                ? localSettings[key]
                : defaultValue
        }

        buildingOrderLimit = getSequenceLimit(settings.buildingPreset)

        rootScope.$on(eventTypeProvider.BUILDING_LEVEL_CHANGED, function (event, data) {
            if (!running) {
                return false
            }

            setTimeout(function () {
                var village = player.getVillage(data.village_id)
                analyseVillageBuildings(village)
            }, 1000)
        })
    }

    /**
     * Loop all player villages, check if ready and init the building analyse
     * for each village.
     */
    var analyseVillages = function analyseVillages () {
        var villageIds = settings.groupVillages
            ? groupList.getGroupVillageIds(settings.groupVillages)
            : getVillageIds()

        villageIds.forEach(function (id) {
            var village = player.getVillage(id)
            var readyState = village.checkReadyState()
            var queue = village.buildingQueue

            if (queue.getAmountJobs() === queue.getUnlockedSlots()) {
                return false
            }

            if (!readyState.buildingQueue || !readyState.buildings) {
                return false
            }

            if (!village.isInitialized()) {
                villageService.initializeVillage(village)
            }

            analyseVillageBuildings(village)
        })
    }

    /**
     * Generate an Array with all player's village IDs.
     *
     * @return {Array}
     */
    var getVillageIds = function () {
        var ids = []
        var villages = player.getVillages()

        for (var id in villages) {
            ids.push(id)
        }

        return ids
    }

    /**
     * Loop all village buildings, start build job if available.
     *
     * @param {VillageModel} village
     */
    var analyseVillageBuildings = function analyseVillageBuildings (village) {
        var buildingLevels = angular.copy(village.buildingData.getBuildingLevels())
        var currentQueue = village.buildingQueue.getQueue()
        var buildingOrder = angular.copy(VILLAGE_BUILDINGS)

        currentQueue.forEach(function (job) {
            buildingLevels[job.building]++
        })

        if (checkVillageBuildingLimit(buildingLevels)) {
            return false
        }

        settings.buildingOrder[settings.buildingPreset].some(function (buildingName) {
            if (++buildingOrder[buildingName] > buildingLevels[buildingName]) {
                buildingService.compute(village)

                upgradeBuilding(village, buildingName, function (jobAdded, data) {
                    if (jobAdded) {
                        var now = Date.now()
                        var logData = [
                            {
                                x: village.getX(),
                                y: village.getY(),
                                name: village.getName(),
                                id: village.getId()
                            },
                            data.job.building,
                            data.job.level,
                            now
                        ]

                        eventQueue.trigger('Builder/jobStarted', logData)
                        buildLog.unshift(logData)
                        Lockr.set('builder-log', buildLog)
                    }
                })

                return true
            }
        })
    }

    /**
     * Init a build job
     *
     * @param {VillageModel} village
     * @param {String} buildingName - Building to be build.
     * @param {Function} callback
     */
    var upgradeBuilding = function upgradeBuilding (village, buildingName, callback) {
        var buildingData = village.getBuildingData().getDataForBuilding(buildingName)

        if (buildingData.upgradeability === UPGRADEABILITY_STATES.POSSIBLE) {
            socketService.emit(routeProvider.VILLAGE_UPGRADE_BUILDING, {
                building: buildingName,
                village_id: village.getId(),
                location: LOCATION_TYPES.MASS_SCREEN,
                premium: false
            }, function (data, event) {
                callback(true, data)
            })
        } else {
            callback(false)
        }
    }

    /**
     * Check if all buildings from the order already reached
     * the specified level.
     *
     * @param {Object} buildingLevels - Current buildings level from the village.
     * @return {Boolean} True if the levels already reached the limit.
     */
    var checkVillageBuildingLimit = function checkVillageBuildingLimit (buildingLevels) {
        for (var buildingName in buildingLevels) {
            if (buildingLevels[buildingName] < buildingOrderLimit[buildingName]) {
                return false
            }
        }

        return true
    }

    /**
     * Check if the building order is valid by analysing if the
     * buildings exceed the maximum level.
     *
     * @param {Array} order
     * @return {Boolean}
     */
    var validSequence = function validSequence (order) {
        var buildingOrder = angular.copy(VILLAGE_BUILDINGS)
        var buildingData = modelDataService.getGameData().getBuildings()
        var invalid = false

        order.some(function (buildingName) {
            if (++buildingOrder[buildingName] > buildingData[buildingName].max_level) {
                invalid = true
                return true
            }
        })

        return invalid
    }

    /**
     * Get the level max for each building.
     *
     * @param {String} buildingPreset
     * @return {Object} Maximum level for each building.
     */
    var getSequenceLimit = function getSequenceLimit (buildingPreset) {
        var buildingOrder = settings.buildingOrder[buildingPreset]
        var orderLimit = angular.copy(VILLAGE_BUILDINGS)

        buildingOrder.forEach(function (buildingName) {
            orderLimit[buildingName]++
        })

        return orderLimit
    }

    /**
     * @param {Object} changes - New settings.
     * @return {Boolean} True if the internal settings changed.
     */
    var updateSettings = function updateSettings (changes) {
        var newValue
        var key

        for (key in changes) {
            if (!settingsMap[key]) {
                eventQueue.trigger('Builder/settings/unknownSetting', [key])

                return false
            }

            newValue = changes[key]

            if (angular.equals(settings[key], newValue)) {
                continue
            }

            settings[key] = newValue
        }

        buildingOrderLimit = getSequenceLimit(changes.buildingPreset)
        Lockr.set('builder-settings', settings)

        return true
    }

    var getSettings = function getSettings () {
        return settings
    }

    var start = function start () {
        running = true
        intervalCheckId = setInterval(analyseVillages, 60000 / ANALYSES_PER_MINUTE)
        ready(analyseVillages, ['all_villages_ready'])
        eventQueue.trigger('Builder/start')
    }

    var stop = function stop () {
        running = false
        clearInterval(intervalCheckId)
        eventQueue.trigger('Builder/stop')
    }

    var isInitialized = function isInitialized () {
        return initialized
    }

    var isRunning = function isRunning () {
        return running
    }

    var getBuildLog = function () {
        return buildLog
    }

    var clearLogs = function () {
        buildLog = []
        Lockr.set('builder-log', buildLog)
        eventQueue.trigger('Builder/clearLogs')
    }

    return {
        init: init,
        start: start,
        stop: stop,
        updateSettings: updateSettings,
        isRunning: isRunning,
        isInitialized: isInitialized,
        settingsMap: settingsMap,
        getSettings: getSettings,
        getBuildLog: getBuildLog,
        clearLogs: clearLogs,
        version: '__builder_version'
    }
})
