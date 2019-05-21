'use strict';

var path = require('path');

var expect = require('expect');
var File = require('vinyl');
var fs = require('graceful-fs');
var miss = require('mississippi');
var mkdirp = require('fs-mkdirp-stream/mkdirp');
var rimraf = require('rimraf');

var vfs = require('../');

var always = require('./utils/always');
var breakPrototype = require('./utils/break-prototype');
var isWindows = require('./utils/is-windows');
var testConstants = require('./utils/test-constants');
var testStreams = require('./utils/test-streams');

var concat = miss.concat;
var from = miss.from;
var pipe = miss.pipe;

var inputBase = testConstants.inputBase;

var count = testStreams.count;
var slowCount = testStreams.slowCount;

var pathElement = 'symlink';
var symlinkInputBase = path.join(inputBase, pathElement);
var symlinkInputPath = path.join(symlinkInputBase, pathElement + '.test');
var symlinkOutputBase = path.join(testConstants.outputBase, pathElement);
var symlinkOutputLinkedDir = path.join(symlinkOutputBase, pathElement);
var symlinkOutputLinkedFile = path.join(symlinkOutputBase, pathElement + '.test');

var contents = fs.readFileSync(symlinkInputPath, 'utf8');
var noop = function() {};
var onlyWindows = isWindows ? it : xit;
var skipWindows = isWindows ? xit : it;
var outputRelative = path.join(testConstants.outputRelative, pathElement);

describe('symlink stream', function() {
  beforeEach(function(done) {
    mkdirp(symlinkOutputBase, done);
  });

  afterEach(function() {
    rimraf.sync(symlinkOutputBase);
  });

  it('throws on no folder argument', function(done) {
    function noFolder() {
      vfs.symlink();
    }

    expect(noFolder).toThrow('Invalid symlink() folder argument. Please specify a non-empty string or a function.');
    done();
  });

  it('throws on empty string folder argument', function(done) {
    function emptyFolder() {
      vfs.symlink('');
    }

    expect(emptyFolder).toThrow('Invalid symlink() folder argument. Please specify a non-empty string or a function.');
    done();
  });

  it('passes through writes with cwd', function(done) {
    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].cwd).toBe(__dirname);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(outputRelative, { cwd: __dirname }),
      concat(assert),
    ], done);
  });

  it('passes through writes with default cwd', function(done) {
    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].cwd).toBe(process.cwd());
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase),
      concat(assert),
    ], done);
  });

  it('creates a link to the right folder with relative cwd', function(done) {
    var cwd = path.relative(process.cwd(), __dirname);

    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    function assert(files) {
      var outputLink = fs.readlinkSync(symlinkOutputLinkedFile);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedFile);
      expect(files[0].symlink).toBe(outputLink);
      expect(files[0].isSymbolic()).toBe(true);
      expect(outputLink).toBe(symlinkInputPath);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(outputRelative, { cwd: cwd }),
      concat(assert),
    ], done);
  });

  it('creates a link to the right folder with function and relative cwd', function(done) {
    var cwd = path.relative(process.cwd(), __dirname);

    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    function outputFn(f) {
      expect(f).toBe(file);
      return outputRelative;
    }

    function assert(files) {
      var outputLink = fs.readlinkSync(symlinkOutputLinkedFile);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedFile);
      expect(files[0].symlink).toBe(outputLink);
      expect(files[0].isSymbolic()).toBe(true);
      expect(outputLink).toBe(symlinkInputPath);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(outputFn, { cwd: cwd }),
      concat(assert),
    ], done);
  });

  it('creates a link for a file with buffered contents', function(done) {
    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: Buffer.from(contents),
    });

    function assert(files) {
      var outputLink = fs.readlinkSync(symlinkOutputLinkedFile);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedFile);
      expect(files[0].symlink).toBe(outputLink);
      expect(files[0].isSymbolic()).toBe(true);
      expect(outputLink).toBe(symlinkInputPath);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase),
      concat(assert),
    ], done);
  });

  it('can create relative links', function(done) {
    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    function assert(files) {
      var outputLink = fs.readlinkSync(symlinkOutputLinkedFile);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedFile);
      expect(files[0].symlink).toBe(outputLink);
      expect(files[0].isSymbolic()).toBe(true);
      expect(outputLink).toBe(path.normalize('../../fixtures/symlink/symlink.test'));
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase, { relativeSymlinks: true }),
      concat(assert),
    ], done);
  });

  it('creates a link for a file with streaming contents', function(done) {
    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: from([contents]),
    });

    function assert(files) {
      var outputLink = fs.readlinkSync(symlinkOutputLinkedFile);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedFile);
      expect(files[0].symlink).toBe(outputLink);
      expect(files[0].isSymbolic()).toBe(true);
      expect(outputLink).toBe(symlinkInputPath);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase),
      concat(assert),
    ], done);
  });

  it('emits Vinyl objects that are symbolic', function(done) {
    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].isSymbolic()).toBe(true);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase),
      concat(assert),
    ], done);
  });

  skipWindows('(*nix) creates a link for a directory', function(done) {
    var file = new File({
      base: inputBase,
      path: symlinkInputBase,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    });

    function assert(files) {
      var stats = fs.statSync(symlinkOutputLinkedDir);
      var lstats = fs.lstatSync(symlinkOutputLinkedDir);
      var outputLink = fs.readlinkSync(symlinkOutputLinkedDir);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedDir);
      expect(files[0].symlink).toBe(outputLink);
      expect(outputLink).toBe(symlinkInputBase);
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) creates a junction for a directory', function(done) {
    var file = new File({
      base: inputBase,
      path: symlinkInputBase,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    });

    function assert(files) {
      var stats = fs.statSync(symlinkOutputLinkedDir);
      var lstats = fs.lstatSync(symlinkOutputLinkedDir);
      var outputLink = fs.readlinkSync(symlinkOutputLinkedDir);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedDir);
      // When creating a junction, it seems Windows appends a separator
      expect(files[0].symlink + path.sep).toBe(outputLink);
      expect(outputLink).toBe(symlinkInputBase + path.sep);
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) options can disable junctions for a directory', function(done) {
    var file = new File({
      base: inputBase,
      path: symlinkInputBase,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    });

    function assert(files) {
      var stats = fs.statSync(symlinkOutputLinkedDir);
      var lstats = fs.lstatSync(symlinkOutputLinkedDir);
      var outputLink = fs.readlinkSync(symlinkOutputLinkedDir);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedDir);
      expect(files[0].symlink).toBe(outputLink);
      expect(outputLink).toBe(symlinkInputBase);
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase, { useJunctions: false }),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) options can disable junctions for a directory (as a function)', function(done) {
    var file = new File({
      base: inputBase,
      path: symlinkInputBase,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    });

    function useJunctions(f) {
      expect(f).toBe(file);
      return false;
    }

    function assert(files) {
      var stats = fs.statSync(symlinkOutputLinkedDir);
      var lstats = fs.lstatSync(symlinkOutputLinkedDir);
      var outputLink = fs.readlinkSync(symlinkOutputLinkedDir);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedDir);
      expect(files[0].symlink).toBe(outputLink);
      expect(outputLink).toBe(symlinkInputBase);
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase, { useJunctions: useJunctions }),
      concat(assert),
    ], done);
  });

  skipWindows('(*nix) can create relative links for directories', function(done) {
    var file = new File({
      base: inputBase,
      path: symlinkInputBase,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    });

    function assert(files) {
      var stats = fs.statSync(symlinkOutputLinkedDir);
      var lstats = fs.lstatSync(symlinkOutputLinkedDir);
      var outputLink = fs.readlinkSync(symlinkOutputLinkedDir);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedDir);
      expect(files[0].symlink).toBe(outputLink);
      expect(outputLink).toBe(path.normalize('../../fixtures/symlink'));
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase, { relativeSymlinks: true }),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) relativeSymlinks option is ignored when junctions are used', function(done) {
    var file = new File({
      base: inputBase,
      path: symlinkInputBase,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    });

    function assert(files) {
      var stats = fs.statSync(symlinkOutputLinkedDir);
      var lstats = fs.lstatSync(symlinkOutputLinkedDir);
      var outputLink = fs.readlinkSync(symlinkOutputLinkedDir);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedDir);
      // When creating a junction, it seems Windows appends a separator
      expect(files[0].symlink + path.sep).toBe(outputLink);
      expect(outputLink).toBe(symlinkInputBase + path.sep);
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase, { useJunctions: true, relativeSymlinks: true }),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) supports relativeSymlinks option when link is not for a directory', function(done) {
    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    function assert(files) {
      var outputLink = fs.readlinkSync(symlinkOutputLinkedFile);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedFile);
      expect(outputLink).toBe(path.normalize('../../fixtures/symlink/symlink.test'));
    }

    pipe([
      from.obj([file]),
      // The useJunctions option is ignored when file is not a directory
      vfs.symlink(symlinkOutputBase, { useJunctions: true, relativeSymlinks: true }),
      concat(assert),
    ], done);
  });

  onlyWindows('(windows) can create relative links for directories when junctions are disabled', function(done) {
    var file = new File({
      base: inputBase,
      path: symlinkInputBase,
      contents: null,
      stat: {
        isDirectory: always(true),
      },
    });

    function assert(files) {
      var stats = fs.statSync(symlinkOutputLinkedDir);
      var lstats = fs.lstatSync(symlinkOutputLinkedDir);
      var outputLink = fs.readlinkSync(symlinkOutputLinkedDir);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(symlinkOutputBase);
      expect(files[0].path).toBe(symlinkOutputLinkedDir);
      expect(files[0].symlink).toBe(outputLink);
      expect(outputLink).toBe(path.normalize('../../fixtures/symlink'));
      expect(stats.isDirectory()).toBe(true);
      expect(lstats.isDirectory()).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase, { useJunctions: false, relativeSymlinks: true }),
      concat(assert),
    ], done);
  });

  // Changing the mode of a file is not supported by node.js in Windows.
  // This test is skipped on Windows because we have to chmod the file to 0.
  skipWindows('reports IO errors', function(done) {
    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    fs.chmodSync(symlinkOutputBase, 0);

    function assert(err) {
      expect(err.code).toBe('EACCES');
      fs.chmod(symlinkOutputBase, 0o755, done);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase),
    ], assert);
  });

  it('does not overwrite links with overwrite option set to false', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    function assert(files) {
      var outputContents = fs.readFileSync(symlinkOutputLinkedFile, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(existingContents);
    }

    // Write expected file which should not be overwritten
    fs.writeFileSync(symlinkOutputLinkedFile, existingContents);

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase, { overwrite: false }),
      concat(assert),
    ], done);
  });

  it('overwrites links with overwrite option set to true', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    function assert(files) {
      var outputContents = fs.readFileSync(symlinkOutputLinkedFile, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(contents);
    }

    // This should be overwritten
    fs.writeFileSync(symlinkOutputLinkedFile, existingContents);

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase, { overwrite: true }),
      concat(assert),
    ], done);
  });

  it('does not overwrite links with overwrite option set to a function that returns false', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    function overwrite(f) {
      expect(f).toBe(file);
      return false;
    }

    function assert(files) {
      var outputContents = fs.readFileSync(symlinkOutputLinkedFile, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(existingContents);
    }

    // Write expected file which should not be overwritten
    fs.writeFileSync(symlinkOutputLinkedFile, existingContents);

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase, { overwrite: overwrite }),
      concat(assert),
    ], done);
  });

  it('overwrites links with overwrite option set to a function that returns true', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    function overwrite(f) {
      expect(f).toBe(file);
      return true;
    }

    function assert(files) {
      var outputContents = fs.readFileSync(symlinkOutputLinkedFile, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(contents);
    }

    // This should be overwritten
    fs.writeFileSync(symlinkOutputLinkedFile, existingContents);

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase, { overwrite: overwrite }),
      concat(assert),
    ], done);
  });

  it('emits an end event', function(done) {
    var symlinkStream = vfs.symlink(symlinkOutputBase);

    symlinkStream.on('end', done);

    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    pipe([
      from.obj([file]),
      symlinkStream,
    ]);
  });

  it('emits a finish event', function(done) {
    var symlinkStream = vfs.symlink(symlinkOutputBase);

    symlinkStream.on('finish', done);

    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    pipe([
      from.obj([file]),
      symlinkStream,
    ]);
  });

  it('errors when a non-Vinyl object is emitted', function(done) {
    var file = {};

    function assert(err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Received a non-Vinyl object in `symlink()`');
      done();
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase),
    ], assert);
  });

  it('errors when a buffer-mode stream is piped to it', function(done) {
    var file = Buffer.from('test');

    function assert(err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Received a non-Vinyl object in `symlink()`');
      done();
    }

    pipe([
      from([file]),
      vfs.symlink(symlinkOutputBase),
    ], assert);
  });

  it('does not get clogged by highWaterMark', function(done) {
    var expectedCount = 17;
    var highwatermarkFiles = [];
    for (var idx = 0; idx < expectedCount; idx++) {
      var file = new File({
        base: symlinkInputBase,
        path: symlinkInputPath,
        contents: null,
      });
      highwatermarkFiles.push(file);
    }

    pipe([
      from.obj(highwatermarkFiles),
      count(expectedCount),
      // Must be in the Writable position to test this
      // So concat-stream cannot be used
      vfs.symlink(symlinkOutputBase),
    ], done);
  });

  it('allows backpressure when piped to another, slower stream', function(done) {
    jest.setTimeout(20000);

    var expectedCount = 24;
    var highwatermarkFiles = [];
    for (var idx = 0; idx < expectedCount; idx++) {
      var file = new File({
        base: symlinkInputBase,
        path: symlinkInputPath,
        contents: null,
      });
      highwatermarkFiles.push(file);
    }

    pipe([
      from.obj(highwatermarkFiles),
      count(expectedCount),
      vfs.symlink(symlinkOutputBase),
      slowCount(expectedCount),
    ], done);
  });

  it('respects readable listeners on symlink stream', function(done) {
    var file = new File({
      base: inputBase,
      path: symlinkInputBase,
      contents: null,
    });

    var symlinkStream = vfs.symlink(symlinkOutputBase);

    var readables = 0;
    symlinkStream.on('readable', function() {
      var data = symlinkStream.read();

      // eslint-disable-next-line eqeqeq
      if (data != null) {
        readables++;
      }
    });

    function assert(err) {
      expect(readables).toBe(1);
      done(err);
    }

    pipe([
      from.obj([file]),
      symlinkStream,
    ], assert);
  });

  it('respects data listeners on symlink stream', function(done) {
    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    var symlinkStream = vfs.symlink(symlinkOutputBase);

    var datas = 0;
    symlinkStream.on('data', function() {
      datas++;
    });

    function assert(err) {
      expect(datas).toBe(1);
      done(err);
    }

    pipe([
      from.obj([file]),
      symlinkStream,
    ], assert);
  });

  it('sinks the stream if all the readable event handlers are removed', function(done) {
    var expectedCount = 17;
    var highwatermarkFiles = [];
    for (var idx = 0; idx < expectedCount; idx++) {
      var file = new File({
        base: symlinkInputBase,
        path: symlinkInputPath,
        contents: null,
      });
      highwatermarkFiles.push(file);
    }

    var symlinkStream = vfs.symlink(symlinkOutputBase);

    symlinkStream.on('readable', noop);

    pipe([
      from.obj(highwatermarkFiles),
      count(expectedCount),
      // Must be in the Writable position to test this
      // So concat-stream cannot be used
      symlinkStream,
    ], done);

    process.nextTick(function() {
      symlinkStream.removeListener('readable', noop);
    });
  });

  it('sinks the stream if all the data event handlers are removed', function(done) {
    var expectedCount = 17;
    var highwatermarkFiles = [];
    for (var idx = 0; idx < expectedCount; idx++) {
      var file = new File({
        base: symlinkInputBase,
        path: symlinkInputPath,
        contents: null,
      });
      highwatermarkFiles.push(file);
    }

    var symlinkStream = vfs.symlink(symlinkOutputBase);

    symlinkStream.on('data', noop);

    pipe([
      from.obj(highwatermarkFiles),
      count(expectedCount),
      // Must be in the Writable position to test this
      // So concat-stream cannot be used
      symlinkStream,
    ], done);

    process.nextTick(function() {
      symlinkStream.removeListener('data', noop);
    });
  });

  it('does not pass options on to through2', function(done) {
    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      contents: null,
    });

    var mockFn = jest.fn();
    var read = mockFn.mockReturnValue(false);

    function assert() {
      // Called never because it's not a valid option
      expect(mockFn.mock.calls.length).toBe(0);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase, { read: read }),
      concat(assert),
    ], done);
  });

  it('marshalls a Vinyl object where .isSymbolic() returns true', function(done) {
    var file = new File({
      base: symlinkInputBase,
      path: symlinkInputPath,
      // Pre-set this because it is set by vfs.symlink
      symlink: symlinkInputPath,
    });

    breakPrototype(file);

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].isSymbolic()).toBe(true);
    }

    pipe([
      from.obj([file]),
      vfs.symlink(symlinkOutputBase),
      concat(assert),
    ], done);
  });
});
