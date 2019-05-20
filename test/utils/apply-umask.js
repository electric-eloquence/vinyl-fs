'use strict';

function applyUmask(mode_) {
  var mode = mode_;

  if (typeof mode !== 'number') {
    mode = parseInt(mode, 8);
  }

  return (mode & ~process.umask());
}

module.exports = applyUmask;
