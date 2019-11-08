'use strict';

var path = require('path');

var expect = require('expect');
var fs = require('fs');
var miss = require('mississippi');
var rimraf = require('rimraf');

var vfs = require('../');

var isWindows = require('./utils/is-windows');
var testConstants = require('./utils/test-constants');
var testStreams = require('./utils/test-streams');

var concat = miss.concat;
var pipe = miss.pipe;

var count = testStreams.count;

var pathElement = 'integration';
var integrationInputBase = path.join(testConstants.inputBase, pathElement);
var integrationOutputBase = path.join(testConstants.outputBase, pathElement);
var inputIn = path.join(integrationOutputBase, 'in');
var inputGlob = path.join(inputIn, '*.txt');
var outputOut = path.join(integrationOutputBase, 'out');
var outputDirpathSymlink = path.join(integrationOutputBase, 'foo');
var outputSymlink = path.join(integrationOutputBase, pathElement);
var outputDest = path.join(outputDirpathSymlink, pathElement);

var contents = 'Hello World!\n';
var onlyWindows = isWindows ? it : xit;
var skipWindows = isWindows ? xit : it;

describe('integrations', function() {
  beforeEach(function() {
    if (!fs.existsSync(testConstants.outputBase)) {
      fs.mkdirSync(testConstants.outputBase);
    }
    if (!fs.existsSync(integrationOutputBase)) {
      fs.mkdirSync(integrationOutputBase);
    }
    if (!fs.existsSync(inputIn)) {
      fs.mkdirSync(inputIn);
    }
    if (!fs.existsSync(outputOut)) {
      fs.mkdirSync(outputOut);
    }
    if (!fs.existsSync(outputDirpathSymlink)) {
      fs.mkdirSync(outputDirpathSymlink);
    }
  });

  afterEach(function() {
    rimraf.sync(integrationOutputBase);
  });

  it('does not exhaust available file descriptors when streaming thousands of files', function(done) {
    // Make a ton of files. Changed from hard links due to Windows failures
    jest.setTimeout(20000);
    var expectedCount = 6000;

    for (var idx = 0; idx < expectedCount; idx++) {
      var filepath = path.join(inputIn, 'test' + idx + '.txt');
      fs.writeFileSync(filepath, contents);
    }

    pipe([
      vfs.src(inputGlob, { buffer: false }),
      count(expectedCount),
      vfs.dest(outputOut)
    ], done);
  });

  skipWindows('(*nix) sources a directory, creates a symlink and copies it', function(done) {
    function assert(files) {
      var symlinkResult = fs.readlinkSync(outputSymlink);
      var destResult = fs.readdirSync(outputDest);

      expect(symlinkResult).toBe(integrationInputBase);
      expect(files[0].symlink).toBe(integrationInputBase);
      expect(Array.isArray(destResult)).toBe(true);
      expect(files[0].isDirectory()).toBe(true);
      expect(path.basename(outputDest)).toBe(path.basename(integrationInputBase));
    }

    pipe([
      vfs.src(integrationInputBase),
      vfs.symlink(integrationOutputBase),
      vfs.dest(outputDirpathSymlink),
      concat(assert)
    ], done);
  });

  onlyWindows('(windows) sources a directory, creates a symlink and copies it', function(done) {
    function assert(files) {
      var symlinkResult = fs.readlinkSync(outputSymlink);
      var destResult = fs.readdirSync(outputDest);

      expect(symlinkResult).toBe(integrationInputBase + '\\');
      expect(files[0].symlink).toBe(integrationInputBase);
      expect(Array.isArray(destResult)).toBe(true);
      expect(files[0].isSymbolic()).toBe(true);
      expect(path.basename(outputDest)).toBe(path.basename(integrationInputBase));
    }

    pipe([
      vfs.src(integrationInputBase),
      vfs.symlink(integrationOutputBase),
      vfs.dest(outputDirpathSymlink),
      concat(assert)
    ], done);
  });

  skipWindows('(*nix) sources a symlink and copies it', function(done) {
    fs.symlinkSync(integrationInputBase, outputSymlink);

    function assert(files) {
      var expected = integrationInputBase;
      var destResult = fs.readlinkSync(outputDest);

      expect(destResult).toBe(expected);
      expect(files[0].isSymbolic()).toBe(true);
      expect(files[0].symlink).toBe(expected);
    }

    pipe([
      vfs.src(outputSymlink, { resolveSymlinks: false }),
      vfs.dest(outputDirpathSymlink),
      concat(assert)
    ], done);
  });

  onlyWindows('(windows) sources a directory symlink and copies it', function(done) {
    fs.symlinkSync(integrationInputBase, outputSymlink, 'dir');

    function assert(files) {
      var expected = integrationInputBase;
      var destResult = fs.readlinkSync(outputDest);

      expect(destResult).toBe(expected + '\\');
      expect(files[0].isSymbolic()).toBe(true);
      expect(files[0].symlink).toBe(expected);
    }

    pipe([
      vfs.src(outputSymlink, { resolveSymlinks: false }),
      vfs.dest(outputDirpathSymlink),
      concat(assert)
    ], done);
  });
});
