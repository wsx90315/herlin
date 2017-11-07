define(['module', './lib/simplehtmlparser.min'], function (module) {

  'use strict';

  // monkey patching of native Array api

  if (!Array.prototype.filter) {
    Array.prototype.filter = function (fun) {
      if (this === void 0 || this === null) {
        throw new TypeError();
      }
      var t = Object(this);
      var len = t.length >>> 0;
      if (typeof fun !== 'function') {
        throw new TypeError();
      }
      var res = [];
      var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
      for (var i = 0; i < len; i++) {
        if (i in t) {
          var val = t[i];
          if (fun.call(thisArg, val, i, t))
            res.push(val);
        }
      }
      return res;
    };
  }

  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement, fromIndex) {
      if (this === undefined || this === null) {
        throw new TypeError('"this" is null or not defined');
      }
      var length = this.length >>> 0;
      fromIndex = +fromIndex || 0;
      if (Math.abs(fromIndex) === Infinity) {
        fromIndex = 0;
      }
      if (fromIndex < 0) {
        fromIndex += length;
        if (fromIndex < 0) {
          fromIndex = 0;
        }
      }
      for (; fromIndex < length; fromIndex++) {
        if (this[fromIndex] === searchElement) {
          return fromIndex;
        }
      }
      return -1;
    };
  }

  var elementExt = '.html',
    moduleConfig = module.config(),
    lib = moduleConfig.lib,
    loadUrl = lib.loadUrl,
    trimNewline = lib.trimNewline,
    each = lib.each,
    $ = lib.$,
    $gk = $.gk,

    voidMap = (function () {
      var voidEle = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'],
        map = {};
      for (var i = 0, j = voidEle.length; i < j; i++) {
        map[voidEle[i]] = true;
      }
      return map;
    }()),

    htmlparser = new SimpleHtmlParser(),

    MockNode = function () {
      this.tagName = arguments[0];
      this.attribs = (function (attrs) {
        var obj = {};
        each(attrs, function (attr) {
          obj[attr.name] = attr.value;
        });
        return obj;
      }(arguments[1]));
      this.childNodes = [];
    },
    MockContentNode = function () {
      this.content = arguments[0];
    },
    MockDOMParser = function () {},
    protoNode = MockNode.prototype,
    protoContentNode = MockContentNode.prototype,
    protoDOMParser = MockDOMParser.prototype;

  protoNode.removeChild = function (node) {
    var idx = this.childNodes.indexOf(node);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
    }
  };
  protoNode.innerHTML = function () {
    var val = '';
    each(this.childNodes, function (child) {
      val += child.outerHTML();
    });
    return val;
  };
  protoNode.outerHTML = function () {
    var self = this,
      tag = self.tagName,
      attrVal = '',
      html = '';
    each(Object.keys(self.attribs), function (attr) {
      attrVal += (' ' + attr + '="' + self.attribs[attr] + '"');
    });
    html = '<' + tag + attrVal + '>' + self.innerHTML();
    if (!(tag.toLowerCase() in voidMap)) {
      html += '</' + tag + '>';
    }
    return html;
  };

  protoContentNode.innerHTML = protoContentNode.outerHTML = function () {
    return this.content;
  };

  (function () {
    function newContext() {
      return [new MockNode('ROOT', [])];
    }

    function currentNode(ctx) {
      return ctx[ctx.length - 1];
    }

    function pushContext(ctx, node) {
      ctx.push(node);
    }

    function popContext(ctx) {
      return ctx.pop();
    }

    function parseStartTag(ctx, tag, content, attrs) {
      var curr = currentNode(ctx),
        newNode = new MockNode(tag, attrs);
      newNode.parentNode = curr;
      curr.childNodes.push(newNode);
      return newNode;
    }

    function parseContent(ctx, content) {
      var curr = currentNode(ctx),
        newNode = new MockContentNode(content);
      newNode.parentNode = curr;
      curr.childNodes.push(newNode);
      return newNode;
    }

    protoDOMParser.parse = function (code) {
      var ctx = newContext();
      htmlparser.parse(code, {
        startElement: function (tag, content, attrs) {
          var node = parseStartTag(ctx, tag, content, attrs);
          if ((!(tag.toLowerCase() in voidMap)) && (content.substr(content.length - 2) !== '/>')) {
            pushContext(ctx, node);
          }
        },
        endElement: function (tag, content) {
          popContext(ctx);
        },
        characters: function (chars) {
          chars = chars.trim();
          if (chars) {
            parseContent(ctx, chars);
          }
        }
      });
      return ctx[0];
    };
  }());

  var parser = new MockDOMParser();

  var codeGen = {
    requireVariables: function (deps) {
      var ret = [];
      each(deps, function (dep) {
        ret.push('require("' + dep + '")');
      });
      return ret.join(';');
    },
    registerElement: function (template) {
      return 'function registerElement(n,c){$.gk.registerElement(n,\'' + template + '\',c)}';
    },
    moduleInfo: function (id) {
      return 'var module=' + JSON.stringify({
        id: id
      });
    }
  };

  $gk.registerElement = function (name, tpl, clazz) {
    $gk.registry(name, {
      template: tpl,
      script: function () {
        var props = Object.keys(clazz || {});
        for (var i = 0, l = props.length; i < l; i += 1) {
          this[props[i]] = clazz[props[i]];
        }
      }
    });
  };

  function parseHTML(src) {
    return parser.parse(src);
  }

  function tagIs(tag) {
    return function (node) {
      return node.tagName === tag;
    };
  }

  function processLinkElements(links, config) {
    each(links, function (link) {
      var href = link.attribs.href;
      if (href) {
        config.deps.push(loadUrl(href, config.moduleId + '/../'));
      }
      link.parentNode.removeChild(link);
    });
  }

  function processScripts(scripts, config) {
    var processShim, currentShim, currentDeps,
      srces = [],
      srclen,
      shim = {},
      cfg = {
        context: 'gk'
      };
    each(scripts, function (script, idx) {
      var src = script.attribs.src;
      if (src) {
        srces.push(loadUrl(src, config.moduleId + '/../'));
      } else {
        config.script += script.innerHTML();
      }
    });
    srclen = srces.length;
    if (srclen) {
      config.deps.push(srces[srclen - 1]);
      if (srclen > 1) {
        for (var i = srclen - 1; i > 0; i -= 1) {
          shim[srces[i]] = [srces[i - 1]];
        }
        try {
          currentShim = requirejs.s.contexts.gk.config.shim;
          $.each(shim, function eachFunc(key, value) {
            currentDeps = (currentShim[key] && currentShim[key].deps) || [];
            shim[key] = value.concat(currentDeps);
          });
        } catch (e) {
          // do nothing
        }
        cfg.shim = shim;
        config.script = 'requirejs.config(' + JSON.stringify(cfg) + ');' + config.script;
      }
    }
  }

  function processTemplate(template, config) {
    processLinkElements(template.childNodes.filter(tagIs('link')), config);
    config.template = template.innerHTML();
  }

  function processModuleText(modules, config) {
    var text = '';
    each(modules, function (m) {
      text += m.innerHTML();
    });
    config.moduleText = codeGen.requireVariables(config.deps) + ';' + codeGen.registerElement(config.template) + text;
  }

  function wrapUp(config) {
    return '(function(){' + codeGen.moduleInfo(config.moduleId) + ';' + trimNewline(config.script) +
      ';define(function(' + config.vars.join() + '){' +
      config.moduleText +
      '})}());';
  }

  function generateCode(src, config) {
    var htmlEle = parseHTML(src),
      html = htmlEle.childNodes,
      links = html.filter(tagIs('link')),
      scripts = html.filter(tagIs('script')),
      eles = html.filter(tagIs('element')),
      ele = eles.length ? eles[0].childNodes : [],
      templates = ele.filter(tagIs('template')),
      modules = ele.filter(tagIs('script'));
    processLinkElements(links, config);
    processScripts(scripts, config);
    processTemplate(templates.length ? templates[0] : '', config);
    processModuleText(modules, config);
    return wrapUp(config);
  }

  return {
    load: function (name, require, onload, config) {
      require(['@text!' + name + elementExt], function (src) {
        var moduleCfg = {
          deps: [],
          vars: ['require', 'exports', 'module'],
          moduleId: name,
          template: '',
          moduleText: '',
          script: ''
        };
        onload.fromText(generateCode(src, moduleCfg));
      });
    },

    pluginBuilder: './html-build'
  };

});
