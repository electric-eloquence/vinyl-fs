'use strict';

var path = require('path');

// Input/output relative paths
var inputRelative = 'fixtures';
var outputRelative = 'out-fixtures';
// Input/Output base directories
var inputBase = path.join(__dirname, '..', inputRelative);
var outputBase = path.join(__dirname, '..', outputRelative);
// Paths that don't exist
var neInputBase = path.join(inputBase, 'not-exists');
var neInputPath = path.join(neInputBase, 'foo');
var neOutputBase = path.join(outputBase, 'not-exists');
var neOutputPath = path.join(neOutputBase, 'foo');

module.exports = {
  inputRelative: inputRelative,
  outputRelative: outputRelative,
  inputBase: inputBase,
  outputBase: outputBase,
  neInputBase: neInputBase,
  neInputPath: neInputPath,
  neOutputBase: neOutputBase,
  neOutputPath: neOutputPath,
};
