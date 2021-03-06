'use strict';

var path = require('path');

var fs = require('fs');
var Vinyl = require('vinyl');
var through = require('through2');

function prepareWrite(folderResolver, optResolver) {
  /* istanbul ignore if */
  if (!folderResolver) {
    throw new Error('Invalid output folder');
  }

  function normalize(file_, enc, cb) {
    if (!Vinyl.isVinyl(file_)) {
      return cb(new Error('Received a non-Vinyl object in `dest()`'));
    }

    var file;

    if (typeof file_.isSymbolic !== 'function') {
      file = new Vinyl(file_);
    } else {
      file = file_;
    }

    var outFolderPath = folderResolver.resolve('outFolder', file);
    /* istanbul ignore if */
    if (!outFolderPath) {
      return cb(new Error('Invalid output folder'));
    }
    var cwd = path.resolve(optResolver.resolve('cwd', file));
    var basePath = path.resolve(cwd, outFolderPath);
    var writePath = path.resolve(basePath, file.relative);

    // Wire up new properties
    file.cwd = cwd;
    file.base = basePath;
    file.path = writePath;
    if (!file.isSymbolic()) {
      var mode = optResolver.resolve('mode', file);
      file.stat = (file.stat || new fs.Stats());
      file.stat.mode = mode;
    }

    cb(null, file);
  }

  return through.obj(normalize);
}

module.exports = prepareWrite;
