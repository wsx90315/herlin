// Copyright 2004 Erik Arvidsson. All Rights Reserved.
//
// This code is triple licensed using Apache Software License 2.0,
// Mozilla Public License or GNU Public License
//
///////////////////////////////////////////////////////////////////////////////
//
// Licensed under the Apache License, Version 2.0 (the 'License'); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at http://www.apache.org/licenses/LICENSE-2.0
//
///////////////////////////////////////////////////////////////////////////////
//
// The contents of this file are subject to the Mozilla Public License
// Version 1.1 (the 'License'); you may not use this file except in
// compliance with the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
//
// Software distributed under the License is distributed on an 'AS IS'
// basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
// License for the specific language governing rights and limitations
// under the License.
//
// The Original Code is Simple HTML Parser.
//
// The Initial Developer of the Original Code is Erik Arvidsson.
// Portions created by Erik Arvidssson are Copyright (C) 2004. All Rights
// Reserved.
//
///////////////////////////////////////////////////////////////////////////////
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
///////////////////////////////////////////////////////////////////////////////
//
// Modify-by: Ke, Mingze <mingze.ke@gmail.com>
// Content:   1. Fix used regex patterns.
//            2. Optimize performance while looping dealing with chars.
// Date:      May 6th, 2014
//
///////////////////////////////////////////////////////////////////////////////
/*
var handler ={
  startElement:   function (sTagName, oAttrs) {},
  endElement:     function (sTagName) {},
  characters:   function (s) {},
  comment:    function (s) {}
};
*/

function SimpleHtmlParser() {
  this.contentHandler = null;
}

(function (htmlparser) {

  'use strict';

  var startTagRe = /^<([-A-Za-z0-9_]+)((?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
    endTagRe = /^<\/([-A-Za-z0-9_]+)[^>]*>/,
    attrRe = /([-A-Za-z0-9_]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g,
    proto = htmlparser.prototype;

  proto.parse = function (s, oHandler) {
    if (oHandler) {
      this.contentHandler = oHandler;
    }

    var l, lc, lm, rc, index, t,
      treatAsChars = false,
      oThis = this,
      endTagHandler = function () {
        return oThis.parseEndTag.apply(oThis, arguments);
      },
      startTagHandler = function () {
        return oThis.parseStartTag.apply(oThis, arguments);
      };

    while (s.length > 0) {

      // Comment
      if (s.substring(0, 4) === '<!--') {
        index = s.indexOf('-->');
        if (index != -1) {
          this.contentHandler.comment(s.substring(4, index));
          s = s.substring(index + 3);
          treatAsChars = false;
        } else {
          treatAsChars = true;
        }
      }

      // end tag
      else if (s.substring(0, 2) === '</') {
        if (endTagRe.test(s)) {
          lc = RegExp.leftContext;
          lm = RegExp.lastMatch;
          rc = RegExp.rightContext;

          lm.replace(endTagRe, endTagHandler);

          s = rc;
          treatAsChars = false;
        } else {
          treatAsChars = true;
        }
      }

      // start tag
      else if (s.charAt(0) === '<') {
        if (startTagRe.test(s)) {
          lc = RegExp.leftContext;
          lm = RegExp.lastMatch;
          rc = RegExp.rightContext;

          lm.replace(startTagRe, startTagHandler);

          s = rc;
          treatAsChars = false;
        } else {
          treatAsChars = true;
        }
      }

      if (treatAsChars) {
        index = s.indexOf('<');
        if (index === -1) {
          this.contentHandler.characters(s);
          s = '';
        } else {
          l = s.length;
          while (index !== -1 && index < l) {
            t = s.substring(index);
            if (startTagRe.test(t) || endTagRe.test(t) || t.substring(0, 4) === '<!--') {
              break;
            }
            index = s.indexOf('<', index + 1);
          }
          this.contentHandler.characters(s.substring(0, index));
          s = s.substring(index);
        }
      }

      treatAsChars = true;
    }
  };

  proto.parseStartTag = function (sTag, sTagName, sRest) {
    var attrs = this.parseAttributes(sTagName, sRest);
    this.contentHandler.startElement(sTagName, sTag, attrs);
  };

  proto.parseEndTag = function (sTag, sTagName) {
    this.contentHandler.endElement(sTagName, sTag);
  };

  proto.parseAttributes = function (sTagName, s) {
    var oThis = this;
    var attrs = [];
    s.replace(attrRe, function (a0, a1, a2, a3, a4, a5, a6) {
      attrs.push(oThis.parseAttribute(sTagName, a0, a1, a2, a3, a4, a5, a6));
    });
    return attrs;
  };

  proto.parseAttribute = function (sTagName, sAttribute, sName) {
    var value = null;
    if (arguments[3]) {
      value = arguments[3];
    } else if (arguments[4]) {
      value = arguments[4];
    }
    return {
      name: sName,
      value: value
    };
  };

}(SimpleHtmlParser));
