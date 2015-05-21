'use strict';

var util = require('util');
var Readable = require('stream').Readable;
var chalk = require('chalk');

var isMockCliActive = false;

module.exports = function(argv, stdio, exitCallback) {
	if ((arguments.length === 2) && (typeof stdio === 'function')) {
		exitCallback = stdio;
		stdio = undefined;
		if ((typeof argv === 'object') && !Array.isArray(argv)) {
			stdio = argv;
			argv = undefined;
		}
	} else if ((arguments.length === 1) && (typeof argv === 'function')) {
		exitCallback = argv;
		argv = undefined;
		stdio = undefined;
	} else if ((arguments.length === 1) && (typeof argv === 'object') && !Array.isArray(argv)) {
		stdio = argv;
		argv = undefined;
	}
	argv = argv || process.argv;
	stdio = stdio || {};

	if (isMockCliActive) { throw new Error('Mock CLI already active'); }
	var isActive = true;

	var processArgv = process.argv;
	var processExit = process.exit;

	var isOutputtingToConsole = stdio.stdout === process.stdout;

	if (isOutputtingToConsole) {
		writeBannerMessage('Start of CLI capture', process.stdout, ' ▼ ', ' ▼ ');
	}

	var stdin = '';
	var stdout = '';
	var stderr = '';

	var unwatchStdin = captureStdin(stdio.stdin, onStdin);
	var unwatchStdout = captureOutputStream(process.stdout, stdio.stdout, onStdout);
	var unwatchStderr = captureOutputStream(process.stderr, stdio.stderr, onStderr);

	process.argv = argv;

	process.on('beforeExit', onBeforeExit);
	process.on('uncaughtException', onUncaughtException);

	process.exit = function(code) {
		exit(null, code || 0);
	};

	isMockCliActive = true;

	return function restore() {
		cleanup();
		return {
			code: 130,
			stdin: stdin,
			stdout: stdout,
			stderr: stderr
		};
	};


	function onStdin(data) {
		if (data !== null) {
			stdin += data;
		}
	}

	function onStdout(data) {
		if (data !== null) {
			stdout += data;
		}
	}

	function onStderr(data) {
		if (data !== null) {
			stderr += data;
		}
	}

	function onBeforeExit() {
		exit(null, 0);
	}

	function onUncaughtException(error) {
		exit(error);
	}

	function exit(error, code) {
		error = error || null;
		if (error) { code = code || 1; }

		cleanup();

		if (exitCallback) {

			var output = {
				code: code,
				stdin: stdin,
				stdout: stdout,
				stderr: stderr
			};

			exitCallback(error, output);
		}
	}

	function cleanup() {
		if (!isActive) { return; }
		isActive = false;
		process.removeListener('beforeExit', onBeforeExit);
		process.removeListener('uncaughtException', onUncaughtException);
		unwatchStdin();
		unwatchStdout();
		unwatchStderr();
		process.argv = processArgv;
		process.exit = processExit;
		if (isOutputtingToConsole) {
			writeBannerMessage('End of CLI capture', process.stdout, ' ▲ ', ' ▲ ');
		}
		isMockCliActive = false;
	}

	function captureStdin(sourceStream, callback) {
		var mockStdIn = createCaptureStream(sourceStream);
		var unmockProcessStdin = mockProcessStdin(mockStdIn);

		return function uncapture() {
			unmockProcessStdin();
		};


		function createCaptureStream(sourceStream) {
			var stream = createReadableStream();
			var read = stream.read;

			if (sourceStream) {
				relayReadableStreamEvents(sourceStream, stream);
			}

			stream.read = function(size) {
				var chunk;
				if (sourceStream && (sourceStream !== stream)) {
					chunk = sourceStream.read(size);
				} else {
					chunk = read.call(stream, size);
				}
				callback(chunk);
				return chunk;
			};

			return stream;


			function createReadableStream() {
				function ReadableStream() {
					Readable.call(this);
				}

				util.inherits(ReadableStream, Readable);

				ReadableStream.prototype._read = function(size) {
					this.push(null);
				};

				return new ReadableStream();
			}

			function relayReadableStreamEvents(sourceStream, destinationStream) {
				// Relay events from one readable stream to another,
				// without causing backpressure on the source stream
				var pipedEvents = [
					'close',
					'end',
					'error',
					'readable'
				];
				pipedEvents.forEach(function(eventName) {
					sourceStream.on(eventName, function() {
						destinationStream.emit.apply(
							destinationStream,
							[eventName].concat(arguments)
						);
					});
				});
			}
		}

		function mockProcessStdin(stream) {
			var stdin = process.stdin;

			Object.defineProperty(process, 'stdin', {
				value: stream,
				configurable: true,
				writable: false
			});

			return function reset() {
				Object.defineProperty(process, 'stdin', {
					value: stdin,
					configurable: true,
					writable: false
				});
			};
		}
	}

	function captureOutputStream(sourceStream, destinationStream, callback) {
		var write = sourceStream.write;

		sourceStream.write = function(chunk, encoding, cb) {
			callback(chunk);
			if (destinationStream === sourceStream) {
				write.call(sourceStream, chunk, encoding, cb);
			} else if (destinationStream) {
				destinationStream.write(chunk, encoding, cb);
			}
		};

		return function uncapture() {
			sourceStream.write = write;
		};
	}

	function writeBannerMessage(message, outputStream, leftDecoration, rightDecoration) {
		leftDecoration = leftDecoration || '';
		rightDecoration = rightDecoration || '';
		var outputStreamWidth = outputStream.columns - leftDecoration.length - rightDecoration.length;
		var messageLength = message.length;
		var paddingLeft = Math.max(0, Math.floor((outputStreamWidth - messageLength) / 2));
		var paddingRight = Math.max(0, Math.ceil((outputStreamWidth - messageLength) / 2));
		var string = leftDecoration + repeatChar(' ', paddingLeft) + message + repeatChar(' ', paddingRight) + rightDecoration;
		outputStream.write(chalk.inverse(string) + '\n');
	}


	function repeatChar(char, count) {
		var string = '';
		while (string.length < count) {
			string += char;
		}
		return string;
	}
};
