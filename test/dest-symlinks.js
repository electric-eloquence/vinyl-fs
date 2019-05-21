'use strict';

var path = require('path');

var expect = require('expect');
var fs = require('graceful-fs');
var File = require('vinyl');
var miss = require('mississippi');
var mkdirp = require('fs-mkdirp-stream/mkdirp');
var rimraf = require('rimraf');

var vfs = require('../');

var isWindows = require('./utils/is-windows');
var always = require('./utils/always');
var testConstants = require('./utils/test-constants');

var concat = miss.concat;
var from = miss.from;
var pipe = miss.pipe;

var neInputBase = testConstants.neInputBase;
var neInputPath = testConstants.neInputPath;
var neOutputBase = testConstants.neOutputBase;
var neOutputPath = testConstants.neOutputPath;

var pathElement = 'dest-symlinks';
var destSymlinksInputBase = path.join(testConstants.inputBase, pathElement);
var destSymlinksInputPath = path.join(destSymlinksInputBase, pathElement + '.test');
var destSymlinksInputDirpath = path.join(destSymlinksInputBase, 'foo');
var destSymlinksOutputBase = path.join(testConstants.outputBase, pathElement);
var destSymlinksOutputPath = path.join(destSymlinksOutputBase, pathElement + '.test');
var destSymlinksOutputDirpath = path.join(destSymlinksOutputBase, 'foo');

var contents = fs.readFileSync(destSymlinksInputPath, 'utf8');
var onlyWindows = isWindows ? it : xit;
var skipWindows = isWindows ? xit : it;

describe('.dest() with symlinks', function() {
  beforeEach(function(done) {
    mkdirp(destSymlinksOutputBase, done);
  });

  afterEach(function() {
    rimraf.sync(destSymlinksOutputBase);
    rimraf.sync(neOutputBase);
  });

  it('creates symlinks when `file.isSymbolic()` is true', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputPath;

    function assert(files) {
      var symlink = fs.readlinkSync(destSymlinksOutputPath);

      expect(files.length).toBe(1);
      expect(file.symlink).toBe(symlink);
      expect(files[0].symlink).toBe(symlink);
      expect(files[0].isSymbolic()).toBe(true);
      expect(files[0].path).toBe(destSymlinksOutputPath);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase),
      concat(assert),
    ], done);
  });

  it('does not create symlinks when `file.isSymbolic()` is false', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(false),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputPath;

    function assert(files) {
      var symlinkExists = fs.existsSync(destSymlinksOutputPath);

      expect(files.length).toBe(1);
      expect(symlinkExists).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase),
      concat(assert),
    ], done);
  });

  it('errors if missing a `.symlink` property', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    function assert(err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Missing symlink property on symbolic vinyl');
      done();
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase),
    ], assert);
  });

  it('emits Vinyl files that are (still) symbolic', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputPath;

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].isSymbolic()).toBe(true);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase),
      concat(assert),
    ], done);
  });

  it('can create relative links', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputPath;

    function assert(files) {
      var outputLink = fs.readlinkSync(destSymlinksOutputPath);

      expect(files.length).toBe(1);
      expect(outputLink).toBe(path.normalize('../../fixtures/dest-symlinks/dest-symlinks.test'));
      expect(files[0].isSymbolic()).toBe(true);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase, { relativeSymlinks: true }),
      concat(assert),
    ], done);
  });

  skipWindows('(*nix) creates a link for a directory', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputDirpath;

    function assert(files) {
      var stats = fs.statSync(destSymlinksOutputDirpath);
      var lstats = fs.lstatSync(destSymlinksOutputDirpath);
      var outputLink = fs.readlinkSync(destSymlinksOutputDirpath);

      expect(files.length).toBe(1);
      expect(outputLink).toBe(destSymlinksInputDirpath);
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) creates a junction for a directory', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputDirpath;

    function assert(files) {
      var stats = fs.statSync(destSymlinksOutputDirpath);
      var lstats = fs.lstatSync(destSymlinksOutputDirpath);
      var outputLink = fs.readlinkSync(destSymlinksOutputDirpath);

      expect(files.length).toBe(1);
      // When creating a junction, it seems Windows appends a separator
      expect(outputLink).toBe(destSymlinksInputDirpath + path.sep);
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) options can disable junctions for a directory', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputDirpath;

    function assert(files) {
      var stats = fs.statSync(destSymlinksOutputDirpath);
      var lstats = fs.lstatSync(destSymlinksOutputDirpath);
      var outputLink = fs.readlinkSync(destSymlinksOutputDirpath);

      expect(files.length).toBe(1);
      expect(outputLink).toBe(destSymlinksInputDirpath);
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase, { useJunctions: false }),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) options can disable junctions for a directory (as a function)', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputDirpath;

    function useJunctions(f) {
      expect(f).toBe(file);
      return false;
    }

    function assert(files) {
      var stats = fs.statSync(destSymlinksOutputDirpath);
      var lstats = fs.lstatSync(destSymlinksOutputDirpath);
      var outputLink = fs.readlinkSync(destSymlinksOutputDirpath);

      expect(files.length).toBe(1);
      expect(outputLink).toBe(destSymlinksInputDirpath);
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase, { useJunctions: useJunctions }),
      concat(assert),
    ], done);
  });

  skipWindows('(*nix) can create relative links for directories', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputDirpath;

    function assert(files) {
      var stats = fs.statSync(destSymlinksOutputDirpath);
      var lstats = fs.lstatSync(destSymlinksOutputDirpath);
      var outputLink = fs.readlinkSync(destSymlinksOutputDirpath);

      expect(files.length).toBe(1);
      expect(outputLink).toBe(path.normalize('../../fixtures/dest-symlinks/foo'));
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase, { relativeSymlinks: true }),
      concat(assert),
    ], done);
  });

  skipWindows('(*nix) receives a virtual symbolic directory and creates a symlink', function(done) {
    var file = new File({
      base: neInputBase,
      path: neInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = neInputPath;

    function assert(files) {
      var lstats = fs.lstatSync(neOutputPath);
      var outputLink = fs.readlinkSync(neOutputPath);
      var linkTargetExists = fs.existsSync(outputLink);

      expect(files.length).toBe(1);
      expect(outputLink).toBe(neInputPath);
      expect(linkTargetExists).toBe(false);
      expect(lstats.isSymbolicLink()).toBe(true);
    }

    pipe([
      // This could also be from a different Vinyl adapter
      from.obj([file]),
      vfs.dest(neOutputBase),
      concat(assert),
    ], done);
  });

  // There's no way to determine the proper type of link to create with a dangling link
  // So we just create a 'file' type symlink
  // There's also no real way to test the type that was created
  onlyWindows('(windows) receives a virtual symbolic directory and creates a symlink', function(done) {
    var file = new File({
      base: neInputBase,
      path: neInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = neInputPath;

    function assert(files) {
      var lstats = fs.lstatSync(neOutputPath);
      var outputLink = fs.readlinkSync(neOutputPath);
      var linkTargetExists = fs.existsSync(outputLink);

      expect(files.length).toBe(1);
      expect(outputLink).toBe(neInputPath);
      expect(linkTargetExists).toBe(false);
      expect(lstats.isSymbolicLink()).toBe(true);
    }

    pipe([
      // This could also be from a different Vinyl adapter
      from.obj([file]),
      vfs.dest(neOutputBase),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) relativeSymlinks option is ignored when junctions are used', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputDirpath;

    function assert(files) {
      var stats = fs.statSync(destSymlinksOutputDirpath);
      var lstats = fs.lstatSync(destSymlinksOutputDirpath);
      var outputLink = fs.readlinkSync(destSymlinksOutputDirpath);

      expect(files.length).toBe(1);
      // When creating a junction, it seems Windows appends a separator
      expect(outputLink).toBe(destSymlinksInputDirpath + path.sep);
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase, { useJunctions: true, relativeSymlinks: true }),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) supports relativeSymlinks option when link is not for a directory', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputPath;

    function assert(files) {
      var outputLink = fs.readlinkSync(destSymlinksOutputPath);

      expect(files.length).toBe(1);
      expect(outputLink).toBe(path.normalize('../../fixtures/dest-symlinks/dest-symlinks.test'));
    }

    pipe([
      from.obj([file]),
      // The useJunctions option is ignored when file is not a directory
      vfs.dest(destSymlinksOutputBase, { useJunctions: true, relativeSymlinks: true }),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) can create relative links for directories when junctions are disabled', function(done) {
    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputDirpath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputDirpath;

    function assert(files) {
      var stats = fs.statSync(destSymlinksOutputDirpath);
      var lstats = fs.lstatSync(destSymlinksOutputDirpath);
      var outputLink = fs.readlinkSync(destSymlinksOutputDirpath);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(destSymlinksOutputBase);
      expect(files[0].path).toBe(destSymlinksOutputDirpath);
      expect(outputLink).toBe(path.normalize('../../fixtures/dest-symlinks/foo'));
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase, { useJunctions: false, relativeSymlinks: true }),
      concat(assert),
    ], done);
  });

  it('does not overwrite links with overwrite option set to false', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputPath;

    function assert(files) {
      var outputContents = fs.readFileSync(destSymlinksOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(existingContents);
    }

    // Write expected file which should not be overwritten
    fs.writeFileSync(destSymlinksOutputPath, existingContents);

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase, { overwrite: false }),
      concat(assert),
    ], done);
  });


  it('overwrites links with overwrite option set to true', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputPath;

    function assert(files) {
      var outputContents = fs.readFileSync(destSymlinksOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(contents);
    }

    // This should be overwritten
    fs.writeFileSync(destSymlinksOutputPath, existingContents);

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase, { overwrite: true }),
      concat(assert),
    ], done);
  });

  it('does not overwrite links with overwrite option set to a function that returns false', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputPath;

    function overwrite(f) {
      expect(f).toBe(file);
      return false;
    }

    function assert(files) {
      var outputContents = fs.readFileSync(destSymlinksOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(existingContents);
    }

    // Write expected file which should not be overwritten
    fs.writeFileSync(destSymlinksOutputPath, existingContents);

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase, { overwrite: overwrite }),
      concat(assert),
    ], done);
  });

  it('overwrites links with overwrite option set to a function that returns true', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: destSymlinksInputBase,
      path: destSymlinksInputPath,
      contents: null,
      stat: {
        isSymbolicLink: always(true),
      },
    });

    // `src()` adds this side-effect with `resolveSymlinks` option set to false
    file.symlink = destSymlinksInputPath;

    function overwrite(f) {
      expect(f).toBe(file);
      return true;
    }

    function assert(files) {
      var outputContents = fs.readFileSync(destSymlinksOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(contents);
    }

    // This should be overwritten
    fs.writeFileSync(destSymlinksOutputPath, existingContents);

    pipe([
      from.obj([file]),
      vfs.dest(destSymlinksOutputBase, { overwrite: overwrite }),
      concat(assert),
    ], done);
  });
});
