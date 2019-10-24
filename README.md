# vinyl-fs

> [Vinyl][vinyl] adapter for the file system.

[![Known Vulnerabilities][snyk-image]][snyk-url]
[![Mac/Linux Build Status][travis-image]][travis-url]
[![Windows Build Status][appveyor-image]][appveyor-url]
[![Coverage Status][coveralls-image]][coveralls-url]
![Node Version][version-image]
[![License][license-image]][license-url]

### This package provides long-term support for `vinyl-fs` at major version 3.

This in turn provides <a href="https://github.com/electric-eloquence/gulp#readme" target="_blank">
long-term support for gulp at major version 3</a>.

## What is Vinyl?

[Vinyl][vinyl] is a very simple metadata object that describes a file. When you think of a file, two attributes come to mind: `path` and `contents`. These are the main attributes on a [Vinyl][vinyl] object. A file does not necessarily represent something on your computer’s file system. You have files on S3, FTP, Dropbox, Box, CloudThingly.io and other services. [Vinyl][vinyl] can be used to describe files from all of these sources.

## What is a Vinyl Adapter?

While Vinyl provides a clean way to describe a file, we now need a way to access these files. Each file source needs what we call a "Vinyl adapter". A Vinyl adapter simply exposes a `src(globs)` and a `dest(folder)` method. Each return a stream. The `src` stream produces Vinyl objects, and the `dest` stream consumes Vinyl objects. Vinyl adapters can expose extra methods that might be specific to their input/output medium, such as the `symlink` method `vinyl-fs` provides.

## Install

```shell
npm install @electric-eloquence/vinyl-fs
```

## Use

```javascript
var map = require('map-stream');
var vfs = require('@electric-eloquence/vinyl-fs');

var log = function(file, cb) {
  console.log(file.path);
  cb(null, file);
};

vfs.src(['./js/**/*.js', '!./js/vendor/*.js'])
  .pipe(map(log))
  .pipe(vfs.dest('./output'));
```

## API

### `src(globs[, options])`

Takes a glob string or an array of glob strings as the first argument and an options object as the second.
Returns a stream of [vinyl] `File` objects.

__Note: UTF-8 BOM will be removed from all UTF-8 files read with `.src` unless disabled in the options.__

#### Globs

Globs are executed in order, so negations should follow positive globs.

For example:

```js
fs.src(['!b*', '*'])
```

would not exclude any files, but the following would exclude all files starting with "b":

```js
fs.src(['*', '!b*'])
```

#### Options

- Values passed to the options must be of the expected type, otherwise they will be ignored.
- All options can be passed a function instead of a value. The function will be called with the [vinyl] `File` object as its only argument and must return a value of the expected type for that option.

##### `options.buffer`

Whether or not you want to buffer the file contents into memory. Setting to `false` will make `file.contents` a paused Stream.

Type: `Boolean`

Default: `true`

##### `options.read`

Whether or not you want the file to be read at all. Useful for stuff like removing files. Setting to `false` will make `file.contents = null` and will disable writing the file to disk via `.dest()`.

Type: `Boolean`

Default: `true`

##### `options.since`

Only streams files that have been modified since the time specified.

Type: `Date` or `Number`

Default: `undefined`

##### `options.removeBOM`

Causes the BOM to be removed on UTF-8 encoded files. Set to `false` if you need the BOM for some reason.

Type: `Boolean`

Default: `true`

##### `options.sourcemaps`

Enables sourcemap support on files passed through the stream.  Will load inline sourcemaps and resolve sourcemap links from files.

Type: `Boolean`

Default: `false`

##### `options.resolveSymlinks`

Whether or not to recursively resolve symlinks to their targets. Set to `false` to preserve them as symlinks and make `file.symlink` equal the original symlink's target path.

Type: `Boolean`

Default: `true`

##### `options.dot`

Whether or not you want globs to match on dot files (e.g. `.gitignore`).

__Note: This option is not resolved from a function because it is passed verbatim to node-glob.__

Type: `Boolean`

Default: `false`

##### other

Any glob-related options are documented in [glob-stream] and [node-glob] and are forwarded verbatim.

### `dest(folder[, options])`

Takes a folder path string or a function as the first argument and an options object as the second. If given a function, it will be called with each [vinyl] `File` object and must return a folder path.
Returns a stream that accepts [vinyl] `File` objects, writes them to disk at the folder/cwd specified, and passes them downstream so you can keep piping these around.

If the file has a `symlink` attribute specifying a target path, then a symlink will be created.

__Note: The file will be modified after being written to this stream.__
  - `cwd`, `base`, and `path` will be overwritten to match the folder.
  - `stat` will be updated to match the file on the filesystem.
  - `contents` will have it's position reset to the beginning if it is a stream.

#### Options

- Values passed to the options must be of the expected type, otherwise they will be ignored.
- All options can be passed a function instead of a value. The function will be called with the [vinyl] `File` object as its only argument and must return a value of the expected type for that option.

##### `options.cwd`

The working directory the folder is relative to.

Type: `String`

Default: `process.cwd()`

##### `options.mode`

The mode the files should be created with. This option is only resolved if the [vinyl] `File` is not symbolic.

__Note: This functionality is disabled on Windows operating systems due to Windows having very unexpected results through usage of `fs.fchmod`.__

Type: `Number`

Default: The `mode` of the input file (`file.stat.mode`) if any, or the process mode if the input file has no `mode` property.

##### `options.dirMode`

The mode directories should be created with.

__Note: This functionality is disabled on Windows operating systems due to Windows having very unexpected results through usage of `fs.fchmod`.__

Type: `Number`

Default: The process `mode`.

##### `options.overwrite`

Whether or not existing files with the same path should be overwritten.

Type: `Boolean`

Default: `true` (always overwrite existing files)

##### `options.append`

Whether or not new data should be appended after existing file contents (if any).

Type: `Boolean`

Default: `false` (always replace existing contents, if any)

##### `options.sourcemaps`

Enables sourcemap support on files passed through the stream.  Will write inline soucemaps if specified as `true`.
Specifying a `String` path will write external sourcemaps at the given path.

Examples:

```js
// Write as inline comments
vfs.dest('./', { sourcemaps: true });

// Write as files in the same folder
vfs.dest('./', { sourcemaps: '.' });
```

Type: `Boolean` or `String`

Default: `undefined` (do not write sourcemaps)

##### `options.relativeSymlinks`

When creating a symlink, whether or not the created symlink should be relative. If `false`, the symlink will be absolute.

__Note: This option will be ignored if a `junction` is being created, as they must be absolute.__

Type: `Boolean`

Default: `false`

##### `options.useJunctions`

When creating a symlink, whether or not a directory symlink should be created as a `junction`.
This option is only relevant on Windows and ignored elsewhere. Please refer to the [Symbolic Links on Windows][symbolic-caveats] section below.

Type: `Boolean`

Default: `true`

### `symlink(folder[, options])`

Takes a folder path string or a function as the first argument and an options object as the second. If given a function, it will be called with each [vinyl] `File` object and must return a folder path.
Returns a stream that accepts [vinyl] `File` objects, creates a symbolic link (i.e. symlink) at the folder/cwd specified, and passes them downstream so you can keep piping these around.

__Note: The file will be modified after being written to this stream.__
  - `cwd`, `base`, and `path` will be overwritten to match the folder.
  - `stat` will be updated to match the symlink on the filesystem.
  - `contents` will be set to `null`.
  - `symlink` will be added or replaced to be the original path.

__Note: On Windows, directory links are created using Junctions by default. Use the `useJunctions` option to disable this behavior.__

#### Options

- Values passed to the options must be of the expected type, otherwise they will be ignored.
- All options can be passed a function instead of a value. The function will be called with the [vinyl] `File` object as its only argument and must return a value of the expected type for that option.

##### `options.cwd`

The working directory the folder is relative to.

Type: `String`

Default: `process.cwd()`

##### `options.dirMode`

The mode directories should be created with.

Type: `Number`

Default: The process mode.

##### `options.overwrite`

Whether or not existing files with the same path should be overwritten.

Type: `Boolean`

Default: `true` (always overwrite existing files)

##### `options.relativeSymlinks`

Whether or not the created symlinks should be relative. If `false`, the symlink will be absolute.

__Note: This option will be ignored if a `junction` is being created, as they must be absolute.__

Type: `Boolean`

Default: `false`

##### `options.useJunctions`

When creating a symlink, whether or not a directory symlink should be created as a `junction`.
This option is only relevant on Windows and ignored elsewhere. Please refer to the [Symbolic Links on Windows][symbolic-caveats] section below.

Type: `Boolean`

Default: `true`

#### Symbolic Links on Windows

When creating symbolic links on Windows, we pass a `type` argument to Node's
`fs` module which specifies the kind of target we link to (one of `'file'`,
`'dir'` or `'junction'`). Specifically, this will be `'file'` when the target
is a regular file, `'junction'` if the target is a directory, or `'dir'` if
the target is a directory and the user overrides the `useJunctions` option
default.

However, if the user tries to make a "dangling" link (pointing to a non-existent
target) we won't be able to determine automatically which type we should use.
In these cases, `vinyl-fs` will behave slightly differently depending on
whether the dangling link is being created via `symlink()` or via `dest()`.

For dangling links created via `symlink()`, the incoming vinyl represents the
target and so we will look to its stats to guess the desired type. In
particular, if `isDirectory()` returns false then we'll create a `'file'` type
link, otherwise we will create a `'junction'` or a `'dir'` type link depending
on the value of the `useJunctions` option.

For dangling links created via `dest()`, the incoming vinyl represents the link -
typically read off disk via `src()` with the `resolveSymlinks` option set to
false. In this case, we won't be able to make any reasonable guess as to the
type of link and we default to using `'file'`, which may cause unexpected behavior
if you are creating a "dangling" link to a directory. It is advised to avoid this
scenario.

## Acknowledgments

This package is forked from 
[the upstream source](https://github.com/gulpjs/vinyl-fs) with the same name. 
This fork is purely derivative and does not add functionality. Credit and 
gratitude are due for 
[the contributors to the source](https://github.com/gulpjs/vinyl-fs/graphs/contributors). 

[snyk-image]: https://snyk.io/test/github/electric-eloquence/vinyl-fs/v3-lts/badge.svg
[snyk-url]: https://snyk.io/test/github/electric-eloquence/vinyl-fs/v3-lts

[travis-image]: https://img.shields.io/travis/electric-eloquence/vinyl-fs/v3-lts.svg?label=mac%20%26%20linux
[travis-url]: https://travis-ci.org/electric-eloquence/vinyl-fs

[appveyor-image]: https://img.shields.io/appveyor/ci/e2tha-e/vinyl-fs/v3-lts.svg?label=windows
[appveyor-url]: https://ci.appveyor.com/project/e2tha-e/vinyl-fs

[coveralls-image]: https://coveralls.io/repos/github/electric-eloquence/vinyl-fs/badge.svg?branch=v3-lts
[coveralls-url]: https://coveralls.io/github/electric-eloquence/vinyl-fs?branch=v3-lts

[version-image]: https://img.shields.io/node/v/@electric-eloquence/vinyl-fs.svg

[license-image]: https://img.shields.io/github/license/electric-eloquence/vinyl-fs.svg
[license-url]: https://raw.githubusercontent.com/electric-eloquence/vinyl-fs/v3-lts/LICENSE

[symbolic-caveats]: #symbolic-links-on-windows
[glob-stream]: https://github.com/gulpjs/glob-stream
[node-glob]: https://github.com/isaacs/node-glob
[vinyl]: https://github.com/wearefractal/vinyl
