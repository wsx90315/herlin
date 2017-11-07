define(function (localRequire, exports, module) {

  'use strict';

  var $ = require.nodeRequire('cheerio'),
    utils = require.nodeRequire(module.uri + '/../lib/utils'),
    uglifyjs = require.nodeRequire('uglify-js'),
    loadUrl = utils.loadUrl,
    trimHtml = utils.trimHtml,
    trimNewline = utils.trimNewline,
    each = utils.each;

  var elementExt = '.html',
    buildMap = {};

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

  function processLinkElements($links, config) {
    $links.each(function (idx, link) {
      var href = link.attribs.href;
      if (href) {
        config.deps.push(loadUrl(href, config.moduleId + '/../'));
      }
      $(link).remove();
    });
  }

  function processScripts($scripts, config) {
    var srces = [],
      srclen;
    $scripts.each(function (idx, script) {
      var src = script.attribs.src;
      if (src) {
        srces.push(loadUrl(src, config.moduleId + '/../'));
      } else {
        config.script += $(script).text();
      }
    });
    srclen = srces.length;
    if (srclen) {
      config.deps.push(srces[srclen - 1]);
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
    var $html = $('<div>' + src + '</div>'),
      $links = $html.find('link'),
      $scripts = $html.children('script'),
      $ele = $html.children('element').first(),
      $template = $ele.children('template').first(),
      $module = $ele.children('script');
    processLinkElements($links, config);
    processScripts($scripts, config);
    processTemplate($template, config);
    processModuleText($module, config);
    return uglifyjs.minify(wrapUp(config), {
      fromString: true,
      mangle: {
        except: config.vars
      }
    }).code;
  }

  return {
    load: function (name, req, onload, config) {
      var src = utils.loadFile(req.toUrl(name + elementExt)),
        moduleCfg = {
          deps: [],
          vars: ['require', 'exports', 'module'],
          moduleId: name,
          template: '',
          moduleText: '',
          script: ''
        }, code;
      code = generateCode(src, moduleCfg);
      buildMap[name] = code;
      onload.fromText(code);
    },

    write: function (pluginName, moduleName, write) {
      if (moduleName in buildMap) {
        write.asModule(pluginName + '!' + moduleName, buildMap[moduleName]);
      }
    }
  };

});
