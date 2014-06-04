var eventEmitter = require('events').EventEmitter,
    ee = new eventEmitter,
    redis = require("redis"),
    url = require('url'),
    client = redis.createClient(),
    //redis.createClient(port, host, options)
    work_queue = 'work';

ee.on('task_pushed', pushNextTask);

var pushedTasks = 0;
var tasks = generateFakeTasks(100);
//pushNextTask();

setupWebhook('breaking', 'postbin', 'http://requestb.in/vkjnfavk');

function generateFakeTasks (amount) {
  var tasks = [];
  for (var i = 1; i <= amount; i++) {
    tasks.push('faketask: task ' + i);
  };
  return tasks;
}

function pushNextTask () {
  if(tasks.length === pushedTasks) process.exit(0);
  pushTask(tasks[pushedTasks]);
  ++pushedTasks;
}

// Example on how to add a new task. This code must be moved to Broadway
function pushTask (task) {
  client.LPUSH (work_queue, task, function (err, result) {
    if (err) {
      console.log('Error: ' + err);
    }
    console.log('Pushed ' + task);
    ee.emit('task_pushed');
  });
}

// Example on how to set up the webhook. This code must be moved to Broadway
function setupWebhook (event, system, href) {
  var webhookFields = url.parse(href);
  var webhookName = 'webhook:' + system;
  client.HMSET (webhookName, webhookFields, function (err, result) {
    client.SADD (event + ':webhooks', webhookName, function (err, result) {
      process.exit(0);
    });
  });
}
