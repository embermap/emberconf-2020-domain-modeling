/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var runtime = (function (exports) {
  "use strict";

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  exports.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  IteratorPrototype[iteratorSymbol] = function () {
    return this;
  };

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunctionPrototype[toStringTagSymbol] =
    GeneratorFunction.displayName = "GeneratorFunction";

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      prototype[method] = function(arg) {
        return this._invoke(method, arg);
      };
    });
  }

  exports.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  exports.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      if (!(toStringTagSymbol in genFun)) {
        genFun[toStringTagSymbol] = "GeneratorFunction";
      }
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  exports.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return PromiseImpl.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return PromiseImpl.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration.
          result.value = unwrapped;
          resolve(result);
        }, function(error) {
          // If a rejected Promise was yielded, throw the rejection back
          // into the async generator function so it can be handled there.
          return invoke("throw", error, resolve, reject);
        });
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new PromiseImpl(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);
  AsyncIterator.prototype[asyncIteratorSymbol] = function () {
    return this;
  };
  exports.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    if (PromiseImpl === void 0) PromiseImpl = Promise;

    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList),
      PromiseImpl
    );

    return exports.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];
    if (method === undefined) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        // Note: ["return"] must be used for ES3 parsing compatibility.
        if (delegate.iterator["return"]) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
            return ContinueSentinel;
          }
        }

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  Gp[toStringTagSymbol] = "Generator";

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  exports.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  exports.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined;
      }

      return ContinueSentinel;
    }
  };

  // Regardless of whether this script is executing as a CommonJS module
  // or not, return the runtime object so that we can declare the variable
  // regeneratorRuntime in the outer scope, which allows this module to be
  // injected easily by `bin/regenerator --include-runtime script.js`.
  return exports;

}(
  // If this script is executing as a CommonJS module, use module.exports
  // as the regeneratorRuntime namespace. Otherwise create a new empty
  // object. Either way, the resulting object will be used to initialize
  // the regeneratorRuntime variable at the top of this file.
  typeof module === "object" ? module.exports : {}
));

try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  // This module should not be running in strict mode, so the above
  // assignment should always work unless something is misconfigured. Just
  // in case runtime.js accidentally runs in strict mode, we can escape
  // strict mode using a global Function call. This could conceivably fail
  // if a Content Security Policy forbids using Function, but in that case
  // the proper solution is to fix the accidental strict mode problem. If
  // you've misconfigured your bundler to force strict mode and applied a
  // CSP to forbid Function, and you're not willing to fix either of those
  // problems, please detail your unique predicament in a GitHub issue.
  Function("r", "regeneratorRuntime = r")(runtime);
}

(function () {
	'use strict';

	function unwrapExports (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var lib = createCommonjsModule(function (module, exports) {

	  Object.defineProperty(exports, "__esModule", {
	    value: true
	  });
	  exports.default = exports.ERR_IFRAME_ALREADY_ATTACHED_TO_DOM = exports.ERR_NOT_IN_IFRAME = exports.ERR_CONNECTION_TIMEOUT = exports.ERR_CONNECTION_DESTROYED = void 0;
	  var HANDSHAKE = 'handshake';
	  var HANDSHAKE_REPLY = 'handshake-reply';
	  var CALL = 'call';
	  var REPLY = 'reply';
	  var FULFILLED = 'fulfilled';
	  var REJECTED = 'rejected';
	  var MESSAGE = 'message';
	  var DATA_CLONE_ERROR = 'DataCloneError';
	  var ERR_CONNECTION_DESTROYED = 'ConnectionDestroyed';
	  exports.ERR_CONNECTION_DESTROYED = ERR_CONNECTION_DESTROYED;
	  var ERR_CONNECTION_TIMEOUT = 'ConnectionTimeout';
	  exports.ERR_CONNECTION_TIMEOUT = ERR_CONNECTION_TIMEOUT;
	  var ERR_NOT_IN_IFRAME = 'NotInIframe';
	  exports.ERR_NOT_IN_IFRAME = ERR_NOT_IN_IFRAME;
	  var ERR_IFRAME_ALREADY_ATTACHED_TO_DOM = 'IframeAlreadyAttachedToDom';
	  exports.ERR_IFRAME_ALREADY_ATTACHED_TO_DOM = ERR_IFRAME_ALREADY_ATTACHED_TO_DOM;
	  var CHECK_IFRAME_IN_DOC_INTERVAL = 60000;
	  var DEFAULT_PORTS = {
	    'http:': '80',
	    'https:': '443'
	  };
	  var URL_REGEX = /^(https?:|file:)?\/\/([^/:]+)?(:(\d+))?/;
	  var Penpal = {
	    ERR_CONNECTION_DESTROYED: ERR_CONNECTION_DESTROYED,
	    ERR_CONNECTION_TIMEOUT: ERR_CONNECTION_TIMEOUT,
	    ERR_NOT_IN_IFRAME: ERR_NOT_IN_IFRAME,
	    ERR_IFRAME_ALREADY_ATTACHED_TO_DOM: ERR_IFRAME_ALREADY_ATTACHED_TO_DOM,

	    /**
	     * Promise implementation.
	     * @type {Constructor}
	     */
	    Promise: function () {
	      try {
	        return window ? window.Promise : null;
	      } catch (e) {
	        return null;
	      }
	    }(),

	    /**
	     * Whether debug messages should be logged.
	     * @type {boolean}
	     */
	    debug: false
	  };
	  /**
	   * @return {number} A unique ID (not universally unique)
	   */

	  var generateId = function () {
	    var id = 0;
	    return function () {
	      return ++id;
	    };
	  }();
	  /**
	   * Logs a message.
	   * @param {...*} args One or more items to log
	   */


	  var log = function log() {
	    if (Penpal.debug) {
	      var _console;

	      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
	        args[_key] = arguments[_key];
	      }

	      (_console = console).log.apply(_console, ['[Penpal]'].concat(args)); // eslint-disable-line no-console

	    }
	  };
	  /**
	   * Converts a URL into an origin.
	   * @param {string} url
	   * @return {string} The URL's origin
	   */


	  var getOriginFromUrl = function getOriginFromUrl(url) {
	    var location = document.location;
	    var regexResult = URL_REGEX.exec(url);
	    var protocol;
	    var hostname;
	    var port;

	    if (regexResult) {
	      // It's an absolute URL. Use the parsed info.
	      // regexResult[1] will be undefined if the URL starts with //
	      protocol = regexResult[1] ? regexResult[1] : location.protocol;
	      hostname = regexResult[2];
	      port = regexResult[4];
	    } else {
	      // It's a relative path. Use the current location's info.
	      protocol = location.protocol;
	      hostname = location.hostname;
	      port = location.port;
	    } // If the protocol is file, the origin is "null"
	    // The origin of a document with file protocol is an opaque origin
	    // and its serialization "null" [1]
	    // [1] https://html.spec.whatwg.org/multipage/origin.html#origin


	    if (protocol === "file:") {
	      return "null";
	    } // If the port is the default for the protocol, we don't want to add it to the origin string
	    // or it won't match the message's event.origin.


	    var portSuffix = port && port !== DEFAULT_PORTS[protocol] ? ":".concat(port) : '';
	    return "".concat(protocol, "//").concat(hostname).concat(portSuffix);
	  };
	  /**
	   * A simplified promise class only used internally for when destroy() is called. This is
	   * used to destroy connections synchronously while promises typically resolve asynchronously.
	   *
	   * @param {Function} executor
	   * @returns {Object}
	   * @constructor
	   */


	  var DestructionPromise = function DestructionPromise(executor) {
	    var handlers = [];
	    executor(function () {
	      handlers.forEach(function (handler) {
	        handler();
	      });
	    });
	    return {
	      then: function then(handler) {
	        handlers.push(handler);
	      }
	    };
	  };
	  /**
	   * Converts an error object into a plain object.
	   * @param {Error} Error object.
	   * @returns {Object}
	   */


	  var serializeError = function serializeError(_ref) {
	    var name = _ref.name,
	        message = _ref.message,
	        stack = _ref.stack;
	    return {
	      name: name,
	      message: message,
	      stack: stack
	    };
	  };
	  /**
	   * Converts a plain object into an error object.
	   * @param {Object} Object with error properties.
	   * @returns {Error}
	   */


	  var deserializeError = function deserializeError(obj) {
	    var deserializedError = new Error();
	    Object.keys(obj).forEach(function (key) {
	      return deserializedError[key] = obj[key];
	    });
	    return deserializedError;
	  };
	  /**
	   * Augments an object with methods that match those defined by the remote. When these methods are
	   * called, a "call" message will be sent to the remote, the remote's corresponding method will be
	   * executed, and the method's return value will be returned via a message.
	   * @param {Object} callSender Sender object that should be augmented with methods.
	   * @param {Object} info Information about the local and remote windows.
	   * @param {Array} methodNames Names of methods available to be called on the remote.
	   * @param {Promise} destructionPromise A promise resolved when destroy() is called on the penpal
	   * connection.
	   * @returns {Object} The call sender object with methods that may be called.
	   */


	  var connectCallSender = function connectCallSender(callSender, info, methodNames, destroy, destructionPromise) {
	    var localName = info.localName,
	        local = info.local,
	        remote = info.remote,
	        remoteOrigin = info.remoteOrigin;
	    var destroyed = false;
	    log("".concat(localName, ": Connecting call sender"));

	    var createMethodProxy = function createMethodProxy(methodName) {
	      return function () {
	        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
	          args[_key2] = arguments[_key2];
	        }

	        log("".concat(localName, ": Sending ").concat(methodName, "() call")); // This handles the case where the iframe has been removed from the DOM
	        // (and therefore its window closed), the consumer has not yet
	        // called destroy(), and the user calls a method exposed by
	        // the remote. We detect the iframe has been removed and force
	        // a destroy() immediately so that the consumer sees the error saying
	        // the connection has been destroyed.

	        if (remote.closed) {
	          destroy();
	        }

	        if (destroyed) {
	          var error = new Error("Unable to send ".concat(methodName, "() call due ") + "to destroyed connection");
	          error.code = ERR_CONNECTION_DESTROYED;
	          throw error;
	        }

	        return new Penpal.Promise(function (resolve, reject) {
	          var id = generateId();

	          var handleMessageEvent = function handleMessageEvent(event) {
	            if (event.source === remote && event.origin === remoteOrigin && event.data.penpal === REPLY && event.data.id === id) {
	              log("".concat(localName, ": Received ").concat(methodName, "() reply"));
	              local.removeEventListener(MESSAGE, handleMessageEvent);
	              var returnValue = event.data.returnValue;

	              if (event.data.returnValueIsError) {
	                returnValue = deserializeError(returnValue);
	              }

	              (event.data.resolution === FULFILLED ? resolve : reject)(returnValue);
	            }
	          };

	          local.addEventListener(MESSAGE, handleMessageEvent);
	          remote.postMessage({
	            penpal: CALL,
	            id: id,
	            methodName: methodName,
	            args: args
	          }, remoteOrigin);
	        });
	      };
	    };

	    destructionPromise.then(function () {
	      destroyed = true;
	    });
	    methodNames.reduce(function (api, methodName) {
	      api[methodName] = createMethodProxy(methodName);
	      return api;
	    }, callSender);
	  };
	  /**
	   * Listens for "call" messages coming from the remote, executes the corresponding method, and
	   * responds with the return value.
	   * @param {Object} info Information about the local and remote windows.
	   * @param {Object} methods The keys are the names of the methods that can be called by the remote
	   * while the values are the method functions.
	   * @param {Promise} destructionPromise A promise resolved when destroy() is called on the penpal
	   * connection.
	   * @returns {Function} A function that may be called to disconnect the receiver.
	   */


	  var connectCallReceiver = function connectCallReceiver(info, methods, destructionPromise) {
	    var localName = info.localName,
	        local = info.local,
	        remote = info.remote,
	        remoteOrigin = info.remoteOrigin;
	    var destroyed = false;
	    log("".concat(localName, ": Connecting call receiver"));

	    var handleMessageEvent = function handleMessageEvent(event) {
	      if (event.source === remote && event.origin === remoteOrigin && event.data.penpal === CALL) {
	        var _event$data = event.data,
	            methodName = _event$data.methodName,
	            args = _event$data.args,
	            id = _event$data.id;
	        log("".concat(localName, ": Received ").concat(methodName, "() call"));

	        if (methodName in methods) {
	          var createPromiseHandler = function createPromiseHandler(resolution) {
	            return function (returnValue) {
	              log("".concat(localName, ": Sending ").concat(methodName, "() reply"));

	              if (destroyed) {
	                // It's possible to throw an error here, but it would need to be thrown asynchronously
	                // and would only be catchable using window.onerror. This is because the consumer
	                // is merely returning a value from their method and not calling any function
	                // that they could wrap in a try-catch. Even if the consumer were to catch the error,
	                // the value of doing so is questionable. Instead, we'll just log a message.
	                log("".concat(localName, ": Unable to send ").concat(methodName, "() reply due to destroyed connection"));
	                return;
	              }

	              var message = {
	                penpal: REPLY,
	                id: id,
	                resolution: resolution,
	                returnValue: returnValue
	              };

	              if (resolution === REJECTED && returnValue instanceof Error) {
	                message.returnValue = serializeError(returnValue);
	                message.returnValueIsError = true;
	              }

	              try {
	                remote.postMessage(message, remoteOrigin);
	              } catch (err) {
	                // If a consumer attempts to send an object that's not cloneable (e.g., window),
	                // we want to ensure the receiver's promise gets rejected.
	                if (err.name === DATA_CLONE_ERROR) {
	                  remote.postMessage({
	                    penpal: REPLY,
	                    id: id,
	                    resolution: REJECTED,
	                    returnValue: serializeError(err),
	                    returnValueIsError: true
	                  }, remoteOrigin);
	                }

	                throw err;
	              }
	            };
	          };

	          new Penpal.Promise(function (resolve) {
	            return resolve(methods[methodName].apply(methods, args));
	          }).then(createPromiseHandler(FULFILLED), createPromiseHandler(REJECTED));
	        }
	      }
	    };

	    local.addEventListener(MESSAGE, handleMessageEvent);
	    destructionPromise.then(function () {
	      destroyed = true;
	      local.removeEventListener(MESSAGE, handleMessageEvent);
	    });
	  };
	  /**
	   * @typedef {Object} Child
	   * @property {Promise} promise A promise which will be resolved once a connection has
	   * been established.
	   * @property {HTMLIframeElement} iframe The created iframe element.
	   * @property {Function} destroy A method that, when called, will remove the iframe element from
	   * the DOM and clean up event listeners.
	   */

	  /**
	   * Creates an iframe, loads a webpage into the URL, and attempts to establish communication with
	   * the iframe.
	   * @param {Object} options
	   * @param {string} options.url The URL of the webpage that should be loaded into the created iframe.
	   * @param {HTMLElement} [options.appendTo] The container to which the iframe should be appended.
	   * @param {Object} [options.methods={}] Methods that may be called by the iframe.
	   * @param {Number} [options.timeout] The amount of time, in milliseconds, Penpal should wait
	   * for the child to respond before rejecting the connection promise.
	   * @return {Child}
	   */


	  Penpal.connectToChild = function (_ref2) {
	    var url = _ref2.url,
	        appendTo = _ref2.appendTo,
	        iframe = _ref2.iframe,
	        _ref2$methods = _ref2.methods,
	        methods = _ref2$methods === void 0 ? {} : _ref2$methods,
	        timeout = _ref2.timeout;

	    if (iframe && iframe.parentNode) {
	      var error = new Error('connectToChild() must not be called with an iframe already attached to DOM');
	      error.code = ERR_IFRAME_ALREADY_ATTACHED_TO_DOM;
	      throw error;
	    }

	    var destroy;
	    var connectionDestructionPromise = new DestructionPromise(function (resolveConnectionDestructionPromise) {
	      destroy = resolveConnectionDestructionPromise;
	    });
	    var parent = window;
	    iframe = iframe || document.createElement('iframe');
	    iframe.src = url;
	    var childOrigin = getOriginFromUrl(url);
	    var promise = new Penpal.Promise(function (resolveConnectionPromise, reject) {
	      var connectionTimeoutId;

	      if (timeout !== undefined) {
	        connectionTimeoutId = setTimeout(function () {
	          var error = new Error("Connection to child timed out after ".concat(timeout, "ms"));
	          error.code = ERR_CONNECTION_TIMEOUT;
	          reject(error);
	          destroy();
	        }, timeout);
	      } // We resolve the promise with the call sender. If the child reconnects (for example, after
	      // refreshing or navigating to another page that uses Penpal, we'll update the call sender
	      // with methods that match the latest provided by the child.


	      var callSender = {};
	      var receiverMethodNames;
	      var destroyCallReceiver;

	      var handleMessage = function handleMessage(event) {
	        var child = iframe.contentWindow;

	        if (event.source === child && event.origin === childOrigin && event.data.penpal === HANDSHAKE) {
	          log('Parent: Received handshake, sending reply'); // If event.origin is "null", the remote protocol is file:
	          // and we must post messages with "*" as targetOrigin [1]
	          // [1] https://developer.mozilla.org/fr/docs/Web/API/Window/postMessage#Utiliser_window.postMessage_dans_les_extensions

	          var remoteOrigin = event.origin === "null" ? "*" : event.origin;
	          event.source.postMessage({
	            penpal: HANDSHAKE_REPLY,
	            methodNames: Object.keys(methods)
	          }, remoteOrigin);
	          var info = {
	            localName: 'Parent',
	            local: parent,
	            remote: child,
	            remoteOrigin: remoteOrigin
	          }; // If the child reconnected, we need to destroy the previous call receiver before setting
	          // up a new one.

	          if (destroyCallReceiver) {
	            destroyCallReceiver();
	          } // When this promise is resolved, it will destroy the call receiver (stop listening to
	          // method calls from the child) and delete its methods off the call sender.


	          var callReceiverDestructionPromise = new DestructionPromise(function (resolveCallReceiverDestructionPromise) {
	            connectionDestructionPromise.then(resolveCallReceiverDestructionPromise);
	            destroyCallReceiver = resolveCallReceiverDestructionPromise;
	          });
	          connectCallReceiver(info, methods, callReceiverDestructionPromise); // If the child reconnected, we need to remove the methods from the previous call receiver
	          // off the sender.

	          if (receiverMethodNames) {
	            receiverMethodNames.forEach(function (receiverMethodName) {
	              delete callSender[receiverMethodName];
	            });
	          }

	          receiverMethodNames = event.data.methodNames;
	          connectCallSender(callSender, info, receiverMethodNames, destroy, connectionDestructionPromise);
	          clearTimeout(connectionTimeoutId);
	          resolveConnectionPromise(callSender);
	        }
	      };

	      parent.addEventListener(MESSAGE, handleMessage);
	      log('Parent: Loading iframe');
	      (appendTo || document.body).appendChild(iframe); // This is to prevent memory leaks when the iframe is removed
	      // from the document and the consumer hasn't called destroy().
	      // Without this, event listeners attached to the window would
	      // stick around and since the event handlers have a reference
	      // to the iframe in their closures, the iframe would stick around
	      // too.

	      var checkIframeInDocIntervalId = setInterval(function () {
	        if (!document.body.contains(iframe)) {
	          clearInterval(checkIframeInDocIntervalId);
	          destroy();
	        }
	      }, CHECK_IFRAME_IN_DOC_INTERVAL);
	      connectionDestructionPromise.then(function () {
	        if (iframe.parentNode) {
	          iframe.parentNode.removeChild(iframe);
	        }

	        parent.removeEventListener(MESSAGE, handleMessage);
	        clearInterval(checkIframeInDocIntervalId);
	        var error = new Error('Connection destroyed');
	        error.code = ERR_CONNECTION_DESTROYED;
	        reject(error);
	      });
	    });
	    return {
	      promise: promise,
	      iframe: iframe,
	      destroy: destroy
	    };
	  };
	  /**
	   * @typedef {Object} Parent
	   * @property {Promise} promise A promise which will be resolved once a connection has
	   * been established.
	   */

	  /**
	   * Attempts to establish communication with the parent window.
	   * @param {Object} options
	   * @param {string} [options.parentOrigin=*] Valid parent origin used to restrict communication.
	   * @param {Object} [options.methods={}] Methods that may be called by the parent window.
	   * @param {Number} [options.timeout] The amount of time, in milliseconds, Penpal should wait
	   * for the parent to respond before rejecting the connection promise.
	   * @return {Parent}
	   */


	  Penpal.connectToParent = function () {
	    var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
	        _ref3$parentOrigin = _ref3.parentOrigin,
	        parentOrigin = _ref3$parentOrigin === void 0 ? '*' : _ref3$parentOrigin,
	        _ref3$methods = _ref3.methods,
	        methods = _ref3$methods === void 0 ? {} : _ref3$methods,
	        timeout = _ref3.timeout;

	    if (window === window.top) {
	      var error = new Error('connectToParent() must be called within an iframe');
	      error.code = ERR_NOT_IN_IFRAME;
	      throw error;
	    }

	    var destroy;
	    var connectionDestructionPromise = new DestructionPromise(function (resolveConnectionDestructionPromise) {
	      destroy = resolveConnectionDestructionPromise;
	    });
	    var child = window;
	    var parent = child.parent;
	    var promise = new Penpal.Promise(function (resolveConnectionPromise, reject) {
	      var connectionTimeoutId;

	      if (timeout !== undefined) {
	        connectionTimeoutId = setTimeout(function () {
	          var error = new Error("Connection to parent timed out after ".concat(timeout, "ms"));
	          error.code = ERR_CONNECTION_TIMEOUT;
	          reject(error);
	          destroy();
	        }, timeout);
	      }

	      var handleMessageEvent = function handleMessageEvent(event) {
	        if ((parentOrigin === '*' || parentOrigin === event.origin) && event.source === parent && event.data.penpal === HANDSHAKE_REPLY) {
	          log('Child: Received handshake reply');
	          child.removeEventListener(MESSAGE, handleMessageEvent);
	          var info = {
	            localName: 'Child',
	            local: child,
	            remote: parent,
	            remoteOrigin: event.origin
	          };
	          var callSender = {};
	          connectCallReceiver(info, methods, connectionDestructionPromise);
	          connectCallSender(callSender, info, event.data.methodNames, destroy, connectionDestructionPromise);
	          clearTimeout(connectionTimeoutId);
	          resolveConnectionPromise(callSender);
	        }
	      };

	      child.addEventListener(MESSAGE, handleMessageEvent);
	      connectionDestructionPromise.then(function () {
	        child.removeEventListener(MESSAGE, handleMessageEvent);
	        var error = new Error('Connection destroyed');
	        error.code = ERR_CONNECTION_DESTROYED;
	        reject(error);
	      });
	      log('Child: Sending handshake');
	      parent.postMessage({
	        penpal: HANDSHAKE,
	        methodNames: Object.keys(methods)
	      }, parentOrigin);
	    });
	    return {
	      promise: promise,
	      destroy: destroy
	    };
	  };

	  var _default = Penpal;
	  exports.default = _default;
	});
	var Penpal = unwrapExports(lib);
	var lib_1 = lib.ERR_IFRAME_ALREADY_ATTACHED_TO_DOM;
	var lib_2 = lib.ERR_NOT_IN_IFRAME;
	var lib_3 = lib.ERR_CONNECTION_TIMEOUT;
	var lib_4 = lib.ERR_CONNECTION_DESTROYED;

	function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
	  try {
	    var info = gen[key](arg);
	    var value = info.value;
	  } catch (error) {
	    reject(error);
	    return;
	  }

	  if (info.done) {
	    resolve(value);
	  } else {
	    Promise.resolve(value).then(_next, _throw);
	  }
	}

	function _asyncToGenerator(fn) {
	  return function () {
	    var self = this,
	        args = arguments;
	    return new Promise(function (resolve, reject) {
	      var gen = fn.apply(self, args);

	      function _next(value) {
	        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
	      }

	      function _throw(err) {
	        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
	      }

	      _next(undefined);
	    });
	  };
	}

	var editor;
	function updateEditor(_ref) {
	  var value = _ref.value,
	      language = _ref.language;

	  require(['vs/editor/editor.main'], function () {
	    if (typeof monaco !== 'undefined' && typeof editor !== 'undefined') {
	      editor.setValue(value);
	      var lang = editor.getModel();
	      if (!lang) throw new Error('Editor has no model');
	      monaco.editor.setModelLanguage(lang, language);
	    }
	  });
	}

	function setupKeyBindings(editor, client) {
	  // save
	  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, function () {
	    client.keyCommand({
	      cmd: true,
	      keys: ['s']
	    });
	  }, ''); // save all

	  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KEY_S, function () {
	    client.keyCommand({
	      cmd: true,
	      shift: true,
	      keys: ['s']
	    });
	  }, '');
	}

	function installResizeWatcher(el, fn, interval) {
	  var offset = {
	    width: el.offsetWidth,
	    height: el.offsetHeight
	  };
	  setInterval(function () {
	    var newOffset = {
	      width: el.offsetWidth,
	      height: el.offsetHeight
	    };

	    if (offset.height !== newOffset.height || offset.width !== newOffset.width) {
	      offset = newOffset;
	      fn();
	    }
	  }, interval);
	}

	function setupEditor(cfg) {
	  require(['vs/editor/editor.main'], /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	    var wrapper, language, theme, value, ed, client;
	    return regeneratorRuntime.wrap(function _callee$(_context) {
	      while (1) {
	        switch (_context.prev = _context.next) {
	          case 0:
	            if (!(typeof monaco !== 'undefined')) {
	              _context.next = 13;
	              break;
	            }

	            wrapper = window.document.getElementById('monaco-editor-wrapper');

	            if (wrapper) {
	              _context.next = 4;
	              break;
	            }

	            throw new Error('No wrapper found');

	          case 4:
	            language = cfg.language, theme = cfg.theme, value = cfg.value;
	            ed = editor = window.editor = monaco.editor.create(wrapper, {
	              language: language,
	              theme: theme,
	              value: value
	            });
	            _context.next = 8;
	            return conn.promise;

	          case 8:
	            client = _context.sent;
	            ed.onDidChangeModelContent(function (event) {
	              if (!event) {
	                return;
	              }

	              client.onValueChanged({
	                event: event,
	                value: ed.getValue()
	              });
	            });
	            client.onReady();
	            setupKeyBindings(ed, client);
	            installResizeWatcher(wrapper, editor.layout.bind(editor), 2000);

	          case 13:
	          case "end":
	            return _context.stop();
	        }
	      }
	    }, _callee);
	  })));
	}

	var conn = Penpal.connectToParent({
	  methods: {
	    setupEditor: setupEditor,
	    updateEditor: updateEditor
	  }
	});

}());
//# sourceMappingURL=frame.map
