'use strict';

var inherits = require('util').inherits;
var path = require('path');

var extend = require('extend');
var glob = require('glob');
var isGlob = require('is-glob');
var Readable = require('readable-stream').Readable;
var removeTrailingSeparator = require('remove-trailing-separator');
var slash = require('slash');
var toAbsoluteGlob = require('to-absolute-glob');

var globErrMessage1 = 'File not found with singular glob: ';
var globErrMessage2 = ' (if this was purposeful, use `allowEmpty` option)';

function getBasePath(ourGlob, opt) {
  var absoluteGlob = toAbsoluteGlob(ourGlob, opt);
  var globCandidate = absoluteGlob;

  // flip windows path separators where backslashes are not intentional escape
  // characters
  /* istanbul ignore if */
  if (process.platform === 'win32' && absoluteGlob.indexOf('/') === -1) {
    globCandidate = slash(absoluteGlob);
  }

  var globParent = '';
  if (isGlob(globCandidate)) {
    var globSplit = globCandidate.split('/');
    for (var i = 0; i < globSplit.length; i++) {
      if (isGlob(globSplit[i])) {
        break;
      } else {
        globParent += globSplit[i] + '/';
      }
    }
  } else {
    globParent = path.dirname(absoluteGlob) + '/';
  }

  return globParent || './';
}

function globIsSingular(glob) {
  var globSet = glob.minimatch.set;
  if (globSet.length !== 1) {
    return false;
  }

  return globSet[0].every(function isString(value) {
    return typeof value === 'string';
  });
}

function GlobStream(ourGlob_, negatives, opt) {
  if (!(this instanceof GlobStream)) {
    return new GlobStream(ourGlob_, negatives, opt);
  }

  var ourOpt = extend({}, opt);

  Readable.call(this, {
    objectMode: true,
    highWaterMark: ourOpt.highWaterMark || 16
  });

  // Delete `highWaterMark` after inheriting from Readable
  delete ourOpt.highWaterMark;

  var self = this;

  function resolveNegatives(negative) {
    return toAbsoluteGlob(negative, ourOpt);
  }

  var ourNegatives = negatives.map(resolveNegatives);
  ourOpt.ignore = ourNegatives;

  var cwd = ourOpt.cwd;
  var allowEmpty = ourOpt.allowEmpty || false;

  // Extract base path from glob
  var basePath = ourOpt.base || getBasePath(ourGlob_, ourOpt);

  // Remove path relativity to make globs make sense
  var ourGlob = toAbsoluteGlob(ourGlob_, ourOpt);
  // Delete `root` after all resolving done
  delete ourOpt.root;

  var globber = new glob.Glob(ourGlob, ourOpt);
  this._globber = globber;

  var found = false;

  globber.on('match', function(filepath) {
    found = true;
    var obj = {
      cwd: cwd,
      base: basePath,
      path: removeTrailingSeparator(filepath)
    };
    if (!self.push(obj)) {
      globber.pause();
    }
  });

  globber.once('end', function() {
    if (allowEmpty !== true && !found && globIsSingular(globber)) {
      var err = new Error(globErrMessage1 + ourGlob + globErrMessage2);

      return self.destroy(err);
    }

    self.push(null);
  });

  function onError(err) {
    /* istanbul ignore next */
    self.destroy(err);
  }

  globber.once('error', onError);
}
inherits(GlobStream, Readable);

GlobStream.prototype._read = function() {
  this._globber.resume();
};

GlobStream.prototype.destroy = function(err) {
  var self = this;

  this._globber.abort();

  process.nextTick(function() {
    if (err) {
      self.emit('error', err);
    }
    self.emit('close');
  });
};

module.exports = GlobStream;
