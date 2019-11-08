'use strict';

var path = require('path');

var expect = require('expect');
var File = require('vinyl');
var fs = require('fs');
var miss = require('mississippi');

var vfs = require('../');

var testConstants = require('./utils/test-constants');

var concat = miss.concat;
var from = miss.from;
var pipe = miss.pipe;
var through = miss.through;

var inputBase = testConstants.inputBase;

var pathElement = 'src';
var srcInputBase = path.join(inputBase, pathElement);
var srcInputPath = path.join(srcInputBase, pathElement + '.test');
var bomInputPath = path.join(srcInputBase, 'bom-utf8.txt');
var beEncodedInputPath = path.join(srcInputBase, 'bom-utf16be.txt');
var leEncodedInputPath = path.join(srcInputBase, 'bom-utf16le.txt');

var contents = fs.readFileSync(srcInputPath, 'utf8');

describe('.src()', function() {
  it('throws on invalid glob (empty)', function(done) {
    var stream;

    try {
      stream = vfs.src();
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(stream).toBeUndefined();
      done();
    }
  });

  it('throws on invalid glob (empty string)', function(done) {
    var stream;

    try {
      stream = vfs.src('');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(stream).toBeUndefined();
      done();
    }
  });

  it('throws on invalid glob (number)', function(done) {
    var stream;

    try {
      stream = vfs.src(123);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(stream).toBeUndefined();
      done();
    }
  });

  it('throws on invalid glob (nested array)', function(done) {
    var stream;

    try {
      stream = vfs.src([['./fixtures/*.coffee']]);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(stream).toBeUndefined();
      expect(err.message).toContain('Invalid glob argument');
      done();
    }
  });

  it('throws on invalid glob (empty string in array)', function(done) {
    var stream;

    try {
      stream = vfs.src(['']);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(stream).toBeUndefined();
      done();
    }
  });

  it('throws on invalid glob (empty array)', function(done) {
    var stream;

    try {
      stream = vfs.src([]);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(stream).toBeUndefined();
      done();
    }
  });

  it('emits an error on file not existing', function(done) {
    function assert(err) {
      expect(err).toBeInstanceOf(Error);
      done();
    }

    pipe([
      vfs.src('./fixtures/noexist.coffee'),
      concat()
    ], assert);
  });

  it('passes through writes', function(done) {
    var file = new File({
      base: inputBase,
      path: srcInputPath,
      contents: Buffer.from(contents),
      stat: fs.statSync(srcInputPath)
    });

    var srcStream = vfs.src(srcInputPath);

    function assert(files) {
      expect(files.length).toBe(2);
      expect(files[0]).toBe(file);
    }

    srcStream.write(file);

    pipe([
      srcStream,
      concat(assert)
    ], done);
  });

  it('removes BOM from utf8-encoded files by default', function(done) {
    // U+FEFF takes up 3 bytes in UTF-8: http://mothereff.in/utf-8#%EF%BB%BF
    var expectedContent = fs.readFileSync(bomInputPath).slice(3);

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].contents).toMatchObject(expectedContent);
    }

    pipe([
      vfs.src(bomInputPath),
      concat(assert)
    ], done);
  });

  it('does not remove BOM from utf8-encoded files if option is false', function(done) {
    var expectedContent = fs.readFileSync(bomInputPath);

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].contents).toMatchObject(expectedContent);
    }

    pipe([
      vfs.src(bomInputPath, { removeBOM: false }),
      concat(assert)
    ], done);
  });

  it('does not remove BOM from streamed utf8-encoded files if removeBOM option is false', function(done) {
    var expectedContent = fs.readFileSync(bomInputPath);

    function assertContent(contents) {
      expect(contents).toMatchObject(expectedContent);
    }

    function compareContents(file, enc, cb) {
      pipe([
        file.contents,
        concat(assertContent)
      ], function(err) {
        cb(err, file);
      });
    }

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].isStream()).toBe(true);
    }

    pipe([
      vfs.src(bomInputPath, { buffer: false, removeBOM: false }),
      through.obj(compareContents),
      concat(assert)
    ], done);
  });

  // This goes for any non-UTF-8 encoding.
  // UTF-16-BE is enough to demonstrate this is done properly.
  it('does not remove anything that looks like a utf8-encoded BOM from utf16be-encoded files', function(done) {
    var expectedContent = fs.readFileSync(beEncodedInputPath);

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].contents).toMatchObject(expectedContent);
    }

    pipe([
      vfs.src(beEncodedInputPath),
      concat(assert)
    ], done);
  });

  it('does not remove anything that looks like a utf8-encoded BOM from streamed utf16be-encoded files', function(done) {
    var expectedContent = fs.readFileSync(beEncodedInputPath);

    function assertContent(contents) {
      expect(contents).toMatchObject(expectedContent);
    }

    function compareContents(file, enc, cb) {
      pipe([
        file.contents,
        concat(assertContent)
      ], function(err) {
        cb(err, file);
      });
    }

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].isStream()).toBe(true);
    }

    pipe([
      vfs.src(beEncodedInputPath, { buffer: false }),
      through.obj(compareContents),
      concat(assert)
    ], done);
  });

  // This goes for any non-UTF-8 encoding.
  // UTF-16-LE is enough to demonstrate this is done properly.
  it('does not remove anything that looks like a utf8-encoded BOM from utf16le-encoded files', function(done) {
    var expectedContent = fs.readFileSync(leEncodedInputPath);

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].contents).toMatchObject(expectedContent);
    }

    pipe([
      vfs.src(leEncodedInputPath),
      concat(assert)
    ], done);
  });

  it('does not remove anything that looks like a utf8-encoded BOM from streamed utf16le-encoded files', function(done) {
    var expectedContent = fs.readFileSync(leEncodedInputPath);

    function assertContent(contents) {
      expect(contents).toMatchObject(expectedContent);
    }

    function compareContents(file, enc, cb) {
      pipe([
        file.contents,
        concat(assertContent)
      ], function(err) {
        cb(err, file);
      });
    }

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].isStream()).toBe(true);
    }

    pipe([
      vfs.src(leEncodedInputPath, { buffer: false }),
      through.obj(compareContents),
      concat(assert)
    ], done);
  });

  it('globs files with default settings', function(done) {
    function assert(files) {
      expect(files.length).toBe(3);
    }

    pipe([
      vfs.src('./fixtures/src/*.txt', { cwd: __dirname }),
      concat(assert)
    ], done);
  });

  it('globs files with default settings and relative cwd', function(done) {
    var cwd = path.relative(process.cwd(), __dirname);

    function assert(files) {
      expect(files.length).toBe(3);
    }

    pipe([
      vfs.src('./fixtures/src/*.txt', { cwd: cwd }),
      concat(assert)
    ], done);
  });

  it('globs a directory with default settings', function(done) {
    var inputDirGlob = path.join(inputBase, 'no*');

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].isNull()).toBe(true);
      expect(files[0].isDirectory()).toBe(true);
    }

    pipe([
      vfs.src(inputDirGlob),
      concat(assert)
    ], done);
  });

  it('globs a directory with default settings and relative cwd', function(done) {
    var cwd = path.relative(process.cwd(), __dirname);

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].isNull()).toBe(true);
      expect(files[0].isDirectory()).toBe(true);
    }

    pipe([
      vfs.src('./fixtures/no*', { cwd: cwd }),
      concat(assert)
    ], done);
  });

  it('streams a directory with default settings', function(done) {
    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].path).toBe(srcInputBase);
      expect(files[0].isNull()).toBe(true);
      expect(files[0].isDirectory()).toBe(true);
    }

    pipe([
      vfs.src(srcInputBase),
      concat(assert)
    ], done);
  });

  it('streams file with with no contents using read: false option', function(done) {
    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].path).toBe(srcInputPath);
      expect(files[0].isNull()).toBe(true);
      expect(files[0].contents).toBeNull();
    }

    pipe([
      vfs.src(srcInputPath, { read: false }),
      concat(assert)
    ], done);
  });

  it('streams a file changed after since', function(done) {
    var lastUpdateDate = new Date(+fs.statSync(srcInputPath).mtime - 1000);

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].path).toBe(srcInputPath);
    }

    pipe([
      vfs.src(srcInputPath, { since: lastUpdateDate }),
      concat(assert)
    ], done);
  });

  it('does not stream a file changed before since', function(done) {
    var lastUpdateDate = new Date(+fs.statSync(srcInputPath).mtime + 1000);

    function assert(files) {
      expect(files.length).toBe(0);
    }

    pipe([
      vfs.src(srcInputPath, { since: lastUpdateDate }),
      concat(assert)
    ], done);
  });

  it('streams a file with streaming contents', function(done) {
    var expectedContent = fs.readFileSync(srcInputPath);

    function assertContent(contents) {
      expect(contents).toMatchObject(expectedContent);
    }

    function compareContents(file, enc, cb) {
      pipe([
        file.contents,
        concat(assertContent)
      ], function(err) {
        cb(err, file);
      });
    }

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files[0].path).toBe(srcInputPath);
      expect(files[0].isStream()).toBe(true);
    }

    pipe([
      vfs.src(srcInputPath, { buffer: false }),
      through.obj(compareContents),
      concat(assert)
    ], done);
  });

  it('can be used as a through stream and adds new files to the end', function(done) {
    var file = new File({
      base: inputBase,
      path: srcInputPath,
      contents: fs.readFileSync(srcInputPath),
      stat: fs.statSync(srcInputPath)
    });

    function assert(files) {
      expect(files.length).toBe(2);
      expect(files[0]).toBe(file);
    }

    pipe([
      from.obj([file]),
      vfs.src(srcInputPath),
      concat(assert)
    ], done);
  });

  it('can be used at beginning and in the middle', function(done) {
    function assert(files) {
      expect(files.length).toBe(2);
    }

    pipe([
      vfs.src(srcInputPath),
      vfs.src(srcInputPath),
      concat(assert)
    ], done);
  });

  it('does not pass options on to through2', function(done) {
    var mockFn = jest.fn();
    var read = mockFn.mockReturnValue(false);

    function assert() {
      // Called once to resolve the option
      expect(mockFn.mock.calls.length).toBe(1);
    }

    pipe([
      vfs.src(srcInputPath, { read: read }),
      concat(assert)
    ], done);
  });

  it('accepts the sourcemaps option', function(done) {
    function assert(files) {
      expect(files.length).toBe(1);
    }

    pipe([
      vfs.src(srcInputPath, { sourcemaps: true }),
      concat(assert)
    ], done);
  });
});
