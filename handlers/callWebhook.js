var http = require('http');

module.exports = function (eventEmitter) {
  eventEmitter.addListener('webhook', callWebhook);
}

function callWebhook (task, done) {

  var options = {
    hostname: 'requestb.in',
    port: 80,
    path: '/vkjnfavk',
    method: 'POST',
    headers: {
      'Content-Length': 0
    }
  };

  var req = http.request(options, function(res) {
    console.log('STATUS: ' + res.statusCode);
    console.log('HEADERS: ' + JSON.stringify(res.headers));
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      console.log('BODY: ' + chunk);
    });
    res.on('end', function () {
      done();
    });
  });

  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
    done();
  });

  // write data to request body
  req.write('data\n');
  req.write('data\n');
  req.end();
}