var http = require('http');
var client;

module.exports = function (eventEmitter, redis_client) {
  client = redis_client;
  eventEmitter.addListener('update', callWebhooks);
}

function callWebhooks (task, done) {
  console.log('Finding webhooks for ' + task);
  var args = task.split(':');

  client.SMEMBERS (args[1] + ':webhooks', function (err, webhooks) {
    var calledWebhooksCount = 0;
    for (var i = webhooks.length - 1; i >= 0; i--) {
      getWebhook(webhooks[i], function (webhook) {
        var article = null; // TODO
        var body = article ? JSON.stringify(article) : '';
        sendRequest(webhook, body);

        ++calledWebhooksCount;
        if (calledWebhooksCount === webhooks.length) {
          done();
        }
      });
    };
  });
}

function getWebhook (webhookName, callback) {
  client.HGETALL(webhookName, function (err, webhook) {
    callback(webhook);
  });
}

function sendRequest (webhook, body) {

  var options = {
    hostname: webhook.hostname,
    port: webhook.port && webhook.port !== 'null' ? webhook.port : 80, // Using url.parse() return 'null' as a string when no value
    path: webhook.path,
    method: 'POST',
    headers: {
      'Content-Length': Buffer.byteLength(body, 'utf8')
    }
  };

  // We simply fire off the request and don't wait for a response.
  var req = http.request(options);

  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
    //callback(e, null);
  });

  req.write(body);
  req.end();
}