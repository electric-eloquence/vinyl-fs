'use strict';

var os = require('os');
var through = require('through2');
var fo = require('../file-operations');
var isWindows = (os.platform() === 'win32');

function resolveSymlinks(optResolver) {
  // A stat property is exposed on file objects as a (wanted) side effect
  function resolveFile(file, enc, callback) {
    fo.reflectLinkStat(file.path, file, onReflect);

    function onReflect(statErr) {
      /* istanbul ignore if */
      if (statErr) {
        // Cannot stat symlinks in Windows so just callback as though no error
        if (isWindows) {
          return callback(null, file);
        } else {
          return callback(statErr);
        }
      }

      if (!file.stat.isSymbolicLink()) {
        return callback(null, file);
      }

      var resolveSymlinks = optResolver.resolve('resolveSymlinks', file);

      if (!resolveSymlinks) {
        return callback(null, file);
      }

      // Get target's stats
      fo.reflectStat(file.path, file, onReflect);
    }
  }

  return through.obj(resolveFile);
}

module.exports = resolveSymlinks;
