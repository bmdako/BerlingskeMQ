BerlingskeMQ
============

This is a proof of concept for a simple message queue implemented in Node using Redis.
It also includes a handler for calling webhooks.

Redis acknowledges the reliable queue pattern which could be used to implement a message queue. To implement this pattern the only components needed are a Redis server and a worker process - in this case a Node.js worker process.

The execution will go like this:

A producer inserts a message into a work queue (a list in Redis) called e.g. "work" using the command LPUSH. This producer could be our other Node.js API application that pushed the message that a journalist have updated an article.
Note: Below are the execution exemplified by using the standard Redis command client.
Three messages gets pushed into our work queue:

```sh
redis> LPUSH work "article_update:537cbe5c5257829b768f5e78"
(integer) 1
redis> LPUSH work "article_update:533eb6813c2f0b4d205aa0c5"
(integer) 2
redis> LPUSH work "article_update:537f29d534907c082de418e2"
(integer) 3
```

The message is a string and you have to define the form of these messages. In the example above the event is article_update and the ID of the article followed by a colon.
(For the purpose of explanation, we check the content of the work queue:)

```sh
redis> LRANGE work 0 -1
1) "article_update:537cbe5c5257829b768f5e78"
2) "article_update:533eb6813c2f0b4d205aa0c5"
3) "article_update:537f29d534907c082de418e2"
```

The file `producer.js` is a sample script that generates 100 tasks and pushed them into the work queue.

Next, to process the messages in the queue, we start a worker by calling `node worker.js worker1`

Note: The third command argument is the id of the worker.

The worker polls the “work” queue by executing the blocking command BRPOPLPUSH that atomically returns and removes the last message (tail) from the work queue, and pushes it to it's own "processing queue". (By doing it atomically, it ensures that only one worker receives the message.) Below we have two workers processes running: worker1 and worker2. They each receive a message - but two different ones:

```sh
redis> BRPOPLPUSH work worker1-queue 0
"article_update:537f29d534907c082de418e2"
redis> BRPOPLPUSH work worker2-queue 0
"article_update:533eb6813c2f0b4d205aa0c5"
```

(For the purpose of explanation, we check the content of our two processing queues and the work queue:)

```sh
redis> LRANGE worker1-queue 0 -1
1) "article_update:537f29d534907c082de418e2"
redis> LRANGE worker2-queue 0 -1
1) "article_update:533eb6813c2f0b4d205aa0c5"
redis> LRANGE work 0 -1
1) "article_update:537cbe5c5257829b768f5e78"
```

After BRPOPLPUSH has yielded a message, the worker starts to process the message by finding and executing the correct method for processing whatever needs to be processed. After the processing has finished, the message is removed from the workers processing queue (command LREM):

```sh
redis> LREM worker1-queue -1 'article_update:537f29d534907c082de418e2'
(integer) 1
```

Now the process queue for worker1 is empty:

```sh
redis> LRANGE worker1-queue 0 -1
(empty list or set)
```

Now the cycle repeats itself: the worker now executes the blocking BRPOPLPUSH until a message is receives.

The main weakness in this design is that because each worker has it's own unique processing queue, if a worker is taken out of production and deleted with unfinished work still left in it's processing queue, the other worker have to find a way to automatically takes over at processing that particular queue.

The first precaution is to avoid having unfinished work when shutting down gracefully.
In this POC it implemented so that if the worker is terminated with a SIGINT, all messages in the processing queue is finished before the process is terminated.

Furthermore, when starting a worker, it resumes any unfinished processing of messages in it's processing queue before fetching a new message from the global work queue.

But other than that, I think it's a pretty cool little application and pattern.

