'use strict';

var path = require('path');

var fs = require('fs');
var Vinyl = require('vinyl');
var through = require('through2');

function prepareSymlink(folderResolver, optResolver) {
  /* istanbul ignore if */
  if (!folderResolver) {
    throw new Error('Invalid output folder');
  }

  function normalize(file_, enc, cb) {
    if (!Vinyl.isVinyl(file_)) {
      return cb(new Error('Received a non-Vinyl object in `symlink()`'));
    }

    var file;

    if (typeof file_.isSymbolic !== 'function') {
      file = new Vinyl(file_);
    } else {
      file = file_;
    }

    var cwd = path.resolve(optResolver.resolve('cwd', file));

    var outFolderPath = folderResolver.resolve('outFolder', file);
    /* istanbul ignore if */
    if (!outFolderPath) {
      return cb(new Error('Invalid output folder'));
    }
    var basePath = path.resolve(cwd, outFolderPath);
    var writePath = path.resolve(basePath, file.relative);

    // Wire up new properties
    // Note: keep the target stats for now, we may need them in link-file
    file.stat = file.stat || new fs.Stats();
    file.cwd = cwd;
    file.base = basePath;
    // This is the path we are linking *TO*
    file.symlink = file.path;
    file.path = writePath;
    // We have to set contents to null for a link
    // Otherwise `isSymbolic()` returns false
    file.contents = null;

    cb(null, file);
  }

  return through.obj(normalize);
}

module.exports = prepareSymlink;
