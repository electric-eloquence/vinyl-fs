'use strict';

var path = require('path');

var expect = require('expect');
var fs = require('fs');
var File = require('vinyl');
var miss = require('mississippi');
var mkdirp = require('fs-mkdirp-stream/mkdirp');
var rimraf = require('rimraf');

var vfs = require('../');

var isWindows = require('./utils/is-windows');
var testConstants = require('./utils/test-constants');

var concat = miss.concat;
var from = miss.from;
var pipe = miss.pipe;

var pathElement = 'dest-owner';
var destOwnerInputBase = path.join(testConstants.inputBase, pathElement);
var destOwnerInputPath = path.join(destOwnerInputBase, pathElement + '.test');
var destOwnerOutputBase = path.join(testConstants.outputBase, pathElement);

var contents = fs.readFileSync(destOwnerInputPath, 'utf8');
var skipWindows = isWindows ? xit : it;

describe('.dest() with custom owner', function() {
  beforeEach(function(done) {
    mkdirp(destOwnerOutputBase, done);
  });

  afterEach(function() {
    jest.restoreAllMocks();
    rimraf.sync(destOwnerOutputBase);
  });

  skipWindows('does not call fchown when the uid and gid provided on the vinyl stat are invalid', function(done) {
    var fchownSpy = jest.spyOn(fs, 'fchown');

    var file = new File({
      base: destOwnerInputBase,
      path: destOwnerInputPath,
      contents: Buffer.from(contents),
      stat: {
        uid: -1,
        gid: -1,
      },
    });

    function assert() {
      expect(fchownSpy).not.toHaveBeenCalled();
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOwnerOutputBase),
      concat(assert),
    ], done);
  });
});
