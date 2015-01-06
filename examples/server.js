var http = require('http');
var Duplex = require('stream').Duplex;
var browserChannel = require('browserchannel').server;
var express = require('express');
var livedb = require('livedb');
var sharejs = require('share');
var shareCodeMirror = require('..');

var backend = livedb.client(livedb.memory());
var share = sharejs.server.createClient({backend: backend});
var clientsById = {};

var app = express();
app.use(express.static(__dirname));
app.use(express.static(shareCodeMirror.scriptsDir));
app.use(express.static(__dirname + '/../node_modules/codemirror/lib'));
app.use(express.static(__dirname + '/../node_modules/tinycolor2/dist'));
app.use(express.static(__dirname + '/../node_modules/lodash/dist'));
app.use(express.static(sharejs.scriptsDir));
app.use(browserChannel(function (client) {
  clientsById[client.id] = client;
  console.log('CLIENT')

  var stream = new Duplex({objectMode: true});
  stream._write = function (chunk, encoding, callback) {
    if (client.state !== 'closed') {
      client.send(chunk);
    }
    callback();
  };
  stream._read = function () {
  };
  stream.headers = client.headers;
  stream.remoteAddress = stream.address;
  client.on('message', function (data) {
    stream.push(data);
  });
  stream.on('error', function (msg) {
    console.log('ERROR', msg, client.id);
    client.stop();
  });
  client.on('close', function (reason) {
    console.log('CLOSE', reason, client.id);
    stream.emit('close');
    stream.emit('end');
    stream.end();
    delete clientsById[client.id];
  });
  return share.listen(stream);
}));

var server = http.createServer(app);
server.listen(7007, function (err) {
  if (err) throw err;

  console.log('Listening on http://%s:%s', server.address().address, server.address().port);
});
