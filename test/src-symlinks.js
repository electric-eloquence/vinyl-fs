'use strict';

var path = require('path');

var expect = require('expect');
var fs = require('graceful-fs');
var miss = require('mississippi');
var rimraf = require('rimraf');

var vfs = require('../');

var testConstants = require('./utils/test-constants');

var concat = miss.concat;
var pipe = miss.pipe;

var pathElement = 'src-symlinks';
var srcSymlinksInputBase = path.join(testConstants.inputBase, pathElement);
var srcSymlinksInputPath = path.join(srcSymlinksInputBase, pathElement + '.test');
var srcSymlinksOutputBase = path.join(testConstants.outputBase, pathElement);
var srcSymlinksOutputPath = path.join(srcSymlinksOutputBase, pathElement);
var srcSymlinksDirpath = path.join(srcSymlinksOutputBase, 'test-symlink-dir');
var srcSymlinksMultiDirpath = path.join(srcSymlinksOutputBase, 'test-multi-layer-symlink-dir');
var srcSymlinksMultiDirpathSecond = path.join(srcSymlinksOutputBase, 'test-multi-layer-symlink-dir2');
var srcSymlinksNested = path.join(srcSymlinksOutputBase, 'test-multi-layer-symlink');
var srcSymlinksNestedTarget = path.join(srcSymlinksInputBase, 'foo', 'bar.txt');

describe('.src() with symlinks', function() {
  beforeEach(function() {
    if (!fs.existsSync(testConstants.outputBase)) {
      fs.mkdirSync(testConstants.outputBase);
    }
    if (!fs.existsSync(srcSymlinksOutputBase)) {
      fs.mkdirSync(srcSymlinksOutputBase);
    }
    fs.symlinkSync(srcSymlinksInputBase, srcSymlinksDirpath);
    fs.symlinkSync(srcSymlinksInputPath, srcSymlinksOutputPath);
    fs.symlinkSync(srcSymlinksDirpath, srcSymlinksMultiDirpath);
    fs.symlinkSync(srcSymlinksMultiDirpath, srcSymlinksMultiDirpathSecond);
    fs.symlinkSync(srcSymlinksNestedTarget, srcSymlinksNested);
  });

  afterEach(function(done) {
    rimraf(srcSymlinksOutputBase, done);
  });

  it('resolves symlinks correctly', function(done) {
    function assert(files) {
      expect(files.length).toBe(1);
      // The path should be the symlink itself
      expect(files[0].path).toBe(srcSymlinksNested);
      // But the content should be what's in the actual file
      expect(files[0].contents.toString()).toBe('symlink works\n');
      // And the stats should have been updated
      expect(files[0].stat.isSymbolicLink()).toBe(false);
      expect(files[0].stat.isFile()).toBe(true);
    }

    pipe([
      vfs.src(srcSymlinksNested),
      concat(assert),
    ], done);
  });

  it('resolves directory symlinks correctly', function(done) {
    function assert(files) {
      expect(files.length).toBe(1);
      // The path should be the symlink itself
      expect(files[0].path).toBe(srcSymlinksDirpath);
      // But the contents should be null
      expect(files[0].contents).toBe(null);
      // And the stats should have been updated
      expect(files[0].stat.isSymbolicLink()).toBe(false);
      expect(files[0].stat.isDirectory()).toBe(true);
    }

    pipe([
      vfs.src(srcSymlinksDirpath),
      concat(assert),
    ], done);
  });

  it('resolves nested symlinks to directories correctly', function(done) {
    function assert(files) {
      expect(files.length).toBe(1);
      // The path should be the symlink itself
      expect(files[0].path).toBe(srcSymlinksMultiDirpathSecond);
      // But the contents should be null
      expect(files[0].contents).toBe(null);
      // And the stats should have been updated
      expect(files[0].stat.isSymbolicLink()).toBe(false);
      expect(files[0].stat.isDirectory()).toBe(true);
    }

    pipe([
      vfs.src(srcSymlinksMultiDirpathSecond),
      concat(assert),
    ], done);
  });

  it('preserves file symlinks with resolveSymlinks option set to false', function(done) {
    var expectedRelativeSymlinkPath = fs.readlinkSync(srcSymlinksOutputPath);

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].path).toBe(srcSymlinksOutputPath);
      expect(files[0].symlink).toBe(expectedRelativeSymlinkPath);
    }

    pipe([
      vfs.src(srcSymlinksOutputPath, { resolveSymlinks: false }),
      concat(assert),
    ], done);
  });

  it('preserves directory symlinks with resolveSymlinks option set to false', function(done) {
    var expectedRelativeSymlinkPath = fs.readlinkSync(srcSymlinksDirpath);

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].path).toBe(srcSymlinksDirpath);
      expect(files[0].symlink).toBe(expectedRelativeSymlinkPath);
    }

    pipe([
      vfs.src(srcSymlinksDirpath, { resolveSymlinks: false }),
      concat(assert),
    ], done);
  });

  it('receives a file with symbolic link stats when resolveSymlinks is a function', function(done) {
    function resolveSymlinks(file) {
      expect(file.stat.isSymbolicLink()).toBe(true);

      return true;
    }

    function assert(files) {
      expect(files.length).toBe(1);
      // And the stats should have been updated
      expect(files[0].stat.isSymbolicLink()).toBe(false);
      expect(files[0].stat.isFile()).toBe(true);
    }

    pipe([
      vfs.src(srcSymlinksNested, { resolveSymlinks: resolveSymlinks }),
      concat(assert),
    ], done);
  });

  it('only calls resolveSymlinks once-per-file if it is a function', function(done) {
    var mockFn = jest.fn();
    var read = mockFn.mockReturnValue(false);

    function assert() {
      expect(mockFn.mock.calls.length).toBe(1);
    }

    pipe([
      vfs.src(srcSymlinksNested, { resolveSymlinks: read }),
      concat(assert),
    ], done);
  });
});
