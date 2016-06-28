/**
 * @file Router
 * @author sepsten
 */

var methods = require("methods"),
    compose = require("koa-compose"),
    pathMatch = require("path-match")();

/**
 * Returns a router.
 *
 * @param {String} name - The router's name
 */
module.exports = function(name) {
  name = name || "anon";
  var debug = require("debug")("router:" + name);

  var router = function*(next) {
    debug("enter");
    yield router.mw;
    yield next;
    debug("exit");
  };

  router.name = name;

  /**
   * Middleware stack.
   *
   * @type GeneratorFunction[]
   */
  router.stack = [];

  /**
   * Contains all the middleware composed.
   *
   * @type GeneratorFunction
   */
  router.mw = null;

  /**
   * Pushes a middleware to the stack.
   *
   * @private
   */
  router._push = function(mw) {
    router.stack.push(mw);
    router.mw = compose(router.stack);
  };

  /**
   * Adds middlewares to the stack or assign it to a specific route.
   *
   * @param {String} [route] - Path match
   * @param {GeneratorFunction[]} mw... - Middlewares
   */
  router.use = function(one, two) {
    if(typeof one === "function")
      // Compose and add all the middlewares passed as arguments
      router._push(compose(arguments));
    else if(typeof one === "string" && typeof two === "function") {
      // Routes a middleware

      // 1. Name arguments
      let route = one;
      let mw = compose(Array.prototype.slice.call(arguments, 1));

      // 2. Create path test function
      let re = route;
      if(re[route.length-1] !== "/") re += "/"; // Add a trailing slash
      re += ":_rest(.*)?"; // Allows to capture the rest of the path
      let match = pathMatch(re);

      // 3. Add middleware
      router._push(function*(next) {
        // check against path
        var prevPath = this.path;
        var prevParams = this.request.params;
        var newParams = match(prevPath);

        if(newParams !== false) {
          debug("matched " + prevPath + " with " + re);
          var newPath = "/" + (newParams._rest || "");
          delete newParams._rest;

          this.path = newPath;
          this.request.params = newParams;

          yield mw;

          this.path = prevPath;
          this.request.params = prevParams;
        } else {
          debug("didnt match " + prevPath + " with " + re);
          yield next;
        }
      });
    } else
      throw new Error("router.use: bad function signature!");
  };

  // Add HTTP verb methods.
  methods.forEach(function(el) {

    /**
     * Assign middlewares to a specific route and HTTP method.
     *
     * @param {String} route - Path match
     * @param {GeneratorFunction[]} mw... - Middlewares
     */
    router[el] = function(route) {
      // 1. Compose middlewares
      var mw = compose(Array.prototype.slice.call(arguments, 1));

      // 2. Create path test function
      var match = pathMatch(route);

      // 3. Add middleware
      router._push(function*(next) {
        var params = match(this.path);

        if(params !== false && this.request.method.toLowerCase() === el) {
          debug("matched " + this.request.method + " " + this.path + " with "
            + el.toUpperCase() + " " + route);
          this.request.params = params;
          yield mw;
        } else {
          debug("didnt match " + this.request.method + " " + this.path +
            " with " + el.toUpperCase() + " " + route);
          yield next
        }
      });
    };

  });

  return router;
};
