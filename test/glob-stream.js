'use strict';

var expect = require('expect');
var miss = require('mississippi');
var through = miss.through;

var globStream = require('../lib/glob-stream');
var readableStream = require('../lib/glob-stream/readable');

function deWindows(p) {
  return p.replace(/\\/g, '/');
}

var pipe = miss.pipe;
var concat = miss.concat;
var through2 = miss.through;

var dir = deWindows(__dirname);

describe('glob-stream', function() {

  describe('index.js', function() {

    it('streams a single object when given a directory path', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures',
        path: dir + '/fixtures/whatsgoingon'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream('./fixtures/whatsgoingon', { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('streams a single object when given a file path', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures',
        path: dir + '/fixtures/test.coffee'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream('./fixtures/test.coffee', { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('streams only objects with directory paths when given a directory glob', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures/whatsgoingon/',
        path: dir + '/fixtures/whatsgoingon/hey'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream('./fixtures/whatsgoingon/*/', { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('streams only objects with file paths from a non-directory glob', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures/',
        path: dir + '/fixtures/test.coffee'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream('./fixtures/*.coffee', { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('properly handles ( ) in cwd path', function(done) {
      var cwd = dir + '/fixtures/has (parens)';

      var expected = {
        cwd: cwd,
        base: cwd + '/',
        path: cwd + '/test.dmc'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream('*.dmc', { cwd: cwd }),
        concat(assert)
      ], done);
    });

    it('sets the correct base when ( ) in glob', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures/has (parens)/',
        path: dir + '/fixtures/has (parens)/test.dmc'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream('./fixtures/has (parens)/*.dmc', { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('finds files in paths that contain ( ) when they match the glob', function(done) {
      var expected = [
        {
          cwd: dir,
          base: dir + '/fixtures/',
          path: dir + '/fixtures/has (parens)/test.dmc'
        },
        {
          cwd: dir,
          base: dir + '/fixtures/',
          path: dir + '/fixtures/stuff/run.dmc'
        },
        {
          cwd: dir,
          base: dir + '/fixtures/',
          path: dir + '/fixtures/stuff/test.dmc'
        }
      ];

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(3);
        expect(pathObjs).toContainEqual(expected[0]);
        expect(pathObjs).toContainEqual(expected[1]);
        expect(pathObjs).toContainEqual(expected[2]);
      }

      pipe([
        globStream('./fixtures/**/*.dmc', { cwd: dir }),
        concat(assert)
      ], done);
    });

    // TODO: This doesn't seem to be testing that backpressure is respected
    it('respects backpressure and stream state', function(done) {
      var delayStream = through2.obj(function(data, enc, cb) {
        var self = this;

        self.pause();
        setTimeout(function() {
          cb(null, data);
          self.resume();
        }, 500);
      });

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(2);
      }

      pipe([
        globStream('./fixtures/stuff/*.dmc', { cwd: dir }),
        delayStream,
        concat(assert)
      ], done);
    });

    it('properly orders objects when given multiple paths and specified base', function(done) {
      var base = dir + '/fixtures';

      var expected = [
        {
          cwd: base,
          base: base,
          path: base + '/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt'
        },
        {
          cwd: base,
          base: base,
          path: base + '/test.coffee'
        },
        {
          cwd: base,
          base: base,
          path: base + '/whatsgoingon/test.js'
        }
      ];

      var paths = [
        './whatsgoingon/hey/isaidhey/whatsgoingon/test.txt',
        './test.coffee',
        './whatsgoingon/test.js'
      ];

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(3);
        expect(pathObjs).toEqual(expected);
      }

      pipe([
        globStream(paths, { cwd: base, base: base }),
        concat(assert)
      ], done);
    });

    it('properly orders objects when given multiple paths and cwdbase', function(done) {
      var base = dir + '/fixtures';

      var expected = [
        {
          cwd: base,
          base: base,
          path: base + '/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt'
        },
        {
          cwd: base,
          base: base,
          path: base + '/test.coffee'
        },
        {
          cwd: base,
          base: base,
          path: base + '/whatsgoingon/test.js'
        }
      ];

      var paths = [
        './whatsgoingon/hey/isaidhey/whatsgoingon/test.txt',
        './test.coffee',
        './whatsgoingon/test.js'
      ];

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(3);
        expect(pathObjs).toEqual(expected);
      }

      pipe([
        globStream(paths, { cwd: base, cwdbase: true }),
        concat(assert)
      ], done);
    });

    it('properly orders objects when given multiple globs with globstars', function(done) {
      var expected = [
        {
          cwd: dir,
          base: dir + '/fixtures/',
          path: dir + '/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt'
        },
        {
          cwd: dir,
          base: dir + '/fixtures/',
          path: dir + '/fixtures/test.coffee'
        },
        {
          cwd: dir,
          base: dir + '/fixtures/',
          path: dir + '/fixtures/whatsgoingon/test.js'
        },
        {
          cwd: dir,
          base: dir + '/fixtures/',
          path: dir + '/fixtures/has (parens)/test.dmc'
        },
        {
          cwd: dir,
          base: dir + '/fixtures/',
          path: dir + '/fixtures/stuff/test.dmc'
        }
      ];

      var globs = [
        './fixtures/**/test.txt',
        './fixtures/**/test.coffee',
        './fixtures/**/test.js',
        './fixtures/**/test.dmc'
      ];

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(5);
        expect(pathObjs).toEqual(expected);
      }

      pipe([
        globStream(globs, { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('properly orders objects when given multiple absolute paths and no cwd', function(done) {
      var expected = [
        {
          cwd: process.cwd(),
          base: dir + '/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon',
          path: dir + '/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt'
        },
        {
          cwd: process.cwd(),
          base: dir + '/fixtures',
          path: dir + '/fixtures/test.coffee'
        },
        {
          cwd: process.cwd(),
          base: dir + '/fixtures/whatsgoingon',
          path: dir + '/fixtures/whatsgoingon/test.js'
        }
      ];

      var paths = [
        dir + '/fixtures/whatsgoingon/hey/isaidhey/whatsgoingon/test.txt',
        dir + '/fixtures/test.coffee',
        dir + '/fixtures/whatsgoingon/test.js'
      ];

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(3);
        expect(pathObjs).toEqual(expected);
      }

      pipe([
        globStream(paths),
        concat(assert)
      ], done);
    });

    it('removes duplicate objects from the stream using default (path) filter', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures',
        path: dir + '/fixtures/test.coffee'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream(['./fixtures/test.coffee', './fixtures/*.coffee'], { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('removes duplicate objects from the stream using custom string filter', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures/stuff',
        path: dir + '/fixtures/stuff/run.dmc'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream(['./fixtures/stuff/run.dmc', './fixtures/stuff/test.dmc'], { cwd: dir, uniqueBy: 'base' }),
        concat(assert)
      ], done);
    });

    it('removes duplicate objects from the stream using custom function filter', function(done) {
      var expected = [
        {
          cwd: dir,
          base: dir + '/fixtures/stuff/',
          path: dir + '/fixtures/stuff/run.dmc'
        },
        {
          cwd: dir,
          base: dir + '/fixtures/stuff/',
          path: dir + '/fixtures/stuff/test.dmc'
        }
      ];

      var uniqueBy = function(data) {
        return data.path;
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(2);
        expect(pathObjs).toContainEqual(expected[0]);
        expect(pathObjs).toContainEqual(expected[1]);
      }

      pipe([
        globStream('./fixtures/stuff/*.dmc', { cwd: dir, uniqueBy: uniqueBy }),
        concat(assert)
      ], done);
    });

    it('ignores dotfiles without dot option', function(done) {
      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(0);
      }

      pipe([
        globStream('./fixtures/*swag', { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('finds dotfiles with dot option', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures/',
        path: dir + '/fixtures/.swag'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream('./fixtures/*swag', { cwd: dir, dot: true }),
        concat(assert)
      ], done);
    });

    it('removes dotfiles that match negative globs with dot option', function(done) {
      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(0);
      }

      pipe([
        globStream(['./fixtures/*swag', '!./fixtures/**'], { cwd: dir, dot: true }),
        concat(assert)
      ], done);
    });

    it('respects pause/resume', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures',
        path: dir + '/fixtures/test.coffee'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      var stream = globStream('./fixtures/test.coffee', { cwd: dir });
      stream.pause();

      pipe([
        stream,
        concat(assert)
      ], done);

      setTimeout(function() {
        stream.resume();
      }, 1000);
    });

    it('works with direct paths and no cwd', function(done) {
      var expected = {
        cwd: process.cwd(),
        base: dir + '/fixtures',
        path: dir + '/fixtures/test.coffee'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream(dir + '/fixtures/test.coffee'),
        concat(assert)
      ], done);
    });

    it('supports negative globs', function(done) {
      var expected = {
        cwd: process.cwd(),
        base: dir + '/fixtures/stuff/',
        path: dir + '/fixtures/stuff/run.dmc'
      };

      var globs = [
        dir + '/fixtures/stuff/*.dmc',
        '!' + dir + '/fixtures/stuff/*test.dmc'
      ];

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream(globs),
        concat(assert)
      ], done);
    });

    it('supports negative file paths', function(done) {
      var expected = {
        cwd: process.cwd(),
        base: dir + '/fixtures/stuff/',
        path: dir + '/fixtures/stuff/run.dmc'
      };

      var paths = [
        dir + '/fixtures/stuff/*.dmc',
        '!' + dir + '/fixtures/stuff/test.dmc'
      ];

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream(paths),
        concat(assert)
      ], done);
    });

    it('does not error when a negative glob removes all matches from a positive glob', function(done) {
      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(0);
      }

      pipe([
        globStream(['./fixtures/**/*.js', '!./**/test.js'], { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('respects order of negative globs', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures/stuff',
        path: dir + '/fixtures/stuff/run.dmc'
      };

      var globs = [
        './fixtures/stuff/*',
        '!./fixtures/stuff/*.dmc',
        './fixtures/stuff/run.dmc'
      ];

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream(globs, { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('ignores leading negative globs', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures/stuff',
        path: dir + '/fixtures/stuff/run.dmc'
      };

      var globs = [
        '!./fixtures/stuff/*.dmc',
        './fixtures/stuff/run.dmc'
      ];

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream(globs, { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('throws on invalid glob argument', function(done) {
      expect(globStream.bind(globStream, 42, { cwd: dir })).toThrow(/Invalid glob .* 0/);
      expect(globStream.bind(globStream, ['.', 42], { cwd: dir })).toThrow(/Invalid glob .* 1/);
      done();
    });

    it('throws on missing positive glob', function(done) {
      expect(globStream.bind(globStream, '!c', { cwd: dir })).toThrow(/Missing positive glob/);
      expect(globStream.bind(globStream, ['!a', '!b'], { cwd: dir })).toThrow(/Missing positive glob/);
      done();
    });

    it('emits an error when file not found on singular path', function(done) {
      function assert(err) {
        expect(err.message).toMatch(/File not found with singular glob/);
        done();
      }

      pipe([
        globStream('notfound'),
        concat()
      ], assert);
    });

    it('does not emit an error when file not found on glob containing {}', function(done) {
      function assert(err) {
        expect(err).toBeUndefined();
        done();
      }

      pipe([
        globStream('notfound{a,b}'),
        concat()
      ], assert);
    });

    it('does not emit an error on singular path when allowEmpty is true', function(done) {
      function assert(err) {
        expect(err).toBeUndefined();
        done();
      }

      pipe([
        globStream('notfound', { allowEmpty: true }),
        concat()
      ], assert);
    });

    it('emits an error when a singular path in multiple paths not found', function(done) {
      function assert(err) {
        expect(err.message).toMatch(/File not found with singular glob/);
        done();
      }

      pipe([
        globStream(['notfound', './fixtures/whatsgoingon'], { cwd: dir }),
        concat()
      ], assert);
    });

    it('emits an error when a singular path in multiple paths/globs not found', function(done) {
      function assert(err) {
        expect(err.message).toMatch(/File not found with singular glob/);
        done();
      }

      pipe([
        globStream(['notfound', './fixtures/*.coffee'], { cwd: dir }),
        concat()
      ], assert);
    });

    it('resolves absolute paths when root option is given', function(done) {
      var expected = {
        cwd: process.cwd(),
        base: dir + '/fixtures',
        path: dir + '/fixtures/test.coffee'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        globStream('/test.coffee', { root: dir + '/fixtures' }),
        concat(assert)
      ], done);
    });
  });

  describe('options', function() {

    it('avoids mutation of options', function(done) {
      var defaultedOpts = {
        cwd: process.cwd(),
        dot: false,
        silent: true,
        nonull: false,
        cwdbase: false
      };

      var opts = {};

      var stream = globStream(dir + '/fixtures/stuff/run.dmc', opts);
      expect(Object.keys(opts).length).toEqual(0);
      expect(opts).not.toEqual(defaultedOpts);

      pipe([
        stream,
        concat()
      ], done);
    });

    describe('silent', function() {

      it('accepts a boolean', function(done) {
        pipe([
          globStream(dir + '/fixtures/stuff/run.dmc', { silent: false }),
          concat()
        ], done);
      });
    });

    describe('nonull', function() {

      it('accepts a boolean', function(done) {
        pipe([
          globStream('notfound{a,b}', { nonull: true }),
          concat()
        ], done);
      });

      it('does not have any effect on our results', function(done) {
        function assert(pathObjs) {
          expect(pathObjs.length).toEqual(0);
        }

        pipe([
          globStream('notfound{a,b}', { nonull: true }),
          concat(assert)
        ], done);
      });
    });

    describe('ignore', function() {

      it('accepts a string (in addition to array)', function(done) {
        var expected = {
          cwd: dir,
          base: dir + '/fixtures/stuff/',
          path: dir + '/fixtures/stuff/run.dmc'
        };

        function assert(pathObjs) {
          expect(pathObjs.length).toEqual(1);
          expect(pathObjs[0]).toEqual(expected);
        }

        pipe([
          globStream('./fixtures/stuff/*.dmc', { cwd: dir, ignore: './fixtures/stuff/test.dmc' }),
          concat(assert)
        ], done);
      });

      it('supports the ignore option instead of negation', function(done) {
        var expected = {
          cwd: dir,
          base: dir + '/fixtures/stuff/',
          path: dir + '/fixtures/stuff/run.dmc'
        };

        function assert(pathObjs) {
          expect(pathObjs.length).toEqual(1);
          expect(pathObjs[0]).toEqual(expected);
        }

        pipe([
          globStream('./fixtures/stuff/*.dmc', { cwd: dir, ignore: ['./fixtures/stuff/test.dmc'] }),
          concat(assert)
        ], done);
      });

      it('supports the ignore option with dot option', function(done) {
        function assert(pathObjs) {
          expect(pathObjs.length).toEqual(0);
        }

        pipe([
          globStream('./fixtures/*swag', { cwd: dir, dot: true, ignore: ['./fixtures/**'] }),
          concat(assert)
        ], done);
      });

      it('merges ignore option and negative globs', function(done) {
        var globs = [
          './fixtures/stuff/*.dmc',
          '!./fixtures/stuff/test.dmc'
        ];

        function assert(pathObjs) {
          expect(pathObjs.length).toEqual(0);
        }

        pipe([
          globStream(globs, { cwd: dir, ignore: ['./fixtures/stuff/run.dmc'] }),
          concat(assert)
        ], done);
      });
    });
  });

  describe('readable.js', function() {

    it('emits an error if there are no matches', function(done) {
      function assert(err) {
        expect(err.message).toMatch(/^File not found with singular glob/g);
        done();
      }

      pipe([
        readableStream('notfound', [], { cwd: dir }),
        concat()
      ], assert);
    });

    it('does not throw an error if you push to it', function(done) {
      var stub = {
        cwd: dir,
        base: dir,
        path: dir
      };

      var gs = readableStream('./fixtures/test.coffee', [], { cwd: dir });

      gs.push(stub);

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(2);
        expect(pathObjs[0]).toEqual(stub);
      }

      pipe([
        gs,
        concat(assert)
      ], done);
    });

    it('accepts a file path', function(done) {
      var expected = {
        cwd: dir,
        base: dir + '/fixtures',
        path: dir + '/fixtures/test.coffee'
      };

      function assert(pathObjs) {
        expect(pathObjs.length).toBe(1);
        expect(pathObjs[0]).toEqual(expected);
      }

      pipe([
        readableStream('./fixtures/test.coffee', [], { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('accepts a glob', function(done) {
      var expected = [
        {
          cwd: dir,
          base: dir + '/fixtures/',
          path: dir + '/fixtures/has (parens)/test.dmc'
        },
        {
          cwd: dir,
          base: dir + '/fixtures/',
          path: dir + '/fixtures/stuff/run.dmc'
        },
        {
          cwd: dir,
          base: dir + '/fixtures/',
          path: dir + '/fixtures/stuff/test.dmc'
        }
      ];

      function assert(pathObjs) {
        expect(pathObjs.length).toBe(3);
        expect(pathObjs).toContainEqual(expected[0]);
        expect(pathObjs).toContainEqual(expected[1]);
        expect(pathObjs).toContainEqual(expected[2]);
      }

      pipe([
        readableStream('./fixtures/**/*.dmc', [], { cwd: dir }),
        concat(assert)
      ], done);
    });

    it('pauses the globber upon backpressure', function(done) {
      var gs = readableStream('./fixtures/**/*.dmc', [], { cwd: dir, highWaterMark: 1 });

      var spy = jest.spyOn(gs._globber, 'pause');

      function waiter(pathObj, _, cb) {
        setTimeout(function() {
          cb(null, pathObj);
        }, 500);
      }

      function assert(pathObjs) {
        expect(pathObjs.length).toEqual(3);
        expect(spy).toHaveBeenCalledTimes(2);
      }

      pipe([
        gs,
        through.obj({ highWaterMark: 1 }, waiter),
        concat(assert)
      ], done);
    });

    it('destroys the readable stream with an error if no match is found', function(done) {
      var gs = readableStream('notfound', []);

      var spy = jest.spyOn(gs, 'destroy');

      function assert(err) {
        expect(spy).toHaveBeenCalledWith(err);
        expect(err.message).toMatch(/File not found with singular glob/);
        done();
      }

      pipe([
        gs,
        concat()
      ], assert);
    });
  });
});
