uglifyjs ../gk-loader.js -c -m > ../gk-loader.min.js
uglifyjs ../html.js -c -m -r keys,gk > ../html.min.js
uglifyjs ../html-ie8.js -c -m -r keys,gk > ../html-ie8.min.js
uglifyjs ../wdgt.js -c -m > ../wdgt.min.js
uglifyjs ../lib/simplehtmlparser.js -c -m > ../lib/simplehtmlparser.min.js