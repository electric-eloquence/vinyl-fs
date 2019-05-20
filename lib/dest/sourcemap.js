'use strict';

var through = require('through2');
var sourcemap = require('vinyl-sourcemap');

function sourcemapStream(optResolver) {
  function saveSourcemap(file, enc, callback) {
    var self = this;

    var srcMap = optResolver.resolve('sourcemaps', file);

    if (!srcMap) {
      return callback(null, file);
    }

    // eslint-disable-next-line no-undefined
    var srcMapLocation = (typeof srcMap === 'string' ? srcMap : undefined);

    sourcemap.write(file, srcMapLocation, onWrite);

    function onWrite(sourcemapErr, updatedFile, sourcemapFile) {
      /* istanbul ignore if */
      if (sourcemapErr) {
        return callback(sourcemapErr);
      }

      self.push(updatedFile);
      if (sourcemapFile) {
        self.push(sourcemapFile);
      }

      callback();
    }
  }

  return through.obj(saveSourcemap);
}

module.exports = sourcemapStream;
