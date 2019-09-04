'use strict';

var fs = require('fs');
var removeBomStream = require('remove-bom-stream');
var lazystream = require('lazystream');
var createResolver = require('resolve-options');

function streamFile(file, optResolver_, onRead_) {
  var optResolver;
  var onRead;

  if (typeof optResolver_ === 'function') {
    optResolver = createResolver();
    onRead = optResolver_;
  } else {
    optResolver = optResolver_;
    onRead = onRead_;
  }

  var filePath = file.path;

  var removeBOM = optResolver.resolve('removeBOM', file);

  file.contents = new lazystream.Readable(function() {
    var contents = fs.createReadStream(filePath);

    if (removeBOM) {
      return contents.pipe(removeBomStream());
    }

    return contents;
  });

  onRead();
}

module.exports = streamFile;
