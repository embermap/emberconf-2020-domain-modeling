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
