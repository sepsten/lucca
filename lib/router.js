/**
 * @file Router code
 * @module lucca
 * @author sepsten
 */

var methods = require("methods"),
    compose = require("koa-compose"),
    pathMatch = require("path-match")();

/**
 * Returns a router.
 *
 * @param {String} [name=anon] - The router's name (used for debugging output)
 * @returns {module:lucca.Router} A Koa middleware which acts as a router.
 */
module.exports = function newRouter(name) {
  // Creates a debug-logger instance
  var debug = require("debug")("router:" + (name || "anon"));

  /**
   * The router middleware. No class is exported by the module as there is no
   * real Router class: instances are just generators with added properties.
   * Routers must be created using the main function.
   *
   * @class module:lucca.Router
   */
  var router = function*(next) {
    debug("enter");
    yield router.mw; // Execute the router's stack
    yield next;      // Give control back to the parent with the next middleware
    debug("exit");
  };

  router.name = name;

  /**
   * Middleware stack.
   *
   * @prop module:lucca.Router~stack
   * @type GeneratorFunction[]
   * @private
   */
  router.stack = [];

  /**
   * Contains all the middleware composed.
   *
   * @prop Router~mw
   * @type GeneratorFunction
   * @private
   */
  router.mw = null;

  /**
   * Pushes a middleware to the stack.
   *
   * @method module:lucca.Router~_push
   * @private
   */
  router._push = function(mw) {
    router.stack.push(mw);
    // The stack is recomposed each time a middleware is added, but that's okay
    // as it's only at launch time.
    router.mw = compose(router.stack);
  };

  /**
   * Adds middlewares to the stack or assign it to a specific route.
   *
   * @method module:lucca.Router#use
   * @param {String} [route] - `path-to-regexp` expression to match the request
   * @param {GeneratorFunction[]} mw... - Middlewares
   */
  router.use = function(one, two) {
    if(typeof one === "function")
      // #use(...mw):
      // Compose and add all the middlewares passed as arguments
      router._push(compose(arguments));
    else if(typeof one === "string" && typeof two === "function") {
      // #use(route, ...mw): Routes a middleware

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
        var newParams = match(this.path); // Match the path against the route

        if(newParams !== false) {
          // The path matched!
          debug("matched " + prevPath + " with " + re);
          var prevPath = this.path; // Save the "original" path
          var prevParams = this.request.params; // Save the "original" params
          // Add a slash to make the middleware think they're at the root.
          var newPath = "/" + (newParams._rest || "");
          delete newParams._rest; // Remove the private param used

          // Export the new path and params
          this.path = newPath;
          this.request.params = newParams; // Merge with the previous params?

          yield mw;

          // Restore the previous path and params
          this.path = prevPath;
          this.request.params = prevParams;
        } else {
          // The path didn't match, delegate to the following middleware.
          debug("didnt match " + prevPath + " with " + re);
          yield next;
        }
      });
    } else
      // Should we really throw for a developer's mistake? ...
      throw new Error("router.use: bad function signature!");
  };

  // Add HTTP verb methods.
  methods.forEach(function(el) {

    /**
     * Assign middlewares to a specific route and HTTP method. For each HTTP
     * verb there is a method: `Router.get`, `Router.delete`, etc.
     *
     * @method module:lucca.Router#[verb]
     * @param {String} route - `path-to-regexp` expression to match the request
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
          // The path and the HTTP method matched!
          debug("matched " + this.request.method + " " + this.path + " with "
            + el.toUpperCase() + " " + route);

          // Pass the parsed params and yield to the given middleware stack
          this.request.params = params;
          yield mw;
        } else {
          // The path and the HTTP method didn't match
          debug("didnt match " + this.request.method + " " + this.path +
            " with " + el.toUpperCase() + " " + route);
          yield next; // Delegate to the next middlware
        }
      });
    };

  });

  return router;
};
