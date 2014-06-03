/*jshint node: true */

'use strict';

var errors = [],
    warnings = [];

if (process.argv.length !== 3) {
  errors.push(new Error('Missing argument for worker id.'));
}

if (process.env.REDIS_PORT === undefined) {
  warnings.push('Environment variable REDIS_PORT missing');
}

if (process.env.REDIS_HOST === undefined) {
  warnings.push('Environment variable REDIS_HOST missing');
}


if (warnings.length > 0) {
  console.log('\Warnings:');
  for (var i = warnings.length - 1; i >= 0; i--) {
    console.log('  ' + warnings[i]);
  }
}

if (errors.length > 0) {
  console.log('\nErrors:');
  for (var i = errors.length - 1; i >= 0; i--) {
    console.log('  ' + errors[i]);
  }
  process.exit(1);
}

var eventEmitter = require('events').EventEmitter,
    ee = new eventEmitter,
    redis = require("redis"),
    work_queue = 'work',
    os = require('os'),
    processing_queue = os.hostname() + '-' + process.argv[2],
    currentTask = null,
    terminate = false;

process.on('SIGINT', function() {
  if (terminate) process.exit(0); // If pressed twice.
  console.log('Got SIGINT.  Please wait while the current task finished.');
  terminate = true;
});

ee.on('task_found', processTask);
ee.on('task_processed', removeTask);
ee.on('task_finished', nextTask);


var client = process.env.REDIS_PORT && process.env.REDIS_HOST ?
    redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST) :
    redis.createClient();


console.log('Starting worker ' + processing_queue);
nextTask(); // Start


function nextTask () {
  client.lrange (processing_queue, 0, 0, function (err, tasks) {
    if ( tasks.length > 0 ) {
      currentTask = tasks[0];
      console.log('Resumed task: ' + currentTask);
      ee.emit('task_found');
    } else if (terminate) {
      console.log('Exiting.')
      process.exit(0);
    } else {
      console.log('Wating for new task on ' + work_queue);
      client.brpoplpush (work_queue, processing_queue, 0, function (err, task) {
        if (task) { // In case timeout is set to a value
          currentTask = task;
          console.log('Picked task: ' + currentTask);
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
    ee.emit('task_processed');
  }, randomIntFromInterval(1000, 6000));
}

function removeTask () {
  client.lrem (processing_queue, -1, currentTask, function (err, result) {
    if (err || result !== 1) {
      throw new Error('Error when LREM from processing_queue ' + processing_queue);
    } else {
      console.log('Finished task: ' + currentTask);
      currentTask = null;
      ee.emit('task_finished');
    }
  });
}

function randomIntFromInterval (min, max) {
    return Math.floor( Math.random() * (max - min + 1) + min);
}