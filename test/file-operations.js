'use strict';

var buffer = require('buffer');
var path = require('path');

var expect = require('expect');
var fs = require('graceful-fs');
var File = require('vinyl');
var miss = require('mississippi');
var mkdirp = require('fs-mkdirp-stream/mkdirp');
var rimraf = require('rimraf');

var constants = require('../lib/constants');
var fo = require('../lib/file-operations');

var DEFAULT_FILE_MODE = constants.DEFAULT_FILE_MODE;

var applyUmask = require('./utils/apply-umask');
var isWindows = require('./utils/is-windows');
var statMode = require('./utils/stat-mode');
var testConstants = require('./utils/test-constants');
var testStreams = require('./utils/test-streams');

var from = miss.from;
var pipe = miss.pipe;

var closeFd = fo.closeFd;
var createWriteStream = fo.createWriteStream;
var getFlags = fo.getFlags;
var getModeDiff = fo.getModeDiff;
var getOwnerDiff = fo.getOwnerDiff;
var isFatalOverwriteError = fo.isFatalOverwriteError;
var isFatalUnlinkError = fo.isFatalUnlinkError;
var isOwner = fo.isOwner;
var isValidUnixId = fo.isValidUnixId;
var reflectLinkStat = fo.reflectLinkStat;
var reflectStat = fo.reflectStat;
var updateMetadata = fo.updateMetadata;
var writeFile = fo.writeFile;

var string = testStreams.string;

var outputBase = testConstants.outputBase;
var neInputPath = testConstants.neInputPath;

var pathElement = 'file-operations';
var fileOperationsInputPath = path.join(testConstants.inputBase, pathElement, pathElement + '.test');
var fileOperationsOutputBase = path.join(outputBase, pathElement);
var fileOperationsOutputPath = path.join(fileOperationsOutputBase, pathElement + '.test');
var fileOperationsSymlink = path.join(fileOperationsOutputBase, pathElement + '.link');

var contents = fs.readFileSync(fileOperationsInputPath, 'utf8');
var noop = function() {};
var skipWindows = isWindows ? xit : it;

function cleanBeforeEach(done) {
  mkdirp(fileOperationsOutputBase, done);
}

function cleanAfterEach() {
  jest.restoreAllMocks();
  rimraf.sync(fileOperationsOutputBase);
}

describe('isOwner', function() {
  var ownerStat = {
    uid: 9001,
  };

  var nonOwnerStat = {
    uid: 9002,
  };

  var getuidSpy;
  var geteuidSpy;

  beforeEach(function() {
    if (typeof process.geteuid !== 'function') {
      process.geteuid = noop;
    }

    // Windows :(
    if (typeof process.getuid !== 'function') {
      process.getuid = noop;
    }

    getuidSpy = jest.spyOn(process, 'getuid').mockReturnValue(ownerStat.uid);
    geteuidSpy = jest.spyOn(process, 'geteuid').mockReturnValue(ownerStat.uid);
  });

  afterEach(function() {
    if (process.geteuid === noop) {
      delete process.geteuid;
    }

    // Windows :(
    if (process.getuid === noop) {
      delete process.getuid;
    }

    jest.restoreAllMocks();
  });

  it('uses process.geteuid() when available', function(done) {
    isOwner(ownerStat);

    expect(getuidSpy).not.toHaveBeenCalled();
    expect(geteuidSpy).toHaveBeenCalled();

    done();
  });

  it('uses process.getuid() when geteuid() is not available', function(done) {
    var geteuid = process.geteuid;
    delete process.geteuid;

    isOwner(ownerStat);

    expect(getuidSpy).toHaveBeenCalled();

    process.geteuid = geteuid;
    done();
  });

  it('returns false when non-root and non-owner', function(done) {
    var result = isOwner(nonOwnerStat);

    expect(result).toBe(false);

    done();
  });

  it('returns true when owner and non-root', function(done) {
    var result = isOwner(ownerStat);

    expect(result).toBe(true);

    done();
  });

  it('returns true when non-owner but root', function(done) {
    jest.spyOn(process, 'geteuid').mockReturnValue(0); // 0 is root uid

    // Need to run process.geteuid in order to activate spy and get result.
    process.geteuid();

    var result = isOwner(nonOwnerStat);

    expect(result).toBe(true);

    done();
  });
});

describe('isValidUnixId', function() {
  it('returns true if the given id is a valid unix id', function(done) {
    var result = isValidUnixId(1000);

    expect(result).toBe(true);

    done();
  });

  it('returns false if the given id is not a number', function(done) {
    var result = isValidUnixId('root');

    expect(result).toBe(false);

    done();
  });

  it('returns false when the given id is less than 0', function(done) {
    var result = isValidUnixId(-1);

    expect(result).toBe(false);

    done();
  });
});

describe('getFlags', function() {
  it('returns wx if overwrite is false and append is false', function(done) {
    var result = getFlags({
      overwrite: false,
      append: false,
    });

    expect(result).toBe('wx');

    done();
  });

  it('returns w if overwrite is true and append is false', function(done) {
    var result = getFlags({
      overwrite: true,
      append: false,
    });

    expect(result).toBe('w');

    done();
  });

  it('returns ax if overwrite is false and append is true', function(done) {
    var result = getFlags({
      overwrite: false,
      append: true,
    });

    expect(result).toBe('ax');

    done();
  });

  it('returns a if overwrite is true and append is true', function(done) {
    var result = getFlags({
      overwrite: true,
      append: true,
    });

    expect(result).toBe('a');

    done();
  });
});

describe('isFatalOverwriteError', function() {
  it('returns false if not given any error', function(done) {
    var result = isFatalOverwriteError(null);

    expect(result).toBe(false);

    done();
  });

  it('returns true if code != EEXIST', function(done) {
    var result = isFatalOverwriteError({ code: 'EOTHER' });

    expect(result).toBe(true);

    done();
  });

  it('returns false if code == EEXIST and flags == wx', function(done) {
    var result = isFatalOverwriteError({ code: 'EEXIST' }, 'wx');

    expect(result).toBe(false);

    done();
  });

  it('returns false if code == EEXIST and flags == ax', function(done) {
    var result = isFatalOverwriteError({ code: 'EEXIST' }, 'ax');

    expect(result).toBe(false);

    done();
  });

  it('returns true if error.code == EEXIST and flags == w', function(done) {
    var result = isFatalOverwriteError({ code: 'EEXIST' }, 'w');

    expect(result).toBe(true);

    done();
  });

  it('returns true if error.code == EEXIST and flags == a', function(done) {
    var result = isFatalOverwriteError({ code: 'EEXIST' }, 'a');

    expect(result).toBe(true);

    done();
  });
});

describe('isFatalUnlinkError', function() {
  it('returns false if not given any error', function(done) {
    var result = isFatalUnlinkError(null);

    expect(result).toBe(false);

    done();
  });

  it('returns false if code == ENOENT', function(done) {
    var result = isFatalUnlinkError({ code: 'ENOENT' }, 'wx');

    expect(result).toBe(false);

    done();
  });

  it('returns true if code != ENOENT', function(done) {
    var result = isFatalUnlinkError({ code: 'EOTHER' });

    expect(result).toBe(true);

    done();
  });
});

describe('getModeDiff', function() {
  it('returns 0 if both modes are the same', function(done) {
    var fsMode = applyUmask('777');
    var vfsMode = applyUmask('777');

    var result = getModeDiff(fsMode, vfsMode);

    expect(result).toBe(0);

    done();
  });

  it('returns 0 if vinyl mode is not a number', function(done) {
    var fsMode = applyUmask('777');
    var vfsMode;

    var result = getModeDiff(fsMode, vfsMode);

    expect(result).toBe(0);

    done();
  });

  it('returns a value greater than 0 if modes are different', function(done) {
    var fsMode = applyUmask('777');
    var vfsMode = applyUmask('744');

    var result = getModeDiff(fsMode, vfsMode);

    expect(result).toBeGreaterThan(0);

    done();
  });

  it('returns the proper diff', function(done) {
    var fsMode = applyUmask('777');
    var vfsMode = applyUmask('744');
    var expectedDiff = applyUmask('33');

    var result = getModeDiff(fsMode, vfsMode);

    expect(result).toBe(expectedDiff);

    done();
  });

  it('does not matter the order of diffing', function(done) {
    var fsMode = applyUmask('655');
    var vfsMode = applyUmask('777');
    var expectedDiff = applyUmask('122');

    var result = getModeDiff(fsMode, vfsMode);

    expect(result).toBe(expectedDiff);

    done();
  });

  it('includes the sticky/setuid/setgid bits', function(done) {
    var fsMode = applyUmask('1777');
    var vfsMode = applyUmask('4777');
    var expectedDiff = applyUmask('5000');

    var result = getModeDiff(fsMode, vfsMode);

    expect(result).toBe(expectedDiff);

    done();
  });
});

describe('getOwnerDiff', function() {
  it('returns undefined if vinyl uid & gid are invalid', function(done) {
    var fsStat = {
      uid: 1000,
      gid: 1000,
    };
    var vfsStat = {};

    var result = getOwnerDiff(fsStat, vfsStat);

    expect(typeof result).toBe('undefined');

    done();
  });

  it('returns undefined if vinyl uid & gid are both equal to counterparts', function(done) {
    var fsStat = {
      uid: 1000,
      gid: 1000,
    };
    var vfsStat = {
      uid: 1000,
      gid: 1000,
    };

    var result = getOwnerDiff(fsStat, vfsStat);

    expect(typeof result).toBe('undefined');

    done();
  });

  it('returns a diff object if uid or gid do not match', function(done) {
    var fsStat = {
      uid: 1000,
      gid: 1000,
    };
    var vfsStat0 = {
      uid: 1001,
      gid: 1000,
    };
    var expected0 = {
      uid: 1001,
      gid: 1000,
    };

    var result0 = getOwnerDiff(fsStat, vfsStat0);

    expect(result0).toEqual(expected0);

    var vfsStat1 = {
      uid: 1000,
      gid: 1001,
    };
    var expected1 = {
      uid: 1000,
      gid: 1001,
    };

    var result1 = getOwnerDiff(fsStat, vfsStat1);

    expect(result1).toEqual(expected1);

    done();
  });

  it('returns the fs uid if the vinyl uid is invalid', function(done) {
    var fsStat = {
      uid: 1000,
      gid: 1000,
    };
    var vfsStat0 = {
      gid: 1001,
    };
    var expected = {
      uid: 1000,
      gid: 1001,
    };

    var result0 = getOwnerDiff(fsStat, vfsStat0);

    expect(result0).toEqual(expected);

    var vfsStat1 = {
      uid: -1,
      gid: 1001,
    };

    var result1 = getOwnerDiff(fsStat, vfsStat1);

    expect(result1).toEqual(expected);

    done();
  });

  it('returns the fs gid if the vinyl gid is invalid', function(done) {
    var fsStat = {
      uid: 1000,
      gid: 1000,
    };
    var vfsStat0 = {
      uid: 1001,
    };
    var expected = {
      uid: 1001,
      gid: 1000,
    };

    var result0 = getOwnerDiff(fsStat, vfsStat0);

    expect(result0).toEqual(expected);

    var vfsStat1 = {
      uid: 1001,
      gid: -1,
    };

    var result1 = getOwnerDiff(fsStat, vfsStat1);

    expect(result1).toEqual(expected);

    done();
  });

  it('returns undefined if fs and vinyl uid are invalid', function(done) {
    var fsStat0 = {
      gid: 1000,
    };
    var vfsStat0 = {
      gid: 1001,
    };

    var result0 = getOwnerDiff(fsStat0, vfsStat0);

    expect(typeof result0).toBe('undefined');

    var fsStat1 = {
      uid: -1,
      gid: 1000,
    };
    var vfsStat1 = {
      uid: -1,
      gid: 1001,
    };

    var result1 = getOwnerDiff(fsStat1, vfsStat1);

    expect(typeof result1).toBe('undefined');

    done();
  });

  it('returns undefined if fs and vinyl gid are invalid', function(done) {
    var fsStat0 = {
      uid: 1000,
    };
    var vfsStat0 = {
      uid: 1001,
    };

    var result0 = getOwnerDiff(fsStat0, vfsStat0);

    expect(typeof result0).toBe('undefined');

    var fsStat1 = {
      uid: 1000,
      gid: -1,
    };
    var vfsStat1 = {
      uid: 1001,
      gid: -1,
    };

    var result1 = getOwnerDiff(fsStat1, vfsStat1);

    expect(typeof result1).toBe('undefined');

    done();
  });
});

describe('closeFd', function() {
  afterEach(function() {
    jest.restoreAllMocks();
  });

  // This is just a very large number since node broke our tests by disallowing -1
  // We're also doing some hacky version matching because node 0.12 accepts 10000 on Windows (and fails the test)
  var invalidFd = process.version[1] === '0' ? -1 : 10000;

  it('calls the callback with propagated error if fd is not a number', function(done) {
    var propagatedError = new Error();

    closeFd(propagatedError, null, function(err) {
      // err instanceof Error === false
      expect(err.constructor.name).toBe('Error');
      expect(Object.keys(err.constructor)).toMatchObject(Object.keys(Error));

      done();
    });
  });

  it('calls the callback with close error if no error to propagate', function(done) {
    closeFd(null, invalidFd, function(err) {
      // err instanceof Error === false
      expect(err.constructor.name).toBe('Error');
      expect(Object.keys(err.constructor)).toMatchObject(Object.keys(Error));

      done();
    });
  });

  it('calls the callback with propagated error if close errors', function(done) {
    var propagatedError = new Error();

    closeFd(propagatedError, invalidFd, function(err) {
      expect(err).toEqual(propagatedError);

      done();
    });
  });

  it('calls the callback with propagated error if close succeeds', function(done) {
    var propagatedError = new Error();

    var fd = fs.openSync(fileOperationsInputPath, 'r');

    var closeSpy = jest.spyOn(fs, 'close');

    closeFd(propagatedError, fd, function(err) {
      expect(closeSpy).toHaveBeenCalled();
      expect(err).toEqual(propagatedError);

      done();
    });
  });

  it('calls the callback with no error if close succeeds & no propagated error', function(done) {
    var fd = fs.openSync(fileOperationsInputPath, 'r');

    var spy = jest.spyOn(fs, 'close');

    closeFd(null, fd, function(err) {
      expect(spy).toHaveBeenCalled();
      expect(typeof err).toBe('undefined');

      done();
    });
  });
});

describe('writeFile', function() {
  beforeEach(cleanBeforeEach);
  afterEach(cleanAfterEach);

  it('writes a file to the filesystem, does not close and returns the fd', function(done) {
    writeFile(fileOperationsOutputPath, Buffer.from(contents), function(err, fd) {
      expect(err).toBeNull();
      expect(typeof fd === 'number').toBe(true);

      fs.close(fd, function() {
        var written = fs.readFileSync(fileOperationsOutputPath, 'utf8');

        expect(written).toBe(contents);

        done();
      });
    });
  });

  it('defaults to writing files with 0666 mode', function(done) {
    var expected = applyUmask('666');

    writeFile(fileOperationsOutputPath, Buffer.from(contents), function(err, fd) {
      expect(err).toBeNull();
      expect(typeof fd === 'number').toBe(true);

      fs.close(fd, function() {
        expect(statMode(fileOperationsOutputPath)).toBe(expected);

        done();
      });
    });
  });

  // Changing the mode of a file is not supported by node.js in Windows.
  skipWindows('accepts a different mode in options', function(done) {
    var expected = applyUmask('777');
    var options = {
      mode: expected,
    };

    writeFile(fileOperationsOutputPath, Buffer.from(contents), options, function(err, fd) {
      expect(err).toBeNull();
      expect(typeof fd === 'number').toBe(true);

      fs.close(fd, function() {
        expect(statMode(fileOperationsOutputPath)).toBe(expected);

        done();
      });
    });
  });

  it('defaults to opening files with write (and not read) flag', function(done) {
    var length = contents.length;

    writeFile(fileOperationsOutputPath, Buffer.from(contents), function(err, fd) {
      expect(err).toBeNull();
      expect(typeof fd === 'number').toBe(true);

      fs.read(fd, Buffer.alloc(length), 0, length, 0, function(readErr) {
        // Should error because it should allow read.
        // err instanceof Error === false
        expect(readErr.constructor.name).toBe('Error');
        expect(Object.keys(readErr.constructor)).toMatchObject(Object.keys(Error));

        fs.close(fd, done);
      });
    });
  });

  it('accepts a different flags in options', function(done) {
    var length = contents.length;
    var options = {
      // Read and write flag.
      flags: 'w+',
    };

    writeFile(fileOperationsOutputPath, Buffer.from(contents), options, function(err, fd) {
      expect(err).toBeNull();
      expect(typeof fd === 'number').toBe(true);

      fs.read(fd, Buffer.alloc(length), 0, length, 0, function(readErr, _, written) {
        expect(readErr).toBeNull();

        expect(written.toString()).toBe(contents);

        fs.close(fd, done);
      });
    });
  });

  it('appends to a file if append flag is given', function(done) {
    var initial = 'test';
    var toWrite = '-a-thing';

    fs.writeFileSync(fileOperationsOutputPath, initial, 'utf8');

    var expected = initial + toWrite;

    var options = {
      flags: 'a',
    };

    writeFile(fileOperationsOutputPath, Buffer.from(toWrite), options, function(err, fd) {
      expect(err).toBeNull();
      expect(typeof fd === 'number').toBe(true);

      fs.close(fd, function() {
        var written = fs.readFileSync(fileOperationsOutputPath, 'utf8');

        expect(written).toBe(expected);

        done();
      });
    });
  });

  it('does not pass a file descriptor if open call errors', function(done) {
    var notExistDir = path.join(__dirname, 'not-exist-dir', 'writeFile.txt');

    writeFile(notExistDir, Buffer.from(contents), function(err, fd) {
      // err instanceof Error === false
      expect(err.constructor.name).toBe('Error');
      expect(Object.keys(err.constructor)).toMatchObject(Object.keys(Error));
      expect(typeof fd === 'number').toBe(false);

      done();
    });
  });

  it('passes a file descriptor if write call errors', function(done) {
    var options = {
      flags: 'r',
    };

    writeFile(fileOperationsInputPath, Buffer.from(contents), options, function(err, fd) {
      // err instanceof Error === false
      expect(err.constructor.name).toBe('Error');
      expect(Object.keys(err.constructor)).toMatchObject(Object.keys(Error));
      expect(typeof fd === 'number').toBe(true);

      fs.close(fd, done);
    });
  });

  it('passes an error if called with string as data', function(done) {
    writeFile(fileOperationsOutputPath, contents, function(err) {
      expect(err).toBeInstanceOf(TypeError);

      done();
    });
  });

  it('does not error on SlowBuffer', function(done) {
    if (!buffer.SlowBuffer) {
      this.skip();
      return;
    }

    var length = contents.length;
    var buf = Buffer.from(contents);
    var content = new buffer.SlowBuffer(length);
    buf.copy(content, 0, 0, length);

    writeFile(fileOperationsOutputPath, content, function(err, fd) {
      expect(err).toBeNull();
      expect(typeof fd === 'number').toBe(true);

      fs.close(fd, function() {
        var written = fs.readFileSync(fileOperationsOutputPath, 'utf8');

        expect(written).toBe(contents);

        done();
      });
    });
  });

  it('does not error if options is falsy', function(done) {
    writeFile(fileOperationsOutputPath, Buffer.from(contents), null, function(err, fd) {
      expect(err).toBeNull();
      expect(typeof fd === 'number').toBe(true);

      fs.close(fd, done);
    });
  });
});

describe('reflectStat', function() {
  beforeEach(cleanBeforeEach);
  afterEach(cleanAfterEach);

  it('passes the error if stat fails', function(done) {

    var file = new File();

    reflectStat(neInputPath, file, function(err) {
      // err instanceof Error === false
      expect(err.constructor.name).toBe('Error');
      expect(Object.keys(err.constructor)).toMatchObject(Object.keys(Error));

      done();
    });
  });

  it('updates the vinyl with filesystem stats', function(done) {
    var file = new File();

    fs.symlinkSync(fileOperationsInputPath, fileOperationsSymlink);

    reflectStat(fileOperationsSymlink, file, function() {
      // There appears to be a bug in the Windows implementation which causes
      // the sync versions of stat and lstat to return unsigned 32-bit ints
      // whilst the async versions returns signed 32-bit ints... This affects
      // dev but possibly others as well?
      fs.stat(fileOperationsSymlink, function(err, stat) {
        expect(file.stat).toEqual(stat);

        done();
      });
    });
  });
});

describe('reflectLinkStat', function() {
  beforeEach(cleanBeforeEach);
  afterEach(cleanAfterEach);

  it('passes the error if lstat fails', function(done) {

    var file = new File();

    reflectLinkStat(neInputPath, file, function(err) {
      // err instanceof Error === false
      expect(err.constructor.name).toBe('Error');
      expect(Object.keys(err.constructor)).toMatchObject(Object.keys(Error));

      done();
    });
  });

  it('updates the vinyl with filesystem symbolic stats', function(done) {
    var file = new File();

    fs.symlinkSync(fileOperationsInputPath, fileOperationsSymlink);

    reflectLinkStat(fileOperationsSymlink, file, function() {
      // There appears to be a bug in the Windows implementation which causes
      // the sync versions of stat and lstat to return unsigned 32-bit ints
      // whilst the async versions returns signed 32-bit ints... This affects
      // dev but possibly others as well?
      fs.lstat(fileOperationsSymlink, function(err, stat) {
        expect(file.stat).toEqual(stat);

        done();
      });
    });
  });
});

describe('updateMetadata', function() {
  beforeEach(cleanBeforeEach);

  afterEach(function() {
    if (process.geteuid === noop) {
      delete process.geteuid;
    }

    cleanAfterEach();
  });

  // Changing the time of a directory errors in Windows.
  // Changing the mode of a file is not supported by node.js in Windows.
  // Windows is treated as though it does not have permission to make these operations.
  skipWindows('passes the error if fstat fails', function(done) {
    var fd = 9001;

    var file = new File({
      base: outputBase,
      path: fileOperationsOutputPath,
      contents: null,
      stat: {},
    });

    updateMetadata(fd, file, function(err) {
      // err instanceof Error === false
      expect(err.constructor.name).toBe('Error');
      expect(Object.keys(err.constructor)).toMatchObject(Object.keys(Error));

      done();
    });
  });

  skipWindows('updates the vinyl object with fs stats', function(done) {
    var file = new File({
      base: outputBase,
      path: fileOperationsOutputPath,
      contents: null,
      stat: {},
    });

    var fd = fs.openSync(fileOperationsOutputPath, 'w+');
    var stats = fs.fstatSync(fd);

    updateMetadata(fd, file, function() {
      Object.keys(file.stat).forEach(function(key) {
        expect(file.stat[key]).toEqual(stats[key]);
      });

      fs.close(fd, done);
    });
  });

  skipWindows('does not touch the fs if process is not owner of the file', function(done) {
    if (typeof process.geteuid !== 'function') {
      process.geteuid = noop;
    }

    var file = new File({
      base: outputBase,
      path: fileOperationsOutputPath,
      contents: null,
      stat: {},
    });

    jest.spyOn(process, 'geteuid').mockReturnValue(9002);
    var fchmodSpy = jest.spyOn(fs, 'fchmod');

    var fd = fs.openSync(fileOperationsOutputPath, 'w+');

    updateMetadata(fd, file, function() {
      expect(fchmodSpy).not.toHaveBeenCalled();

      fs.close(fd, done);
    });
  });

  skipWindows('updates the mode on fs and vinyl object if there is a diff', function(done) {
    var fchmodSpy = jest.spyOn(fs, 'fchmod');

    var mode = applyUmask('777');

    var file = new File({
      base: outputBase,
      path: fileOperationsOutputPath,
      contents: null,
      stat: {
        mode: mode,
      },
    });

    var fd = fs.openSync(fileOperationsOutputPath, 'w+');

    updateMetadata(fd, file, function() {
      expect(fchmodSpy).toHaveBeenCalled();
      var stats = fs.fstatSync(fd);
      expect(file.stat.mode).toBe(stats.mode);

      fs.close(fd, done);
    });
  });

  skipWindows('updates the sticky bit on mode on fs and vinyl object if there is a diff', function(done) {
    var fchmodSpy = jest.spyOn(fs, 'fchmod');

    var mode = applyUmask('1777');

    var file = new File({
      base: outputBase,
      path: fileOperationsOutputPath,
      contents: null,
      stat: {
        mode: mode,
      },
    });

    var fd = fs.openSync(fileOperationsOutputPath, 'w+');

    updateMetadata(fd, file, function() {
      expect(fchmodSpy).toHaveBeenCalled();
      var stats = fs.fstatSync(fd);
      expect(file.stat.mode).toBe(stats.mode);

      fs.close(fd, done);
    });
  });

  skipWindows('forwards fchmod error and descriptor upon error', function(done) {
    var mode = applyUmask('777');

    var file = new File({
      base: outputBase,
      path: fileOperationsOutputPath,
      contents: null,
      stat: {
        mode: mode,
      },
    });

    var fd = fs.openSync(fileOperationsOutputPath, 'w+');

    var fchmodSpy = jest.spyOn(fs, 'fchmod');

    updateMetadata(fd, file, function() {
      expect(fchmodSpy).toHaveBeenCalled();

      fs.close(fd, done);
    });
  });

  skipWindows('updates the mode on fs and vinyl object if there is a diff', function(done) {
    var fchmodSpy = jest.spyOn(fs, 'fchmod')
      .mockImplementation(function(fd, mode, cb) {
        return cb();
      });

    var mode = applyUmask('777');

    var file = new File({
      base: outputBase,
      path: fileOperationsOutputPath,
      contents: null,
      stat: {
        mode: mode,
      },
    });

    var fd = fs.openSync(fileOperationsOutputPath, 'w+');

    updateMetadata(fd, file, function() {
      expect(fchmodSpy).toHaveBeenCalled();

      fs.close(fd, done);
    });
  });
});

describe('createWriteStream', function() {
  beforeEach(cleanBeforeEach);
  afterEach(cleanAfterEach);

  it('accepts just a file path and writes to it', function(done) {

    function assert(err) {
      var outputContents = fs.readFileSync(fileOperationsOutputPath, 'utf8');
      expect(outputContents).toBe(contents);
      done(err);
    }

    pipe([
      from([contents]),
      createWriteStream(fileOperationsOutputPath),
    ], assert);
  });

  it('accepts just a file path and writes a large file to it', function(done) {
    var size = 40000;

    function assert(err) {
      var stats = fs.lstatSync(fileOperationsOutputPath);

      expect(stats.size).toBe(size);
      done(err);
    }

    pipe([
      string(size),
      createWriteStream(fileOperationsOutputPath),
    ], assert);
  });

  it('accepts flags option', function(done) {
    // Write 13 stars then 12345 because the length of expected is 13
    fs.writeFileSync(fileOperationsOutputPath, '*************12345');

    function assert(err) {
      var outputContents = fs.readFileSync(fileOperationsOutputPath, 'utf8');
      expect(outputContents).toBe(contents + '**12345');
      done(err);
    }

    pipe([
      from([contents]),
      // Replaces from the beginning of the file
      createWriteStream(fileOperationsOutputPath, { flags: 'r+' }),
    ], assert);
  });

  it('accepts append flag as option & places cursor at the end', function(done) {
    fs.writeFileSync(fileOperationsOutputPath, '12345');

    function assert(err) {
      var outputContents = fs.readFileSync(fileOperationsOutputPath, 'utf8');
      expect(outputContents).toBe('12345' + contents);
      done(err);
    }

    pipe([
      from([contents]),
      // Appends to the end of the file
      createWriteStream(fileOperationsOutputPath, { flags: 'a' }),
    ], assert);
  });

  skipWindows('accepts mode option', function(done) {
    var mode = applyUmask('777');

    function assert(err) {
      expect(statMode(fileOperationsOutputPath)).toBe(mode);
      done(err);
    }

    pipe([
      from([contents]),
      createWriteStream(fileOperationsOutputPath, { mode: mode }),
    ], assert);
  });

  it('uses default file mode if no mode options', function(done) {
    var defaultMode = applyUmask(DEFAULT_FILE_MODE);

    function assert(err) {
      expect(statMode(fileOperationsOutputPath)).toBe(defaultMode);
      done(err);
    }

    pipe([
      from([contents]),
      createWriteStream(fileOperationsOutputPath),
    ], assert);
  });

  it('accepts a flush function that is called before close emitted', function(done) {
    var flushCalled = false;

    var outStream = createWriteStream(fileOperationsOutputPath, {}, function(fd, cb) {
      flushCalled = true;
      cb();
    });

    function assert(err) {
      expect(flushCalled).toBe(true);
      done(err);
    }

    pipe([
      from([contents]),
      outStream,
    ], assert);
  });

  it('can specify flush without options argument', function(done) {
    var flushCalled = false;

    var outStream = createWriteStream(fileOperationsOutputPath, function(fd, cb) {
      flushCalled = true;
      cb();
    });

    function assert(err) {
      expect(flushCalled).toBe(true);
      done(err);
    }

    pipe([
      from([contents]),
      outStream,
    ], assert);
  });

  it('passes the file descriptor to flush', function(done) {
    var flushCalled = false;

    var outStream = createWriteStream(fileOperationsOutputPath, function(fd, cb) {
      expect(typeof fd).toBe('number');
      flushCalled = true;
      cb();
    });

    function assert(err) {
      expect(flushCalled).toBe(true);
      done(err);
    }

    pipe([
      from([contents]),
      outStream,
    ], assert);
  });

  it('passes a callback to flush to call when work is done', function(done) {
    var flushCalled = false;
    var timeoutCalled = false;

    var outStream = createWriteStream(fileOperationsOutputPath, function(fd, cb) {
      flushCalled = true;
      setTimeout(function() {
        timeoutCalled = true;
        cb();
      }, 250);
    });

    function assert(err) {
      expect(flushCalled).toBe(true);
      expect(timeoutCalled).toBe(true);
      done(err);
    }

    pipe([
      from([contents]),
      outStream,
    ], assert);
  });

  it('emits an error if open fails', function(done) {
    var badOutputPath = path.join(outputBase, 'non-exist', 'test.coffee');

    function assert(err) {
      // err instanceof Error === false
      expect(err.constructor.name).toBe('Error');
      expect(Object.keys(err.constructor)).toMatchObject(Object.keys(Error));
      done();
    }

    pipe([
      from([contents]),
      createWriteStream(badOutputPath),
    ], assert);
  });

  it('emits an error if write fails', function(done) {
    // Create the file so it can be opened with `r`
    fs.writeFileSync(fileOperationsOutputPath, contents);

    function assert(err) {
      // err instanceof Error === false
      expect(err.constructor.name).toBe('Error');
      expect(Object.keys(err.constructor)).toMatchObject(Object.keys(Error));
      done();
    }

    pipe([
      from([contents]),
      createWriteStream(fileOperationsOutputPath, { flags: 'r' }),
    ], assert);
  });
});
