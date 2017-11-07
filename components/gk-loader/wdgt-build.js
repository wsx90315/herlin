define(function (localRequire, exports, module) {

  'use strict';

  var utils = require.nodeRequire(module.uri + '/../lib/utils'),
    uglifyjs = require.nodeRequire('uglify-js');

  var widgetExt = '.js',
    buildMap = {};

  function generateCode(src) {
    return uglifyjs.minify('define(function(){return ' + src + '});', {
      fromString: true
    }).code;
  }

  return {
    load: function (name, req, onload, config) {
      var code = generateCode(utils.loadFile(req.toUrl(name + widgetExt)));
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
