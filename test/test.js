'use strict';

var archiveType = require('archive-type');
var Download = require('../');
var nock = require('nock');
var path = require('path');
var fixture = path.join.bind(path, __dirname, 'fixtures');
var tar = require('gulp-tar');
var test = require('ava');

test('expose a constructor', function (t) {
	t.plan(1);
	t.assert(typeof Download === 'function');
});

test('add a plugin to the middleware stack', function (t) {
	t.plan(1);

	var download = new Download()
		.use(function () {});

	t.assert(download.ware.fns.length === 1);
});

test('set a file to get', function (t) {
	t.plan(1);

	var download = new Download()
		.get('http://example.com/test.jpg');

	t.assert(download._get[0] === 'http://example.com/test.jpg');
});

test('download a file', function (t) {
	t.plan(5);

	var download = new Download()
		.get('http://foo.com/test-file.zip');

	var scope = nock('http://foo.com')
		.get('/test-file.zip')
		.replyWithFile(200, fixture('test-file.zip'));

	download.run(function (err, files) {
		t.assert(!err, err);
		t.assert(scope.isDone());
		t.assert(files[0].path === 'test-file.zip');
		t.assert(files[0].url === 'http://foo.com/test-file.zip');
		t.assert(archiveType(files[0].contents) === 'zip');
	});
});

test('download a file and rename it', function (t) {
	t.plan(5);

	var download = new Download()
		.get('http://foo.com/test-file.zip')
		.rename('foobar.zip');

	var scope = nock('http://foo.com')
		.get('/test-file.zip')
		.replyWithFile(200, fixture('test-file.zip'));

	download.run(function (err, files) {
		t.assert(!err, err);
		t.assert(scope.isDone());
		t.assert(path.basename(files[0].path) === 'foobar.zip');
		t.assert(archiveType(files[0].contents) === 'zip');
		t.assert(files[0].url === 'http://foo.com/test-file.zip');
	});
});

test('download and extract a file', function (t) {
	t.plan(3);

	var download = new Download({ extract: true })
		.get('http://foo.com/test-file.zip');

	var scope = nock('http://foo.com')
		.get('/test-file.zip')
		.replyWithFile(200, fixture('test-file.zip'));

	download.run(function (err, files) {
		t.assert(!err, err);
		t.assert(scope.isDone());
		t.assert(files[0].path === 'file.txt');
	});
});

test('download and perform task on it', function (t) {
	t.plan(3);

	var download = new Download()
		.get('http://foo.com/test-file.zip')
		.pipe(tar('file.tar'));

	var scope = nock('http://foo.com')
		.get('/test-file.zip')
		.replyWithFile(200, fixture('test-file.zip'));

	download.run(function (err, files) {
		t.assert(!err, err);
		t.assert(scope.isDone());
		t.assert(path.basename(files[0].path) === 'file.tar');
	});
});

test('expose the response stream', function (t) {
	t.plan(3);

	var download = new Download()
		.get('http://foo.com/test-file.zip')
		.use(function (res) {
			res.on('data', function (data) {
				t.assert(data);
			});
		});

	var scope = nock('http://foo.com')
		.get('/test-file.zip')
		.replyWithFile(200, fixture('test-file.zip'));

	download.run(function (err) {
		t.assert(!err, err);
		t.assert(scope.isDone());
	});
});

test('proxy google.com', function (t) {
	t.plan(3);

	var server = require('./fixtures/test-server');
	var srv = server();
	var download = new Download({
		headers: { 'proxy-authorization': 'Foo Bar' },
		proxy: 'http://localhost:9001'
	});

	srv.listen(9001, function () {
		srv.on('http://google.com/', function (req, res) {
			t.assert(req.headers.host === 'google.com');
			t.assert(req.headers['proxy-authorization'] === 'Foo Bar');
			res.end();
		});
	});

	download.get('http://google.com/');
	download.run(function (err) {
		t.assert(!err, err);
		srv.close();
	});
});

test('error on 404', function (t) {
	t.plan(3);

	var download = new Download()
		.get('http://foo.com/error');
	var scope = nock('http://foo.com')
		.get('/error')
		.reply(404);

	download.run(function (err) {
		t.assert(err.message === 'Couldn\'t connect to http://foo.com/error (404)');
		t.assert(err.code === 404);
		t.assert(scope.isDone());
	});
});
