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
