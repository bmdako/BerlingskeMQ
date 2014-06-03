var eventEmitter = require('events').EventEmitter,
    ee = new eventEmitter,
    redis = require("redis"),
    client = redis.createClient(),
    //redis.createClient(port, host, options)
    work_queue = 'work';

ee.on('task_pushed', pushNextTask);

var pushedTasks = 0;
var tasks = generateTasks(100);
pushNextTask();

function generateTasks (amount) {
  var tasks = [];
  for (var i = 1; i <= amount; i++) {
    tasks.push('task ' + i);
  };
  return tasks;
}

function pushNextTask () {
  if(tasks.length === pushedTasks) process.exit(0);
  pushTask(tasks[pushedTasks]);
  ++pushedTasks;
}

function pushTask (task) {
  client.lpush (work_queue, task, function (err, result) {
    if (err) {
      console.log('Error: ' + err);
    }
    console.log('Pushed ' + task);
    ee.emit('task_pushed');
  });
}
