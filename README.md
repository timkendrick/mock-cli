# mock-cli
[![npm version](https://img.shields.io/npm/v/mock-cli.svg)](https://www.npmjs.com/package/mock-cli)
![Stability](https://img.shields.io/badge/stability-stable-brightgreen.svg)
[![Build Status](https://travis-ci.org/timkendrick/mock-cli.svg?branch=master)](https://travis-ci.org/timkendrick/mock-cli)

> CLI capture tool for testing command-line apps


## Overview

This tool allows you to simulate a separate command-line environment within the current process, automatically capturing any input/output for the simulated process. It works by temporarily faking `process.argv` and stdio (and optionally redirecting stdio), so your CLI app code has no idea it is actually being run in a test environment.

`process.exit()` and uncaught errors are handled gracefully, returning the process exit code and the captured stdio contents.


## Example

```javascript
var mockCli = require('mock-cli');
var assert = require('assert');

var argv = ['node', 'hello-world-app.js', '--foo', 'bar']; // Fake argv
var stdio = {
	stdin: require('./mocks/fakeInputStream'), // Hook up a fake input stream
	stdout: process.stdout, // Display the captured output in the main console
	stderr: process.stderr // Display the captured error output in the main console
};
var kill = mockCli(argv, stdio, function onProcessComplete(error, result) {
	var exitCode = result.code; // Process exit code
	var stdout = result.stdout; // UTF-8 string contents of process.stdout
	var stderr = result.stderr; // UTF-8 string contents of process.stderr

	assert.equal(exitCode, 0);
	assert.equal(stdout, 'Hello, world!\n');
	assert.equal(stderr, '');
});

// Execute the CLI task
require('./bin/hello-world-app');

// Kill the task if still running after one second
setTimeout(kill, 1000);
```


## Usage

### `mockCli(argv, stdio, exitCallback)`

Simulate a separate command-line environment within the current process

#### Arguments:

| Name | Type | Required | Default | Description |
| ---- | ---- | -------- | ------- | ----------- |
| `argv` | `Array` | No | `process.argv` | Fake `argv` for the simulated process |
| `stdio` | `object` | No | `null` | Object containing streams that are used to fake stdio |
| `stdio.stdin` | `Stream` | No | `null` | Input stream that is piped into the simulated process as `process.stdin` |
| `stdio.stdout` | `Stream` | No | `null` | Output stream that is connected to `process.stdout` of the simulated process |
| `stdio.stderr` | `Stream` | No | `null` | Error stream that is connected to `process.stderr` of the simulated process |
| `errorCallback` | `function` | No | `null` | Callback that is invoked once the simulated process completes or throws an uncaught exception |

- `errorCallback` has the following signature:

	##### `function(error, result)`

	###### Arguments:

	| Name | Type | Description |
	| ---- | ---- | ----------- |
	| `error` | `Error` | Uncaught exception thrown by the simulated process |
	| `result` | `object` | Object containing information about the simulated process |
	| `result.code` | `number` | Process exit code, or `1` on an uncaught exception |
	| `result.stdin` | `string` | UTF-8 contents of `process.stdin`, captured during simulation |
	| `result.stdout` | `string` | UTF-8 contents of `process.stdout`, captured during simulation |
	| `result.stderr` | `string` | UTF-8 contents of `process.stderr`, captured during simulation |


#### Returns:

`function` Function that kills the simulated process (as if the user pressed `Ctrl+C`).

- This function returns a `results` object, as seen in `exitCallback` arguments.
