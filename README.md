BerlingskeMQ
============

A simple message queue implemented in Node using Redis.

A producer inserts a message into a list called e.g. "work" using LPUSH. This producer could be our other Node.js API application.

```sh
redis> LPUSH work "task 1"
(integer) 1
redis> LPUSH work "task 2"
(integer) 2
redis> LPUSH work "task 3"
(integer) 3
redis> LRANGE work 0 -1
1) "task 3"
2) "task 2"
3) "task 1"
```

The `producer.js` is a sample script that generates 100 tasks and pushed them into the list.

To process the messages in the queue, we start a worker by calling `node worker.js worker1`
Note: The third command argument is the id of the worker.

The worker polls the work queue by executing the blocking command `BRPOPLPUSH`.
BRPOPLPUSH atomically returns and removes the last task (tail) from the work queue, and pushes it to it's own "processing queue".
Then the worker starts to process the task by findind the correct method for processing.

```sh
redis> BRPOPLPUSH work worker1-queue 0
"task 1"
redis> BRPOPLPUSH work worker2-queue 0
"task 2"
redis> LRANGE worker1-queue 0 -1
1) "task 1"
redis> LRANGE worker2-queue 0 -1
1) "task 2"
redis> LRANGE work 0 -1
1) "task 3"
```

After processeing has finished, the task is removed from the workers processing queue (`LREM`) and the cycle repeats itself.

```sh
redis> LREM worker1-queue -1 'task 1'
(integer) 1
redis> LRANGE worker1-queue 0 -1
(empty list or set)
```

When starting a worker, it resumes any (unfinished) tasks in it's processing queue before fetching a new task from the global work queue.
If the worker is terminated with a `SIGINT`, all tasks in the processing queue is finished before the process is terminated. This is to avoid tasks that needs to be resumed.
