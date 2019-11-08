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
var breakPrototype = require('./utils/break-prototype');
var mockError = require('./utils/mock-error');
var testConstants = require('./utils/test-constants');
var testStreams = require('./utils/test-streams');
var statMode = require('./utils/stat-mode');

var from = miss.from;
var concat = miss.concat;
var pipe = miss.pipe;

var count = testStreams.count;
var includes = testStreams.includes;
var rename = testStreams.rename;
var slowCount = testStreams.slowCount;
var string = testStreams.string;

var inputRelative = testConstants.inputRelative;

var pathElement = 'dest';
var destInputBase = path.join(testConstants.inputBase, pathElement);
var destInputPath = path.join(destInputBase, pathElement + '.test');
var destInputDirpath = path.join(destInputBase, 'foo');
var destOutputBase = path.join(testConstants.outputBase, pathElement);
var destOutputPath = path.join(destOutputBase, pathElement + '.test');
var destOutputDirpath = path.join(destOutputBase, 'foo');
var outputRenamePath = path.join(destOutputBase, 'foo2.txt');

var contents = fs.readFileSync(destInputPath, 'utf8');
var outputRelative = path.join(testConstants.outputRelative, pathElement);
var sourcemapContents = '//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4dHVyZXMiLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJmaXh0dXJlcyJdLCJzb3VyY2VzQ29udGVudCI6WyJIZWxsbyBXb3JsZCFcbiJdfQ==';

var noop = function() {};

function makeSourceMap() {
  return {
    version: 3,
    file: inputRelative,
    names: [],
    mappings: '',
    sources: [inputRelative],
    sourcesContent: [contents]
  };
}

describe('.dest()', function() {
  beforeEach(function(done) {
    mkdirp(destOutputBase, done);
  });

  afterEach(function() {
    jest.restoreAllMocks();
    rimraf.sync(destOutputBase);
  });

  it('throws on no folder argument', function(done) {
    function noFolder() {
      vfs.dest();
    }

    expect(noFolder).toThrow('Invalid dest() folder argument. Please specify a non-empty string or a function.');
    done();
  });

  it('throws on empty string folder argument', function(done) {
    function emptyFolder() {
      vfs.dest('');
    }

    expect(emptyFolder).toThrow('Invalid dest() folder argument. Please specify a non-empty string or a function.');
    done();
  });

  it('accepts the sourcemap option as true', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents),
      sourceMap: makeSourceMap()
    });

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files).toContain(file);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase, { sourcemaps: true }),
      concat(assert)
    ], done);
  });

  it('accepts the sourcemap option as a string', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents),
      sourceMap: makeSourceMap()
    });

    function assert(files) {
      expect(files.length).toBe(2);
      expect(files).toContain(file);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase, { sourcemaps: '.' }),
      concat(assert)
    ], done);
  });

  it('inlines sourcemaps when option is true', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents),
      sourceMap: makeSourceMap()
    });

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].contents.toString()).toMatch(new RegExp(sourcemapContents));
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase, { sourcemaps: true }),
      concat(assert)
    ], done);
  });

  it('generates an extra File when option is a string', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents),
      sourceMap: makeSourceMap()
    });

    function assert(files) {
      expect(files.length).toBe(2);
      expect(files).toContain(file);
      expect(files[0].contents.toString()).toMatch('//# sourceMappingURL=dest.test.map');
      expect(files[1].contents.toString()).toBe(JSON.stringify(makeSourceMap()));
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase, { sourcemaps: '.' }),
      concat(assert)
    ], done);
  });

  it('passes through writes with cwd', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: null
    });

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].cwd).toBe(__dirname);
    }

    pipe([
      from.obj([file]),
      vfs.dest(outputRelative, { cwd: __dirname }),
      concat(assert)
    ], done);
  });

  it('passes through writes with default cwd', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: null
    });

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].cwd).toBe(process.cwd());
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase),
      concat(assert)
    ], done);
  });

  it('does not write null files', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: null
    });

    function assert(files) {
      var exists = fs.existsSync(destOutputPath);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(destOutputBase);
      expect(files[0].path).toBe(destOutputPath);
      expect(exists).toBe(false);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase),
      concat(assert)
    ], done);
  });

  it('writes buffer files to the right folder with relative cwd', function(done) {
    var cwd = path.relative(process.cwd(), __dirname);

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function assert(files) {
      var outputContents = fs.readFileSync(destOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].cwd).toBe(__dirname);
      expect(files[0].base).toBe(destOutputBase);
      expect(files[0].path).toBe(destOutputPath);
      expect(outputContents).toBe(contents);
    }

    pipe([
      from.obj([file]),
      vfs.dest(outputRelative, { cwd: cwd }),
      concat(assert)
    ], done);
  });

  it('writes buffer files to the right folder with function and relative cwd', function(done) {
    var cwd = path.relative(process.cwd(), __dirname);

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function outputFn(f) {
      expect(f).toBe(file);
      return outputRelative;
    }

    function assert(files) {
      var outputContents = fs.readFileSync(destOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].cwd).toBe(__dirname);
      expect(files[0].base).toBe(destOutputBase);
      expect(files[0].path).toBe(destOutputPath);
      expect(outputContents).toBe(contents);
    }

    pipe([
      from.obj([file]),
      vfs.dest(outputFn, { cwd: cwd }),
      concat(assert)
    ], done);
  });

  it('writes buffer files to the right folder', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function assert(files) {
      var outputContents = fs.readFileSync(destOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(destOutputBase);
      expect(files[0].path).toBe(destOutputPath);
      expect(outputContents).toBe(contents);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase),
      concat(assert)
    ], done);
  });

  it('writes streaming files to the right folder', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: from([contents])
    });

    function assert(files) {
      var outputContents = fs.readFileSync(destOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(destOutputBase);
      expect(files[0].path).toBe(destOutputPath);
      expect(outputContents).toBe(contents);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase),
      concat(assert)
    ], done);
  });

  it('writes large streaming files to the right folder', function(done) {
    var size = 40000;

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: string(size)
    });

    function assert(files) {
      var stats = fs.lstatSync(destOutputPath);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(stats.size).toBe(size);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase),
      concat(assert)
    ], done);
  });

  it('writes directories to the right folder', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true)
      }
    });

    function assert(files) {
      var stats = fs.lstatSync(destOutputDirpath);

      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(files[0].base).toBe(destOutputBase);
      // TODO: normalize this path
      expect(files[0].path).toBe(destOutputDirpath);
      expect(stats.isDirectory()).toBe(true);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase),
      concat(assert)
    ], done);
  });

  it('allows piping multiple dests in streaming mode', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function assert() {
      var outputContents1 = fs.readFileSync(destOutputPath, 'utf8');
      var outputContents2 = fs.readFileSync(outputRenamePath, 'utf8');
      expect(outputContents1).toBe(contents);
      expect(outputContents2).toBe(contents);
    }

    pipe([
      from.obj([file]),
      includes({ path: destInputPath }),
      vfs.dest(destOutputBase),
      rename(outputRenamePath),
      includes({ path: outputRenamePath }),
      vfs.dest(destOutputBase),
      concat(assert)
    ], done);
  });

  it('writes new files with the default user mode', function(done) {
    var expectedMode = applyUmask('666');

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function assert(files) {
      expect(files.length).toBe(1);
      expect(files).toContain(file);
      expect(statMode(destOutputPath)).toBe(expectedMode);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase),
      concat(assert)
    ], done);
  });

  it('reports i/o errors', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function assert(err) {
      // err instanceof Error === false
      expect(err.constructor.name).toBe('Error');
      expect(Object.keys(err.constructor)).toMatchObject(Object.keys(Error));
      done();
    }

    fs.closeSync(fs.openSync(destOutputPath, 'w'));
    fs.chmodSync(destOutputPath, 0);

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase)
    ], assert);
  });

  it('reports stat errors', function(done) {
    var expectedMode = applyUmask('722');

    var fstatSpy = jest.spyOn(fs, 'fstat').mockImplementation(mockError);

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents),
      stat: {
        mode: expectedMode
      }
    });

    function assert(err) {
      expect(err).toBeInstanceOf(Error);
      expect(fstatSpy).toHaveBeenCalled();
      done();
    }

    fs.closeSync(fs.openSync(destOutputPath, 'w'));

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase)
    ], assert);
  });

  it('does not overwrite files with overwrite option set to false', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function assert(files) {
      var outputContents = fs.readFileSync(destOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(existingContents);
    }

    // Write expected file which should not be overwritten
    fs.writeFileSync(destOutputPath, existingContents);

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase, { overwrite: false }),
      concat(assert)
    ], done);
  });

  it('overwrites files with overwrite option set to true', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function assert(files) {
      var outputContents = fs.readFileSync(destOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(contents);
    }

    // This should be overwritten
    fs.writeFileSync(destOutputPath, existingContents);

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase, { overwrite: true }),
      concat(assert)
    ], done);
  });

  it('does not overwrite files with overwrite option set to a function that returns false', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function overwrite(f) {
      expect(f).toBe(file);
      return false;
    }

    function assert(files) {
      var outputContents = fs.readFileSync(destOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(existingContents);
    }

    // Write expected file which should not be overwritten
    fs.writeFileSync(destOutputPath, existingContents);

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase, { overwrite: overwrite }),
      concat(assert)
    ], done);
  });

  it('overwrites files with overwrite option set to a function that returns true', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function overwrite(f) {
      expect(f).toBe(file);
      return true;
    }

    function assert(files) {
      var outputContents = fs.readFileSync(destOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(contents);
    }

    // This should be overwritten
    fs.writeFileSync(destOutputPath, existingContents);

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase, { overwrite: overwrite }),
      concat(assert)
    ], done);
  });

  it('appends content with append option set to true', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function assert(files) {
      var outputContents = fs.readFileSync(destOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(existingContents + contents);
    }

    // This should be overwritten
    fs.writeFileSync(destOutputPath, existingContents);

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase, { append: true }),
      concat(assert)
    ], done);
  });

  it('appends content with append option set to a function that returns true', function(done) {
    var existingContents = 'Lorem Ipsum';

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from(contents)
    });

    function append(f) {
      expect(f).toBe(file);
      return true;
    }

    function assert(files) {
      var outputContents = fs.readFileSync(destOutputPath, 'utf8');

      expect(files.length).toBe(1);
      expect(outputContents).toBe(existingContents + contents);
    }

    // This should be overwritten
    fs.writeFileSync(destOutputPath, existingContents);

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase, { append: append }),
      concat(assert)
    ], done);
  });

  it('emits a finish event', function(done) {
    var destStream = vfs.dest(destOutputBase);

    destStream.once('finish', done);

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: Buffer.from('1234567890')
    });

    pipe([
      from.obj([file]),
      destStream
    ]);
  });

  it('does not get clogged by highWaterMark', function(done) {
    var expectedCount = 17;
    var highwatermarkFiles = [];

    for (var idx = 0; idx < expectedCount; idx++) {
      var file = new File({
        base: destInputBase,
        path: destInputPath,
        contents: Buffer.from(contents)
      });
      highwatermarkFiles.push(file);
    }

    pipe([
      from.obj(highwatermarkFiles),
      count(expectedCount),
      // Must be in the Writable position to test this
      // So concat-stream cannot be used
      vfs.dest(destOutputBase)
    ], done);
  });

  it('allows backpressure when piped to another, slower stream', function(done) {
    jest.setTimeout(20000);

    var expectedCount = 24;
    var highwatermarkFiles = [];

    for (var idx = 0; idx < expectedCount; idx++) {
      var file = new File({
        base: destInputBase,
        path: destInputPath,
        contents: Buffer.from(contents)
      });
      highwatermarkFiles.push(file);
    }

    pipe([
      from.obj(highwatermarkFiles),
      count(expectedCount),
      vfs.dest(destOutputBase),
      slowCount(expectedCount)
    ], done);
  });

  it('respects readable listeners on destination stream', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputDirpath,
      contents: null
    });

    var destStream = vfs.dest(destOutputBase);
    var readables = 0;

    destStream.on('readable', function() {
      var data = destStream.read();

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
      destStream
    ], assert);
  });

  it('respects data listeners on destination stream', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputDirpath,
      contents: null
    });

    var destStream = vfs.dest(destOutputBase);
    var datas = 0;

    destStream.on('data', function() {
      datas++;
    });

    function assert(err) {
      expect(datas).toBe(1);
      done(err);
    }

    pipe([
      from.obj([file]),
      destStream
    ], assert);
  });

  it('sinks the stream if all the readable event handlers are removed', function(done) {
    var expectedCount = 17;
    var highwatermarkFiles = [];

    for (var idx = 0; idx < expectedCount; idx++) {
      var file = new File({
        base: destInputBase,
        path: destInputPath,
        contents: Buffer.from(contents)
      });
      highwatermarkFiles.push(file);
    }

    var destStream = vfs.dest(destOutputBase);

    destStream.on('readable', noop);

    pipe([
      from.obj(highwatermarkFiles),
      count(expectedCount),
      // Must be in the Writable position to test this
      // So concat-stream cannot be used
      destStream
    ], done);

    process.nextTick(function() {
      destStream.removeListener('readable', noop);
    });
  });

  it('sinks the stream if all the data event handlers are removed', function(done) {
    var expectedCount = 17;
    var highwatermarkFiles = [];

    for (var idx = 0; idx < expectedCount; idx++) {
      var file = new File({
        base: destInputBase,
        path: destInputPath,
        contents: Buffer.from(contents)
      });
      highwatermarkFiles.push(file);
    }

    var destStream = vfs.dest(destOutputBase);

    destStream.on('data', noop);

    pipe([
      from.obj(highwatermarkFiles),
      count(expectedCount),
      // Must be in the Writable position to test this
      // So concat-stream cannot be used
      destStream
    ], done);

    process.nextTick(function() {
      destStream.removeListener('data', noop);
    });
  });

  it('successfully processes files with streaming contents', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: from([contents])
    });

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase)
    ], done);
  });

  it('errors when a non-Vinyl object is emitted', function(done) {
    var file = {};

    function assert(err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Received a non-Vinyl object in `dest()`');
      done();
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase)
    ], assert);
  });

  it('errors when a buffer-mode stream is piped to it', function(done) {
    var file = Buffer.from('test');

    function assert(err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Received a non-Vinyl object in `dest()`');
      done();
    }

    pipe([
      from([file]),
      vfs.dest(destOutputBase)
    ], assert);
  });

  it('does not error if vinyl object is a directory and we cannot open it', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true),
        mode: applyUmask('000')
      }
    });

    function assert() {
      var exists = fs.existsSync(destOutputDirpath);
      expect(exists).toBe(true);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase),
      concat(assert)
    ], done);
  });

  it('errors if vinyl object is a directory and open errors', function(done) {
    var openSpy = jest.spyOn(fs, 'open').mockImplementation(mockError);

    var file = new File({
      base: destInputBase,
      path: destInputDirpath,
      contents: null,
      stat: {
        isDirectory: always(true)
      }
    });

    function assert(err) {
      expect(err).toBeInstanceOf(Error);
      expect(openSpy).toHaveBeenCalled();
      done();
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase)
    ], assert);
  });

  it('errors if content stream errors', function(done) {
    var contentStream = from(function(size, cb) {
      cb(new Error('mocked error'));
    });

    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: contentStream
    });

    function assert(err) {
      expect(err).toBeInstanceOf(Error);
      done();
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase)
    ], assert);
  });

  it('does not pass options on to through2', function(done) {
    var file = new File({
      base: destInputBase,
      path: destInputPath,
      contents: null
    });

    var mockFn = jest.fn();
    var read = mockFn.mockReturnValue(false);

    function assert() {
      // Called never because it's not a valid option
      expect(mockFn.mock.calls.length).toBe(0);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase, { read: read }),
      concat(assert)
    ], done);
  });

  it('does not marshall a Vinyl object with isSymbolic method', function(done) {
    var file = new File({
      base: destOutputBase,
      path: destOutputPath
    });

    function assert(files) {
      expect(files.length).toBe(1);
      // Avoid comparing stats because they get reflected
      delete files[0].stat;
      expect(file).toMatchObject(files[0]);
      expect(file).toBe(files[0]);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase),
      concat(assert)
    ], done);
  });

  it('marshalls a Vinyl object without isSymbolic to a newer Vinyl', function(done) {
    var file = new File({
      base: destOutputBase,
      path: destOutputPath
    });

    breakPrototype(file);

    function assert(files) {
      expect(files.length).toBe(1);
      // Avoid comparing stats because they get reflected
      delete files[0].stat;
      expect(file).toMatchObject(files[0]);
      expect(file).not.toBe(files[0]);
    }

    pipe([
      from.obj([file]),
      vfs.dest(destOutputBase),
      concat(assert)
    ], done);
  });
});
