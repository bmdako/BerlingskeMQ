if (process.argv.length !== 3) {
  console.log('Missing argument for worker id.')
  process.exit(1);
}

var eventEmitter = require('events').EventEmitter,
    ee = new eventEmitter,
    redis = require("redis"),
    client = redis.createClient(),
    //redis.createClient(port, host, options)
    work_queue = 'work',
    os = require('os'),
    workerid = processing_queue = os.hostname() + '-' + process.argv[2],
    timeout = 0;

console.log('Starting worker ' + processing_queue);

var currentTask;
ee.on('queue_finished', nextTask);
ee.on('task_found', processTask);
ee.on('task_finished', removeTask);
ee.on('task_removed', nextTask);
nextTask();


function nextTask () {
  console.log('Getting next task');
  client.lrange(processing_queue, 0, 0, function (err, tasks) {
    if ( tasks.length > 0 ) {
      currentTask = tasks[0];
      console.log('Resumed task: ' + currentTask);
      ee.emit('task_found');
    } else {
      console.log('Wating for new task on ' + work_queue);
      client.brpoplpush (work_queue, processing_queue, timeout, function (err, task) {
        if (task) { // In case timeout is set to a value
          currentTask = task;
          console.log('Found task: ' + currentTask);
          ee.emit('task_found');
        }
      });
    }
  });
};

function processTask () {
  console.log('Processing task: ' + currentTask);
  var random = randomIntFromInterval(1, 30);
  if (random === 1) {
    console.log('FAKE SHUTDOWN when processing random ' + random);
    process.exit(1);
  }
  setTimeout(function() {
    console.log('Processed task: ' + currentTask);
    ee.emit('task_finished');
  }, randomIntFromInterval(1000, 6000));
}

function removeTask () {
  console.log('Removing task: ' + currentTask);
  client.lrem (processing_queue, -1, currentTask, function (err, result) {
    if (err || result !== 1) {
      throw new Error('Error when LREM from processing_queue ' + processing_queue);
    } else {
      currentTask = null;
      ee.emit('task_removed');
    }
  });
}

function randomIntFromInterval (min, max) {
    return Math.floor( Math.random() * (max - min + 1) + min);
}