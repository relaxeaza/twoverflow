# EventScope

Used to attach temporary events while the window is opened.

### `new EventScope( window_id [, on_destroy ] )`

 - *String* `window_id` Id of the window template. Templates are created with `interfaceOverflow.addTemplate`
 - *Function* `on_destroy` Function called when the window is closed.

### `eventScope.register( id, handler )`

Register an event.

 - *String* `id` Event id. The complete list of events can be accessed via `eventTypeProvider`
 - *Function* `handler` Function called when the event is triggered.

### `eventScope.destroy()`

Destroy all registered events.

# interfaceOverflow

Used to create interface buttons and store/inject interface related data.

### `interfaceOverflow.addTemplate( path, data )`

Add a HTML template used to build windows.

 - *String* `path` Templates's ID.
 - *String* `data` Templates's HTML.

### `interfaceOverflow.addStyle( styles )`

Inject CSS styles into the document.

 - *String* `styles` CSS Stylesheet.

### `interfaceOverflow.addMenuButton( label, order [, _tooltip ] )`

Create an button inside the main menu.

 - *String* `label` Text label inside the button.
 - *Number* `order` The weight of the item from 1 to 99. The bigger number the lower it gets.
 - *String* `_tooltip` Tooltip text when hovering the button.

### `interfaceOverflow.addDivisor( order )`

Create an divisor inside the main menu.

 - *Number* `order` The weight of the item from 1 to 99. The bigger number the lower it gets.

### `interfaceOverflow.isInitialized()`

Return `true` if the interface is ready to be used.
