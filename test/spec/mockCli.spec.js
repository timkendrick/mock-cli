'use strict';

var chai = require('chai');
var expect = chai.expect;
var util = require('util');
var Readable = require('stream').Readable;
var Writable = require('stream').Writable;

var mockCli = require('../../lib/mockCli');

describe('mockCli()', function() {
	var unmockCli;
	afterEach(function() {
		if (unmockCli) {
			unmockCli();
			unmockCli = null;
		}
	});

	function createReadableStream(input, callback) {
		input = input || null;

		function ReadableStream(options) {
			Readable.call(this, options);
		}

		util.inherits(ReadableStream, Readable);

		ReadableStream.prototype._read = function(size) {
			if (callback) { callback(input); }
			this.push(input);
			input = null;
		};

		return new ReadableStream();
	}

	function createWritableStream(callback) {

		function WritableStream(options) {
			Writable.call(this, options);
		}

		util.inherits(WritableStream, Writable);

		WritableStream.prototype._write = function(chunk, enc, done) {
			if (callback) { callback(chunk); }
		};

		return new WritableStream();
	}

	describe('basic operation', function() {

		it('should return a unmockCli function', function() {
			unmockCli = mockCli();

			var actual, expected;
			actual = unmockCli;
			expected = 'function';
			expect(actual).to.be.a(expected);
		});
	});

	describe('argv', function() {

		it('should mock process.argv', function() {
			var argv = ['node', 'script.js', '--foo', 'bar'];
			unmockCli = mockCli(argv);

			var actual, expected;
			actual = process.argv;
			expected = argv;
			expect(actual).to.eql(expected);
		});

		it('should default to host process.argv', function() {
			var originalArgv = process.argv;
			var argv = null;
			unmockCli = mockCli(argv);

			var actual, expected;
			actual = process.argv;
			expected = originalArgv;
			expect(actual).to.eql(expected);
		});

		it('should reset argv when terminate function is called', function() {
			var argv = process.argv;
			unmockCli = mockCli();

			unmockCli();

			var actual, expected;
			actual = process.argv;
			expected = argv;
			expect(actual).to.eql(expected);
		});
	});

	describe('process exit', function() {

		it('should mock process.exit', function() {
			var exit = process.exit;
			unmockCli = mockCli();

			var actual, expected;
			actual = process.exit;
			expected = exit;
			expect(actual).not.to.eql(expected);
		});

		it('should reset process.exit when terminate function is called', function() {
			var exit = process.exit;
			unmockCli = mockCli();

			unmockCli();

			var actual, expected;
			actual = process.exit;
			expected = exit;
			expect(actual).to.eql(expected);
		});

		it('should return exit results when terminate function is called', function() {
			unmockCli = mockCli();

			var results = unmockCli();

			var actual, expected;
			actual = results;
			expected = {
				code: 130,
				stdin: '',
				stdout: '',
				stderr: ''
			};
			expect(actual).to.eql(expected);
		});
	});

	it('should call exit callback on process.exit(code)', function(done) {
		var argv = null;
		var stdio = null;
		unmockCli = mockCli(argv, stdio, function(error, results) {
			expect(error).not.to.exist;
			expect(results).to.exist;

			var actual, expected;
			actual = results;
			expected = {
				code: 123,
				stdin: '',
				stdout: '',
				stderr: ''
			};
			expect(actual).to.eql(expected);

			done();
		});

		process.exit(123);
	});

	it('should call exit callback on process.exit()', function(done) {
		unmockCli = mockCli(null, null, function(error, results) {
			expect(error).not.to.exist;
			expect(results).to.exist;

			var actual, expected;
			actual = results;
			expected = {
				code: 0,
				stdin: '',
				stdout: '',
				stderr: ''
			};
			expect(actual).to.eql(expected);

			done();
		});

		process.exit();
	});

	describe('stdio', function() {

		it('should suppress host stdio', function(done) {
			process.stdin.push('Hello, world!', 'utf8');

			var stdin = '';
			unmockCli = mockCli();

			process.stdin.setEncoding('utf8');
			process.stdin.on('readable', function() {
				var chunk = process.stdin.read();
				if (chunk !== null) { stdin += chunk; }
			});

			process.stdin.on('end', function() {

				unmockCli();

				var actual, expected;
				actual = stdin;
				expected = '';
				expect(actual).to.equal(expected);

				process.stdin.on('readable', function() {
					var chunk = process.stdin.read();
					if (chunk !== null) { stdin += chunk; }

					actual = stdin;
					expected = 'Hello, world!';
					expect(actual).to.equal(expected);

					done();
				});
			});
		});

		it('should suppress host stdout', function() {
			var stdout = '';
			var write = process.stdout.write;
			process.stdout.write = function(chunk, enc, done) {
				stdout += (typeof chunk === 'string' ? chunk : chunk.toString());
			};

			try {
				unmockCli = mockCli();

				console.log('Hello, simulated world!');

				unmockCli();

				var actual, expected;
				actual = stdout;
				expected = '';
				expect(actual).to.equal(expected);

				console.log('Hello, real world!');

				actual = stdout;
				expected = 'Hello, real world!\n';
				expect(actual).to.equal(expected);

			} catch (error) {
				throw error;
			} finally {
				process.stdout.write = write;
			}
		});

		it('should suppress host stderr', function() {
			var stderr = '';
			var write = process.stderr.write;
			process.stderr.write = function(chunk, enc, done) {
				stderr += (typeof chunk === 'string' ? chunk : chunk.toString());
			};

			try {
				unmockCli = mockCli();

				console.error('Hello, simulated world!');

				unmockCli();

				var actual, expected;
				actual = stderr;
				expected = '';
				expect(actual).to.equal(expected);

				console.error('Hello, real world!');

				actual = stderr;
				expected = 'Hello, real world!\n';
				expect(actual).to.equal(expected);

			} catch (error) {
				throw error;
			} finally {
				process.stderr.write = write;
			}
		});

		it('should pipe from custom stdin if specified', function(done) {
			var argv = null;
			var stdio = {
				stdin: createReadableStream('Hello, world!')
			};
			var log = '';

			unmockCli = mockCli(argv, stdio);

			process.stdin.on('readable', function() {
				var chunk = process.stdin.read();
				if (chunk !== null) { log += chunk; }
			});

			process.stdin.on('end', function() {
				unmockCli();

				var actual, expected;
				actual = log;
				expected = 'Hello, world!';
				expect(actual).to.equal(expected);

				done();
			});
		});

		it('should pipe to custom stdout if specified', function() {
			var log = '';
			var stdout = createWritableStream(function(chunk, enc, done) {
				log += chunk;
			});

			var argv = null;
			var stdio = {
				stdout: stdout
			};

			unmockCli = mockCli(argv, stdio);

			console.log('Hello, world!');

			unmockCli();

			var actual, expected;
			actual = log;
			expected = 'Hello, world!\n';
			expect(actual).to.equal(expected);
		});

		it('should pipe to custom stderr if specified', function() {
			var log = '';
			var stderr = createWritableStream(function(chunk, enc, done) {
				log += chunk;
			});

			var argv = null;
			var stdio = {
				stderr: stderr
			};

			unmockCli = mockCli(argv, stdio);

			console.error('Hello, world!');

			unmockCli();

			var actual, expected;
			actual = log;
			expected = 'Hello, world!\n';
			expect(actual).to.equal(expected);
		});

		it('should return stdio when terminate function is called', function(done) {

			unmockCli = mockCli();

			process.stdin.push('Hello, stdin!\n', 'utf8');
			console.log('Hello, stdout!');
			console.error('Hello, stderr!');

			process.stdin.on('readable', function() {
				process.stdin.read();
			});

			process.stdin.on('end', function() {
				var results = unmockCli();

				var actual, expected;
				actual = results;
				expected = {
					code: 130,
					stdin: 'Hello, stdin!\n',
					stdout: 'Hello, stdout!\n',
					stderr: 'Hello, stderr!\n'
				};
				expect(actual).to.eql(expected);

				done();
			});
		});

		it('should return stdio on process.exit()', function(done) {
			var argv = null;
			var stdio = null;
			unmockCli = mockCli(argv, stdio, function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.exist;

				var actual, expected;
				actual = results;
				expected = {
					code: 0,
					stdin: 'Hello, stdin!\n',
					stdout: 'Hello, stdout!\n',
					stderr: 'Hello, stderr!\n'
				};
				expect(actual).to.eql(expected);

				done();
			});

			process.stdin.push('Hello, stdin!\n', 'utf8');
			console.log('Hello, stdout!');
			console.error('Hello, stderr!');

			process.stdin.on('readable', function() {
				process.stdin.read();
			});

			process.stdin.on('end', function() {
				process.exit();
			});
		});

		it('should return stdio on process.exit(code)', function(done) {
			var argv = null;
			var stdio = null;
			unmockCli = mockCli(argv, stdio, function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.exist;

				var actual, expected;
				actual = results;
				expected = {
					code: 123,
					stdin: 'Hello, stdin!\n',
					stdout: 'Hello, stdout!\n',
					stderr: 'Hello, stderr!\n'
				};
				expect(actual).to.eql(expected);

				done();
			});

			process.stdin.push('Hello, stdin!\n', 'utf8');
			console.log('Hello, stdout!');
			console.error('Hello, stderr!');

			process.stdin.on('readable', function() {
				process.stdin.read();
			});

			process.stdin.on('end', function() {
				process.exit(123);
			});
		});

		it('should display start/end markers if outputting stdin to console', function() {
			var stdout = '';
			var write = process.stdout.write;
			process.stdout.write = function(chunk, enc, done) {
				stdout += (typeof chunk === 'string' ? chunk : chunk.toString());
			};

			try {
				var argv = null;
				var stdio = {
					stdout: process.stdout
				};
				unmockCli = mockCli(argv, stdio);

				console.log('Hello, world!');

				unmockCli();

				var lines = stdout.split('\n');
				expect(lines.length).to.equal(4);
				expect(lines[0]).to.have.string('Start');
				expect(lines[1]).to.equal('Hello, world!');
				expect(lines[2]).to.have.string('End');
				expect(lines[3]).to.equal('');

			} catch (error) {
				throw error;
			} finally {
				process.stdout.write = write;
			}
		});
	});

	describe('optional arguments', function() {

		it('should allow stdio as first argument', function(done) {
			var stdin = '';
			var stdout = '';
			var stderr = '';

			var stdio = {
				stdin: createReadableStream('Hello, stdin!\n', function(chunk) {
					if (chunk !== null) { stdin += chunk; }
				}),
				stdout: createWritableStream(function(chunk, enc, done) {
					stdout += chunk;
				}),
				stderr: createWritableStream(function(chunk, enc, done) {
					stderr += chunk;
				})
			};
			unmockCli = mockCli(stdio);

			console.log('Hello, stdout!');
			console.error('Hello, stderr!');

			process.stdin.on('readable', function() {
				process.stdin.read();
			});

			process.stdin.on('end', function() {
				unmockCli();

				var actual, expected;
				actual = {
					stdin: stdin,
					stdout: stdout,
					stderr: stderr
				};
				expected = {
					stdin: 'Hello, stdin!\n',
					stdout: 'Hello, stdout!\n',
					stderr: 'Hello, stderr!\n'
				};
				expect(actual).to.eql(expected);

				done();
			});
		});

		it('should allow exit callback as first argument', function(done) {
			unmockCli = mockCli(function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.exist;

				done();
			});

			process.exit();
		});

		it('should allow exit callback as second argument, null as first', function(done) {
			unmockCli = mockCli(null, function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.exist;

				done();
			});

			process.exit();
		});

		it('should allow exit callback as second argument, argv as first', function(done) {
			var argv = ['node', 'script.js', '--foo', 'bar'];
			unmockCli = mockCli(argv, function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.exist;

				done();
			});

			var actual, expected;
			actual = process.argv;
			expected = argv;
			expect(actual).to.eql(expected);

			process.exit();
		});

		it('should allow exit callback as second argument, stdio as first', function(done) {
			var stdin = '';
			var stdout = '';
			var stderr = '';

			var stdio = {
				stdin: createReadableStream('Hello, stdin!\n', function(chunk) {
					if (chunk !== null) { stdin += chunk; }
				}),
				stdout: createWritableStream(function(chunk, enc, done) {
					stdout += chunk;
				}),
				stderr: createWritableStream(function(chunk, enc, done) {
					stderr += chunk;
				})
			};
			unmockCli = mockCli(stdio, function(error, results) {
				expect(error).not.to.exist;
				expect(results).to.exist;

				var actual, expected;
				actual = {
					stdin: stdin,
					stdout: stdout,
					stderr: stderr
				};
				expected = {
					stdin: 'Hello, stdin!\n',
					stdout: 'Hello, stdout!\n',
					stderr: 'Hello, stderr!\n'
				};
				expect(actual).to.eql(expected);

				done();
			});

			console.log('Hello, stdout!');
			console.error('Hello, stderr!');

			process.stdin.on('readable', function() {
				process.stdin.read();
			});

			process.stdin.on('end', function() {
				process.exit();
			});
		});
	});
});
