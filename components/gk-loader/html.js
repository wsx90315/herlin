define(['module'], function (module) {

  'use strict';

  var parser = new window.DOMParser();

  (function (parser) {
    var proto_parseFromString = window.DOMParser.prototype.parseFromString;

    // Firefox/Opera/IE throw errors on unsupported types
    try {
      // WebKit returns null on unsupported types
      if (parser.parseFromString('', 'text/html')) {
        // text/html parsing is natively supported
        return;
      }
    } catch (ex) {}

    parser.parseFromString = function (markup, type) {
      if (/^\s*text\/html\s*(?:;|$)/i.test(type)) {
        var doc = document.implementation.createHTMLDocument('');
        if (markup.toLowerCase().indexOf('<!doctype') > -1) {
          doc.documentElement.innerHTML = markup;
        } else {
          doc.body.innerHTML = markup;
        }
        return doc;
      } else {
        return proto_parseFromString.apply(this, arguments);
      }
    };
  }(parser));

  var elementExt = '.html',
    moduleConfig = module.config(),
    lib = moduleConfig.lib,
    loadUrl = lib.loadUrl,
    trimHtml = lib.trimHtml,
    trimNewline = lib.trimNewline,
    each = lib.each,
    $ = lib.$,
    $gk = $.gk;

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
    return parser.parseFromString('<body>' + src + '</body>', 'text/html').querySelector('body');
  }

  function processLinkElements($links, config) {
    $links.each(function (idx, link) {
      var href = link.getAttribute('href');
      if (href) {
        config.deps.push(loadUrl(href, config.moduleId + '/../'));
      }
      $(link).remove();
    });
  }

  function processScripts($scripts, config) {
    var processShim, currentShim, currentDeps,
      srces = [],
      srclen,
      shim = {},
      cfg = {
        context: 'gk'
      };
    $scripts.each(function (idx, script) {
      var src = script.getAttribute('src');
      if (src) {
        srces.push(loadUrl(src, config.moduleId + '/../'));
      } else {
        config.script += $(script).text();
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

  function processTemplate($template, config) {
    var $tmp = $('<div>' + $template.html() + '</div>');
    processLinkElements($tmp.find('link'), config);
    config.template = trimHtml(trimNewline($tmp.html()));
    $template.html($tmp.html());
  }

  function processModuleText($module, config) {
    config.moduleText = codeGen.requireVariables(config.deps) + ';' + codeGen.registerElement(config.template) + ($module.length ? $module.text() : '');
  }

  function wrapUp(config) {
    return '(function(){' + codeGen.moduleInfo(config.moduleId) + ';' + trimNewline(config.script) +
      ';define(function(' + config.vars.join() + '){' +
      config.moduleText +
      '})}());';
  }

  function generateCode(src, config) {
    var htmlEle = parseHTML(src),
      $html = $(htmlEle),
      $links = $html.find('link'),
      $scripts = $html.children('script'),
      $ele = $html.children('element').first(),
      $template = $ele.children('template').first(),
      $module = $ele.children('script');
    processLinkElements($links, config);
    processScripts($scripts, config);
    processTemplate($template, config);
    processModuleText($module, config);
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
