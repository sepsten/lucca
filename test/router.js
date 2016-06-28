var assert = require("chai").assert,
    Router = require("./../"),
    koa = require("koa"),
    request = require("supertest");

describe("Router", function() {
  it("should be a function", function() {
    assert.isFunction(Router);
  });

  it("should return a generator", function() {
    var r = Router("gen");
    assert.isTrue((r.constructor.name === "GeneratorFunction"), "not a generator!");
  });

  it("should be able to be used as a middleware directly", function() {
    var app = koa("mw");
    app.use(Router());
  });

  describe("#use", function() {
    it("should exist", function() {
      var r = Router("useExist");
      assert.isFunction(r.use);
    });

    it("should reject wrong function signatures", function() {
      var r = Router("wrongSign");
      assert.throws(function() {
        r.use("hey");
      });

      assert.throws(function() {
        r.use("hey", "hey");
      });

      assert.throws(function() {
        r.use();
      });
    });
  });

  describe("#use(mw...)", function() {
    it("should execute a single middleware", function(done) {
      var app = koa();
      var r = Router("singleMw");
      r.use(function*(next) {this.response.body = "Hello";});
      app.use(r);

      request(app.listen()).get("/").expect("Hello", done);
    });

    it("should execute multiple middlewares", function(done) {
      var app = koa();
      var r = Router("multMw");
      r.use(function*(next) {this.response.body = "Hello"; yield next;});
      r.use(function*(next) {this.response.body += " world";});
      app.use(r);

      request(app.listen()).get("/").expect("Hello world", done);
    });
  });

  describe("#use(route, mw...)", function() {
    it("should only execute the middleware for the given route", function(done) {
      var app = koa();
      var r = Router("onlyRoute");
      r.use("/blabla", function*(next) {this.response.body = "Hello";});
      app.use(r);

      request(app.listen()).get("/blabla").expect("Hello").end(function(err) {
        if(err) return done(err);

        request(app.listen())
        .get('/dsfgdfg')
        .expect(404, done);
      });
    });

    it("should support multiple routes", function(done) {
      var app = koa();
      var r = Router("multRoute");
      r.use("/blabla", function*(next) {this.response.body = "Hello";});
      r.use("/test", function*(next) {this.response.body = "World";});
      app.use(r);

      request(app.listen()).get("/blabla").expect("Hello").end(function(err) {
        if(err) return done(err);

        request(app.listen())
        .get('/test')
        .expect("World", done);
      });
    });

    it("should match the root of a route", function(done) {
      var app = koa();
      var r = Router("routeRoot");
      r.use("/blabla", function*(next) {this.response.body = "Hello";});
      app.use(r);

      request(app.listen()).get("/blabla/").expect("Hello", done);
    });

    it("should only execute the first route in case of conflict", function(done) {
      var app = koa();
      var r = Router("conflict");
      r.use("/blabla", function*(next) {this.response.body = "Hello";});
      r.use("/blabla", function*(next) {this.response.body = "World";});
      app.use(r);

      request(app.listen()).get("/blabla").expect("Hello", done);
    });

    it("should update and restore ctx.path", function(done) {
      var app = koa();
      var r = Router("path");
      r.use(function*(next) {
        try {assert.strictEqual(this.path, "/blabla/test");}
        catch(e) {done(e);}
        yield next;
        try {assert.strictEqual(this.path, "/blabla/test");}
        catch(e) {done(e);}
      });
      r.use("/blabla", function*(next) {
        try {assert.strictEqual(this.path, "/test");}
        catch(e) {done(e);}
        this.response.body = "Hello";
      });
      app.use(r);

      request(app.listen()).get("/blabla/test").end(done);
    });

    it("should support nested routers", function(done) {
      var app = koa();
      var a = Router("parent"),
          b = Router("child");
      a.use("/blabla", b);
      b.use("/test", function*(next) {this.response.body = "Hello";});
      app.use(a);

      request(app.listen()).get("/blabla/test/qsdqsd").expect("Hello").end(function(err) {
        if(err) return done(err);

        request(app.listen())
        .get('/blabla')
        .expect(404, done);
      });
    });

    it("should support root for nested routers", function(done) {
      var app = koa();
      var a = Router("parent"),
          b = Router("child");
      a.use("/blabla", b);
      b.get("/", function*(next) {this.response.body = "Hello";});
      app.use(a);

      request(app.listen()).get('/blabla').expect("Hello", done);
    });

    it("should support adjacent routers/middleware", function(done) {
      var app = koa();
      var a = Router("first"),
          b = Router("second");
      a.get("/truc", function*(next) {this.response.body = "Hello";});
      b.get("/machin", function*(next) {this.response.body = "World";});
      app.use(a);
      app.use(b);

      request(app.listen()).get('/machin').expect("World", done);
    });
  });

  describe("#[verb](route, mw...)", function() {
    it("should support basic HTTP verbs", function() {
      var r = Router("verbs");
      assert.isFunction(r.get);
      assert.isFunction(r.post);
      assert.isFunction(r.delete);
      assert.isFunction(r.put);
    });

    it("should only match the given method", function(done) {
      var app = koa();
      var r = Router("method");
      r.get("/test", function*(next) {this.response.body = "Hello";});
      app.use(r);

      request(app.listen()).get("/test").expect("Hello").end(function(err) {
        if(err) return done(err);

        request(app.listen())
        .post('/test')
        .expect(404, done);
      });
    });

    it("should match trailing slashes", function(done) {
      var app = koa();
      var r = Router("trailingSlash");
      r.get("/test", function*(next) {this.response.body = "Hello";});
      app.use(r);

      request(app.listen()).get("/test/").expect("Hello", done);
    });

    it("should not match its route's children", function(done) {
      var app = koa();
      var r = Router("routeChildren");
      r.get("/test", function*(next) {this.response.body = "Hello";});
      app.use(r);

      request(app.listen()).get("/test/baby").expect(404, done);
    });
  });
});
