/*jshint node: true */

'use strict';

var errors = [],
    warnings = [];

if (process.argv.length !== 3) {
  errors.push('Missing argument for worker id.');
}

if (process.env.REDIS_PORT === undefined) {
  warnings.push('Environment variable REDIS_PORT missing');
}

if (process.env.REDIS_HOST === undefined) {
  warnings.push('Environment variable REDIS_HOST missing');
}


if (warnings.length > 0) {
  for (var i = warnings.length - 1; i >= 0; i--) {
    console.warn('Warning: ' + warnings[i]);
  }
}

if (errors.length > 0) {
  for (var i = errors.length - 1; i >= 0; i--) {
    console.error('Error: ' + errors[i]);
  }
  process.exit(1);
}

var eventEmitter = require('events').EventEmitter,
    ee = new eventEmitter,
    redis = require("redis"),
    work_queue = 'work',
    error_queue = 'error',
    skipped_queue = 'skipped',
    os = require('os'),
    processing_queue = os.hostname() + '-' + process.argv[2] + '-queue',
    exiting = false,
    canExit = true;

process.on('SIGINT', function() {
  if (exiting || canExit) process.exit(0); // If pressed twice.
  console.log('Received SIGINT.  Please wait until the current task is finished.');
  exiting = true;
});

ee.on('task_found', processTask);
ee.on('task_processed', removeTask);
ee.on('task_finished', nextTask);
ee.on('task_skipped', pushTask);
ee.addListener('task_handle', require('./handlers/handleFakeTasks.js'));


var client = process.env.REDIS_PORT && process.env.REDIS_HOST ?
    redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST) :
    redis.createClient();


console.log('Starting worker ' + processing_queue);
nextTask(); // Start


function nextTask () {
  client.lrange (processing_queue, 0, 0, function (err, tasks) {
    if ( tasks.length > 0 ) {
      canExit = false;
      console.log('Resumed task: ' + tasks[0]);
      ee.emit('task_found', tasks[0]);
    } else if (exiting) {
      console.log('Exiting.')
      process.exit(0);
    } else {
      console.log('Wating for new task on ' + work_queue);
      canExit = true;
      client.brpoplpush (work_queue, processing_queue, 0, function (err, task) {
        canExit = false;
        if (task) { // In case timeout is set to a value
          console.log('Picked task: ' + task);
          ee.emit('task_found', task);
        }
      });
    }
  });
};


function processTask (task) {
  console.log('Processing task: ' + task);
  var task_handle_event = 'task_handle1';
  var activeListeners = eventEmitter.listenerCount(ee, task_handle_event);

  if (activeListeners > 0) {
    var completedListeners = 0;

    ee.emit(task_handle_event, task, function () {
      ++completedListeners;
      if (completedListeners === activeListeners) {
        ee.emit('task_processed', task);
      }
    });
  } else {
    ee.emit('task_skipped', task);
  }
}

function pushTask (task) {
  client.lpush (skipped_queue, task, function (err, result) {
    if (err) {
      throw new Error('Error when LREM from processing_queue ' + processing_queue + ': ' + err);
    } else {
      console.log('Skipped task: ' + task);
      ee.emit('task_processed', task);
    }
  });
}

function handleError (task) {
  // Not implementet
}

function removeTask (task) {
  client.lrem (processing_queue, -1, task, function (err, result) {
    if (err) {
      throw new Error('Error when LREM from processing_queue ' + processing_queue + ': ' + err);
    } else {
      console.log('Finished task: ' + task);
      ee.emit('task_finished');
    }
  });
}
