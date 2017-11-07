+(function (window, requirejs, $) {

  'use strict';

  // before minification change this to '.min'

  var runMode = '.min';

  // monkey patching for ie8

  if (typeof String.prototype.trim !== 'function') {
    String.prototype.trim = function () {
      return this.replace(/^\s+|\s+$/g, '');
    };
  }

  Object.keys = Object.keys || (function () {
    var hasOwnProperty = Object.prototype.hasOwnProperty,
      hasDontEnumBug = !{
        toString: null
      }.propertyIsEnumerable('toString'),
      DontEnums = [
        'toString', 'toLocaleString', 'valueOf', 'hasOwnProperty',
        'isPrototypeOf', 'propertyIsEnumerable', 'constructor'
      ],
      DontEnumsLength = DontEnums.length;
    return function (o) {
      if (typeof o != 'object' && typeof o != 'function' || o === null)
        throw new TypeError('Object.keys called on a non-object');
      var result = [];
      for (var name in o) {
        if (hasOwnProperty.call(o, name))
          result.push(name);
      }
      if (hasDontEnumBug) {
        for (var i = 0; i < DontEnumsLength; i++) {
          if (hasOwnProperty.call(o, DontEnums[i]))
            result.push(DontEnums[i]);
        }
      }
      return result;
    };
  })();

  // utilities

  var absoluteRex = /^((http|https|data):|\/)/i,
    htmlCommentRex = /<!--[\s\S]*?-->/gm,
    htmlSpaceRex = />\s+</gm,
    htmlNewLineRex = /\s*(\r\n|\n|\r)\s*/gm,
    nativeSome = Array.prototype.some;

  function dirname(url, level) {
    return url.split('?')[0].split('/').slice(0, level || -1).join('/');
  }

  function normalize(path) {
    var parts = (path = addProtocol(path)).split('://'),
      host = '',
      result = [],
      p;
    if (parts.length > 1) {
      host = parts[0] + '://' + parts[1].split('/')[0];
      path = path.substr(host.length);
    }
    path = path.replace(/\/+/g, '/');
    if (path.indexOf('/') === 0) {
      host += '/';
      path = path.substr(1);
    }
    parts = path.split('/');
    while (p = parts.shift()) {
      if (p === '..') {
        result.pop();
      } else if (p !== '.') {
        result.push(p);
      }
    }
    return host + result.join('/');
  }

  function addProtocol(url) {
    return url.indexOf('//') === 0 ? protocol + url : url;
  }

  function isAbsolute(s) {
    return absoluteRex.test(s);
  }

  function absolute(url, base) {
    if (!isAbsolute(url)) {
      url = normalize((base || currloc || '.') + '/' + url);
    }
    return url;
  }

  function loadUrl(url, base) {
    var splits, id, ext;
    url = absolute(url, base);
    splits = url.split('.');
    id = splits.slice(0, -1).join('.');
    ext = splits.pop();
    if (!id) {
      id = ext;
      ext = '';
    }
    switch (ext) {
    case 'js':
      return id;
    case 'css':
      return '@css!' + id;
    case 'html':
      return '@html!' + id;
    default:
      return '@text!' + url;
    }
  }

  function trimExt(url, ext) {
    if (url.split('.').pop() === ext) {
      url = url.substr(0, url.length - ext.length - 1);
    }
    return url;
  }

  function trimHtml(s) {
    return s.replace(htmlCommentRex, '').replace(htmlSpaceRex, '><');
  }

  function trimNewline(s) {
    return s.replace(htmlNewLineRex, '');
  }

  function each(ary, iterator) {
    if (nativeSome && ary.some === nativeSome) {
      ary.some(iterator);
    } else {
      for (var i = 0, l = ary.length; i < l; i += 1) {
        if (iterator.call(null, ary[i], i, ary)) {
          return;
        }
      }
    }
  }

  // variable stores

  var contextName = 'gk',
    script = getScript(),
    contexts = requirejs.s.contexts,
    wndloc = window.location,
    protocol = wndloc.protocol,
    locorigin = wndloc.origin,
    currloc = dirname(wndloc.pathname.substr(1)),
    scptDir = normalize(script.src + '/../../'),
    pluginBase = script.getAttribute('pluginBase') || (scptDir.indexOf(locorigin) === 0 ? scptDir.substr(locorigin.length + 1) : scptDir),
    htmlPlugin = (window.DOMParser ? 'html' : 'html-ie8') + runMode,
    requireConfig = {
      context: contextName,
      baseUrl: '/',
      map: {
        '*': {
          '@css': pluginBase + '/require-css/css' + runMode,
          '@text': pluginBase + '/require-text/text' + runMode,
          '@html': pluginBase + '/gk-loader/' + htmlPlugin,
          '@wdgt': pluginBase + '/gk-loader/wdgt' + runMode
        }
      },
      config: pluginConfig(pluginBase),
      skipDataMain: true
    },
    scriptCfg = scriptConfig(script),
    context,
    defined,
    status;

  function getScript() {
    var ss = document.getElementsByTagName('script');
    return ss[ss.length - 1];
  }

  function pluginConfig(base) {
    var cfg = {},
      loaderCfg = {
        lib: {
          dirname: dirname,
          normalize: normalize,
          isAbsolute: isAbsolute,
          absolute: absolute,
          loadUrl: loadUrl,
          trimExt: trimExt,
          trimHtml: trimHtml,
          trimNewline: trimNewline,
          each: each,
          $: $
        }
      };
    cfg[base + '/require-text/text' + runMode] = {
      useXhr: function () {
        return true;
      },
      createXhr: (function () {
        if (window.XDomainRequest) {
          return function () {
            var xdr = new window.XDomainRequest();
            xdr.onload = function () {
              xdr.readyState = 4;
              xdr.onreadystatechange();
            };
            return xdr;
          };
        } else if (window.XMLHttpRequest) {
          return function () {
            return new window.XMLHttpRequest();
          };
        } else if (window.ActiveXObject) {
          var ieXhrs = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'];
          return function () {
            var xhr;
            each(ieXhrs, function (ieXhr) {
              try {
                xhr = new window.ActiveXObject(ieXhr);
              } catch (e) {}
              if (xhr) {
                ieXhrs = [ieXhr];
                return true;
              }
            });
            return xhr;
          };
        } else {
          throw new Error('Cannot Create XMLHttpRequest!');
        }
      }())
    };
    cfg[base + '/gk-loader/' + htmlPlugin] = loaderCfg;
    cfg[base + '/gk-loader/wdgt' + runMode] = loaderCfg;
    return cfg;
  }

  function scriptConfig(script) {
    var init = script.getAttribute('init'),
      callback = function () {
        var cb = script.getAttribute('callback');
        cb && $.globalEval(cb + '()');
      },
      cfg = {};
    cfg.init = init;
    cfg.callback = callback;
    return cfg;
  }

  // require components

  var tagSplit = /[\s,]+/,
    attrs = {
      components: script.getAttribute('components'),
      gkTags: script.getAttribute('gk-tags'),
      baseUrl: script.getAttribute('baseUrl')
    },
    param = {
      components: attrs.components ? attrs.components.split(tagSplit) : '',
      gkTags: attrs.gkTags ? attrs.gkTags.split(tagSplit) : '',
      baseUrl: attrs.baseUrl || ''
    };
  registryGK(param, function (init) {
    if (scriptCfg.init === null || (scriptCfg.init && scriptCfg.init !== 'false')) {
      init();
    }
    scriptCfg.callback();
  });

  // export global functions

  window.registryGK = registryGK;

  function registryGK(obj, callback) {
    var htmls = obj.components,
      tags = obj.gkTags,
      baseUrl = obj.baseUrl || param.baseUrl,
      cb = typeof callback === 'function' ? callback : function () {},
      req = configure(requireConfig),
      loads,
      paths,
      ids;
    if (isValidArray(htmls) || isValidArray(tags)) {
      loads = loadComponents(htmls, tags, baseUrl);
    } else {
      loads = loadComponents(obj, [], baseUrl);
    }
    paths = loads.paths;
    ids = loads.ids;
    checkRegistry();
    if (hasUndefined(ids)) {
      setLoading(ids);
      req(paths, function () {
        setDone(ids);
        cb(initGK);
      });
    } else {
      cb(initGK);
    }
  }

  function configure(cfg) {
    var req = requirejs.config(cfg);
    context = contexts[contextName];
    overwriteMethod(context);
    defined = context.defined;
    (context.status = {}) && (status = context.status);
    return req;
  }

  function checkRegistry() {
    each(['_', contextName], function (ctx) {
      var registry = contexts[ctx].registry;
      each(['gk', 'jquery'], function (key) {
        var module = registry[key];
        if (module) {
          var factory = module.factory;
          defined[key] = typeof factory === 'function' ? factory() : factory;
          delete registry[key];
        }
      });
    });
  }

  function overwriteMethod(ctx) {
    var origLoad = ctx.load;
    ctx.load = function (id, url) {
      return origLoad.apply(ctx, [id, url.split('.').pop() === 'js' ? url : url + '.js']);
    };
    requirejs.exec = $.globalEval;
  }

  function isValidArray(ary) {
    return ary && ary.length;
  }

  function loadComponents(htmls, tags, baseUrl) {
    var paths = [],
      ids = [];
    baseUrl = absolute(baseUrl, currloc);
    each(htmls, function (c) {
      c = absolute(trimExt(c, 'html'), baseUrl);
      ids.push(c);
      paths.push('@html!' + c);
    });
    each(tags, function (t) {
      t = absolute(trimExt(t, 'js'), baseUrl);
      ids.push(t);
      paths.push(t);
    });
    return {
      paths: paths,
      ids: ids
    };
  }

  function hasUndefined(ids) {
    var undef = false;
    each(ids, function (m) {
      if (!(m in defined)) {
        undef = true;
        return true;
      }
    });
    return undef;
  }

  function setLoading(ids) {
    each(ids, function (m) {
      if (!status[m] || status[m] !== 'done') {
        status[m] = 'loading';
      }
    });
  }

  function setDone(ids) {
    each(ids, function (m) {
      status[m] = 'done';
    });
  }

  function initGK() {
    var allDone = true;
    each(Object.keys(status), function (m) {
      if (status[m] !== 'done') {
        allDone = false;
        return true;
      }
    });
    allDone && $.gk.init();
  }

}(window, requirejs, jQuery));
