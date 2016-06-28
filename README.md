# Lucca

Lucca is a lightweight Express-style router for Koa (v1). It is named after the character Lucca from Chrono Trigger.

![Lucca's artwork](http://vignette2.wikia.nocookie.net/chrono/images/6/6a/Lucca2.png/revision/latest/scale-to-width-down/200)

# Use

```javascript
var app = require("koa")(),
    router = require("lucca")("main");

router.use(function*(next) {
  console.log("middle...");
  yield next;
  console.log("...ware!");
});

router.get("/", function*() {
  this.response.body = "Hello world!";
});

// Nested router
var child = require("lucca")("child");
child.get("/", function*() {});
child.post("/operation", require("authMiddleware")(), function*() {
  // stuff...
});

router.use("/child", child);

app.use(router);
app.listen(3000);
```

# Documentation

## lucca([name]) => `Router`

Returns a router.

Parameter|Type|Description
---------|----|-----------
[name]|String|Default is `anon`. Used by the `debug` output.

## Router

Routers are generator functions; they can be directly plugged into a Koa application.

### router.get|post|put|delete|…(route, …mw)

Adds a middleware to the router which will call the following middleware stack only if the request method and path match the given route and HTTP verb.

Parameter|Type|Description
---------|----|-----------
route|String|A `path-to-regexp` route.
…mw|Generator function(s)|A stack of middleware to be called if the route matches.

### router.use(…mw)

Adds one or multiple middlewares to the router.

Parameter|Type|Description
---------|----|-----------
…mw|Generator function(s)|A stack of middleware to be called if the route matches.

### router.use(prefix, …mw)

Mounts a middleware stack on a given path, the mount point. Every request matching the route will be handled by the given stack before the next middleware in the router stack.

Routers can be nested without taking into account the parent routes (like in Express): The `prefix` is removed from Koa's `context.path` for the given stack and restored for the router's following middlewares.

Parameter|Type|Description
---------|----|-----------
prefix|String|A `path-to-regexp` route. All its descendants will be matched.
…mw|Generator function(s)|A stack of middleware to be called if the route matches.
