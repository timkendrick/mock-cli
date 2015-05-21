'use strict';

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

	var unwatchStdin = captureStream(process.stdin, stdio.stdin, onStdin);
	var unwatchStdout = captureStream(process.stdout, stdio.stdout, onStdout);
	var unwatchStderr = captureStream(process.stderr, stdio.stderr, onStderr);

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
		stdin += data;
	}

	function onStdout(data) {
		stdout += data;
	}

	function onStderr(data) {
		stderr += data;
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

	function captureStream(inputStream, outputStream, callback) {
		var write = inputStream.write;

		inputStream.write = function(chunk, encoding, cb) {
			if (outputStream === inputStream) {
				write.call(outputStream, chunk, encoding, cb);
			} else if (outputStream) {
				outputStream.write(chunk, encoding, cb);
			}
			callback(chunk);
		};

		return function uncapture() {
			inputStream.write = write;
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
