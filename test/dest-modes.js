'use strict';

var path = require('path');

var expect = require('expect');
var fs = require('fs');
var File = require('vinyl');
var miss = require('mississippi');
var mkdirp = require('fs-mkdirp-stream/mkdirp');
var rimraf = require('rimraf');

var vfs = require('../');

var always = require('./utils/always');
var applyUmask = require('./utils/apply-umask');
var isWindows = require('./utils/is-windows');
var mockError = require('./utils/mock-error');
var statMode = require('./utils/stat-mode');
var testConstants = require('./utils/test-constants');

var concat = miss.concat;
var from = miss.from;
var pipe = miss.pipe;

var pathElement = 'dest-modes';
var destModesInputBase = path.join(testConstants.inputBase, pathElement);
var destModesInputPath = path.join(destModesInputBase, pathElement + '.test');
var destModesInputNestedBase = path.join(destModesInputBase, 'foo');
var destModesInputNestedPath = path.join(destModesInputNestedBase, 'bar.txt');
var destModesOutputBase = path.join(testConstants.outputBase, pathElement);
var destModesOutputPath = path.join(destModesOutputBase, pathElement + '.test');
var destModesOutputNestedBase = path.join(destModesOutputBase, 'foo');
var destModesOutputNestedPath = path.join(destModesOutputBase, 'bar.txt');

var contents = fs.readFileSync(destModesInputPath, 'utf8');
var skipWindows = isWindows ? xit : it;

describe('.dest() with custom modes', function() {
  beforeEach(function(done) {
    mkdirp(destModesOutputBase, done);
  });

  afterEach(function() {
    jest.restoreAllMocks();
    rimraf.sync(destModesOutputBase);
  });

  // Changing the mode of a file is not supported by node.js in Windows.
  // Windows is treated as though it does not have permission to make this operation.
  skipWindows('sets the mode of a written buffer file if set on the vinyl object', function(done) {
    var expectedMode = applyUmask('677');

    var file = new File({
      base: destModesInputBase,
      path: destModesInputPath,
      contents: Buffer.from(contents),
      stat: {
        mode: expectedMode
      }
    });

    function assert() {
      expect(statMode(destModesOutputPath)).toBe(expectedMode);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destModesOutputBase, { cwd: __dirname }),
      concat(assert)
    ], done);
  });

  skipWindows('sets the sticky bit on the mode of a written stream file if set on the vinyl object', function(done) {
    var expectedMode = applyUmask('1677');

    var file = new File({
      base: destModesInputBase,
      path: destModesInputPath,
      contents: from([contents]),
      stat: {
        mode: expectedMode
      }
    });

    function assert() {
      expect(statMode(destModesOutputPath)).toBe(expectedMode);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destModesOutputBase, { cwd: __dirname }),
      concat(assert)
    ], done);
  });

  skipWindows('sets the mode of a written stream file if set on the vinyl object', function(done) {
    var expectedMode = applyUmask('677');

    var file = new File({
      base: destModesInputBase,
      path: destModesInputPath,
      contents: from([contents]),
      stat: {
        mode: expectedMode
      }
    });

    function assert() {
      expect(statMode(destModesOutputPath)).toBe(expectedMode);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destModesOutputBase, { cwd: __dirname }),
      concat(assert)
    ], done);
  });

  skipWindows('sets the mode of a written directory if set on the vinyl object', function(done) {
    var expectedMode = applyUmask('677');

    var file = new File({
      base: destModesInputBase,
      path: destModesInputNestedBase,
      contents: null,
      stat: {
        isDirectory: always(true),
        mode: expectedMode
      }
    });

    function assert() {
      expect(statMode(destModesOutputNestedBase)).toBe(expectedMode);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destModesOutputBase, { cwd: __dirname }),
      concat(assert)
    ], done);
  });

  skipWindows('sets sticky bit on the mode of a written directory if set on the vinyl object', function(done) {
    var expectedMode = applyUmask('1677');

    var file = new File({
      base: destModesInputBase,
      path: destModesInputNestedBase,
      contents: null,
      stat: {
        isDirectory: always(true),
        mode: expectedMode
      }
    });

    function assert() {
      expect(statMode(destModesOutputNestedBase)).toBe(expectedMode);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destModesOutputBase, { cwd: __dirname }),
      concat(assert)
    ], done);
  });

  skipWindows('writes new files with the mode specified in options', function(done) {
    var expectedMode = applyUmask('777');

    var file = new File({
      base: destModesInputBase,
      path: destModesInputPath,
      contents: Buffer.from(contents)
    });

    function assert() {
      expect(statMode(destModesOutputPath)).toBe(expectedMode);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destModesOutputBase, { cwd: __dirname, mode: expectedMode }),
      concat(assert)
    ], done);
  });

  skipWindows('updates the file mode to match the vinyl mode', function(done) {
    var startMode = applyUmask('655');
    var expectedMode = applyUmask('722');

    var file = new File({
      base: destModesInputBase,
      path: destModesInputPath,
      contents: Buffer.from(contents),
      stat: {
        mode: expectedMode
      }
    });

    function assert() {
      expect(statMode(destModesOutputPath)).toBe(expectedMode);
    }

    fs.closeSync(fs.openSync(destModesOutputPath, 'w'));
    fs.chmodSync(destModesOutputPath, startMode);

    pipe([
      from.obj([file]),
      vfs.dest(destModesOutputBase, { cwd: __dirname }),
      concat(assert)
    ], done);
  });

  skipWindows('updates the directory mode to match the vinyl mode', function(done) {
    var startMode = applyUmask('2777');
    var expectedMode = applyUmask('727');

    var file1 = new File({
      base: destModesInputBase,
      path: destModesInputNestedBase,
      stat: {
        isDirectory: always(true),
        mode: startMode
      }
    });
    var file2 = new File({
      base: destModesInputBase,
      path: destModesInputNestedBase,
      stat: {
        isDirectory: always(true),
        mode: expectedMode
      }
    });

    function assert() {
      expect(statMode(destModesOutputNestedBase)).toBe(expectedMode);
    }

    pipe([
      from.obj([file1, file2]),
      vfs.dest(destModesOutputBase, { cwd: __dirname }),
      concat(assert)
    ], done);
  });

  skipWindows('uses different modes for files and directories', function(done) {
    var expectedDirMode = applyUmask('2777');
    var expectedFileMode = applyUmask('755');

    var file = new File({
      base: destModesInputNestedBase,
      path: destModesInputNestedPath,
      contents: Buffer.from(contents)
    });

    function assert() {
      expect(statMode(destModesOutputBase)).toBe(expectedDirMode);
      expect(statMode(destModesOutputNestedPath)).toBe(expectedFileMode);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destModesOutputBase, {
        cwd: __dirname,
        mode: expectedFileMode,
        dirMode: expectedDirMode
      }),
      concat(assert)
    ], done);
  });

  skipWindows('does not fchmod a matching file', function(done) {
    var fchmodSpy = jest.spyOn(fs, 'fchmod');

    var expectedMode = applyUmask('777');

    var file = new File({
      base: destModesInputBase,
      path: destModesInputPath,
      contents: Buffer.from(contents),
      stat: {
        mode: expectedMode
      }
    });

    function assert() {
      expect(fchmodSpy).not.toHaveBeenCalled();
      expect(statMode(destModesOutputPath)).toBe(expectedMode);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destModesOutputBase, { cwd: __dirname }),
      concat(assert)
    ], done);
  });

  skipWindows('sees a file with special chmod (setuid/setgid/sticky) as distinct', function(done) {
    var fchmodSpy = jest.spyOn(fs, 'fchmod');

    var startMode = applyUmask('3722');
    var expectedMode = applyUmask('722');

    var file = new File({
      base: destModesInputBase,
      path: destModesInputPath,
      contents: Buffer.from(contents),
      stat: {
        mode: expectedMode
      }
    });

    function assert() {
      expect(fchmodSpy).toHaveBeenCalled();
    }

    fs.closeSync(fs.openSync(destModesOutputPath, 'w'));
    fs.chmodSync(destModesOutputPath, startMode);

    pipe([
      from.obj([file]),
      vfs.dest(destModesOutputBase, { cwd: __dirname }),
      concat(assert)
    ], done);
  });

  skipWindows('reports fchmod errors', function(done) {
    var expectedMode = applyUmask('722');

    var fchmodSpy = jest.spyOn(fs, 'fchmod').mockImplementation(mockError);

    var file = new File({
      base: destModesInputBase,
      path: destModesInputPath,
      contents: Buffer.from(contents),
      stat: {
        mode: expectedMode
      }
    });

    function assert(err) {
      expect(err).toBeInstanceOf(Error);
      expect(fchmodSpy).toHaveBeenCalled();
      done();
    }

    fs.closeSync(fs.openSync(destModesOutputPath, 'w'));

    pipe([
      from.obj([file]),
      vfs.dest(destModesOutputBase, { cwd: __dirname })
    ], assert);
  });
});
