'use strict';

var os = require('os');
var util = require('util');

var fs = require('fs');
var assign = require('object.assign');
var Writable = require('stream').Writable;

var constants = require('./constants');

var APPEND_MODE_REGEXP = /a/;
var isWindows = (os.platform() === 'win32');

function closeFd(propagatedErr, fd, callback) {
  if (typeof fd !== 'number') {
    return callback(propagatedErr);
  }

  fs.close(fd, onClosed);

  function onClosed(closeErr) {
    if (propagatedErr || closeErr) {
      return callback(propagatedErr || closeErr);
    }

    callback();
  }
}

function isValidUnixId(id) {
  if (typeof id !== 'number') {
    return false;
  }

  if (id < 0) {
    return false;
  }

  return true;
}

function getFlags(options) {
  var flags = !options.append ? 'w' : 'a';

  if (!options.overwrite) {
    flags += 'x';
  }

  return flags;
}

function isFatalOverwriteError(err, flags) {
  if (!err) {
    return false;
  }

  if (err.code === 'EEXIST' && flags[1] === 'x') {
    // Handle scenario for file overwrite failures.
    return false;
  }

  // Otherwise, this is a fatal error
  return true;
}

function isFatalUnlinkError(err) {
  if (!err || err.code === 'ENOENT') {
    return false;
  }

  return true;
}

function getModeDiff(fsMode, vinylMode) {
  var modeDiff = 0;

  if (typeof vinylMode === 'number') {
    modeDiff = (vinylMode ^ fsMode) & constants.MASK_MODE;
  }

  return modeDiff;
}

function getOwnerDiff(fsStat, vinylStat) {
  if (!isValidUnixId(vinylStat.uid) &&
      !isValidUnixId(vinylStat.gid)) {
    return;
  }

  if ((!isValidUnixId(fsStat.uid) && !isValidUnixId(vinylStat.uid)) ||
      (!isValidUnixId(fsStat.gid) && !isValidUnixId(vinylStat.gid))) {
    return;
  }

  var uid = fsStat.uid; // Default to current uid.

  if (isValidUnixId(vinylStat.uid)) {
    uid = vinylStat.uid;
  }

  var gid = fsStat.gid; // Default to current gid.

  if (isValidUnixId(vinylStat.gid)) {
    gid = vinylStat.gid;
  }

  if (uid === fsStat.uid && gid === fsStat.gid) {
    return;
  }

  var ownerDiff = {
    uid: uid,
    gid: gid
  };

  return ownerDiff;
}

function isOwner(fsStat) {
  var hasGetuid = (typeof process.getuid === 'function');
  var hasGeteuid = (typeof process.geteuid === 'function');

  // If we don't have either, assume we don't have permissions.
  // This should only happen on Windows.
  // Windows basically noops fchmod and errors on futimes called on directories.
  /* istanbul ignore if */
  if (!hasGeteuid && !hasGetuid) {
    return false;
  }

  var uid;

  if (hasGeteuid) {
    uid = process.geteuid();
  } else {
    uid = process.getuid();
  }

  if (fsStat.uid !== uid && uid !== 0) {
    return false;
  }

  return true;
}

function reflectStat(path, file, callback) {
  // Set file.stat to the reflect current state on disk
  fs.stat(path, onStat);

  function onStat(statErr, stat) {
    if (statErr) {
      return callback(statErr);
    }

    file.stat = stat;
    callback();
  }
}

function reflectLinkStat(path, file, callback) {
  fs.lstat(path, onLstat);

  function onLstat(lstatErr, stat) {
    if (lstatErr) {
      return callback(lstatErr);
    }

    file.stat = file.stat || {};

    // Copy stat prototype to file.stat
    Object.setPrototypeOf(file.stat, Object.getPrototypeOf(stat));

    // In most cases, set file.stat to the reflect current state on disk.
    // However, allow submission of vinyl objects with set stat properties.
    // Overwrite file.stat with any such valid and non-empty properties.
    // The only exception is .mode in Windows.
    Object.keys(stat).forEach(function(key) {
      /* istanbul ignore if */
      if (isWindows && key === 'mode') {
        file.stat[key] = stat[key];
      } else {
        switch (typeof file.stat[key]) {
          case 'undefined':
            file.stat[key] = stat[key];
            break;
          case 'object':
            /* istanbul ignore if */
            if (!file.stat[key]) { // null
              file.stat[key] = stat[key];
              break;
            }
            /* istanbul ignore if */
            if (typeof file.stat[key].valueOf !== 'function') {
              break;
            }
            if (isNaN(file.stat[key].valueOf())) {
              file.stat[key] = stat[key];
            }
            break;
        }
      }
    });

    callback();
  }
}

function updateMetadata(fd, file, callback) {
  fs.fstat(fd, onStat);

  function onStat(statErr, stat) {
    if (statErr) {
      return callback(statErr);
    }

    // Check if mode needs to be updated
    var modeDiff = getModeDiff(stat.mode, file.stat.mode);

    // Check if uid/gid need to be updated
    var ownerDiff = getOwnerDiff(stat, file.stat);

    // Set file.stat to the reflect current state on disk
    assign(file.stat, stat);

    // Check access. `fchmod` & `fchown` only work if we own the file,
    // or if we are effectively root (`fchown` only when root).
    if (!isOwner(stat)) {
      return callback();
    }

    if (modeDiff) {
      return mode();
    }

    if (ownerDiff) {
      return owner();
    }

    callback();

    function mode() {
      var mode = stat.mode ^ modeDiff;

      fs.fchmod(fd, mode, onFchmod);

      function onFchmod(fchmodErr) {
        if (!fchmodErr) {
          file.stat.mode = mode;
        }

        if (ownerDiff) {
          return owner(fchmodErr);
        }

        callback(fchmodErr);
      }
    }

    function owner(propagatedErr) {
      fs.fchown(fd, ownerDiff.uid, ownerDiff.gid, onFchown);

      function onFchown(fchownErr) {
        // There is no reasonable way to test as a different user without sudo.
        /* istanbul ignore if */
        if (!fchownErr) {
          file.stat.uid = ownerDiff.uid;
          file.stat.gid = ownerDiff.gid;
        }

        callback(propagatedErr || fchownErr);
      }
    }
  }
}

function symlink(srcPath, destPath, opts, callback) {
  // Because fs.symlink does not allow atomic overwrite option with flags, we
  // delete and recreate if the link already exists and overwrite is true.
  if (opts.flags === 'w') {
    // TODO What happens when we call unlink with windows junctions?
    fs.unlink(destPath, onUnlink);
  } else {
    fs.symlink(srcPath, destPath, opts.type, onSymlink);
  }

  function onUnlink(unlinkErr) {
    if (isFatalUnlinkError(unlinkErr)) {
      return callback(unlinkErr);
    }

    fs.symlink(srcPath, destPath, opts.type, onSymlink);
  }

  function onSymlink(symlinkErr) {
    /* istanbul ignore if */
    if (isFatalOverwriteError(symlinkErr, opts.flags)) {
      return callback(symlinkErr);
    }

    callback();
  }
}

/*
  Custom writeFile implementation because we need access to the
  file descriptor after the write is complete.
  Most of the implementation taken from node core.
 */
function writeFile(filepath, data, options_, callback_) {
  var options;
  var callback;

  if (typeof options_ === 'function') {
    options = {};
    callback = options_;
  } else {
    options = options_ || {};
    callback = callback_;
  }

  if (!Buffer.isBuffer(data)) {
    return callback(new TypeError('Data must be a Buffer'));
  }

  // Default the same as node
  var mode = options.mode || constants.DEFAULT_FILE_MODE;
  var flags = options.flags || 'w';
  var position = APPEND_MODE_REGEXP.test(flags) ? null : 0;

  fs.open(filepath, flags, mode, onOpen);

  function onOpen(openErr, fd) {
    if (openErr) {
      return onComplete(openErr);
    }

    fs.write(fd, data, 0, data.length, position, onComplete);

    function onComplete(writeErr) {
      callback(writeErr, fd);
    }
  }
}

function createWriteStream(path, options, flush) {
  return new WriteStream(path, options, flush);
}

// Taken from node core and altered to receive a flush function and simplified
// To be used for cleanup (like updating times/mode/etc)
// Not exposed so we can avoid the case where someone doesn't use `new`
function WriteStream(path, options_, flush_) {
  var options;
  var flush;

  if (typeof options_ === 'function') {
    options = {};
    flush = options_;
  } else {
    options = options_ || {};
    flush = flush_;
  }

  Writable.call(this, options);

  this.flush = flush;
  this.path = path;

  this.mode = options.mode || constants.DEFAULT_FILE_MODE;
  this.flags = options.flags || 'w';

  // Used by node's `fs.WriteStream`
  this.fd = null;
  this.start = null;

  this.open();

  // Dispose on finish.
  this.once('finish', this.close);
}

util.inherits(WriteStream, Writable);

WriteStream.prototype.open = function() {
  var self = this;

  fs.open(this.path, this.flags, this.mode, onOpen);

  function onOpen(openErr, fd) {
    if (openErr) {
      self.destroy();
      self.emit('error', openErr);
      return;
    }

    self.fd = fd;
    self.emit('open', fd);
  }
};

// Use our `end` method since it is patched for flush
WriteStream.prototype.destroySoon = WriteStream.prototype.end;

WriteStream.prototype._destroy = function(err, cb) {
  this.close(function(err2) {
    /* istanbul ignore next */
    cb(err || err2);
  });
};

WriteStream.prototype.close = function(cb) {
  var that = this;

  if (cb) {
    this.once('close', cb);
  }

  if (this.closed || typeof this.fd !== 'number') {
    /* istanbul ignore if */
    if (typeof this.fd === 'number') { // Nearly impossible to reach this.
      return process.nextTick(function() {
        that.emit('close');
      });
    }

    this.once('open', closeOnOpen);
    return;
  }

  this.closed = true;

  fs.close(this.fd, function(er) {
    if (er) {
      /* istanbul ignore next */
      that.emit('error', er);
    } else {
      that.emit('close');
    }
  });

  this.fd = null;
};

WriteStream.prototype._final = function(callback) {
  if (typeof this.flush !== 'function') {
    return callback();
  }

  this.flush(this.fd, callback);
};

function closeOnOpen() {
  this.close();
}

WriteStream.prototype._write = function(data, encoding, callback) {
  var self = this;

  /* istanbul ignore if */
  if (!Buffer.isBuffer(data)) {
    return this.emit('error', new Error('Invalid data'));
  }

  if (typeof this.fd !== 'number') {
    return this.once('open', onOpen);
  }

  fs.write(this.fd, data, 0, data.length, null, onWrite);

  function onOpen() {
    self._write(data, encoding, callback);
  }

  function onWrite(writeErr) {
    if (writeErr) {
      self.destroy();
      callback(writeErr);
      return;
    }

    callback();
  }
};

module.exports = {
  closeFd: closeFd,
  isValidUnixId: isValidUnixId,
  getFlags: getFlags,
  isFatalOverwriteError: isFatalOverwriteError,
  isFatalUnlinkError: isFatalUnlinkError,
  getModeDiff: getModeDiff,
  getOwnerDiff: getOwnerDiff,
  isOwner: isOwner,
  reflectStat: reflectStat,
  reflectLinkStat: reflectLinkStat,
  updateMetadata: updateMetadata,
  symlink: symlink,
  writeFile: writeFile,
  createWriteStream: createWriteStream
};
