module.exports = function handleFakeTasks (task, done) {

  if (!task.indexOf('task') > 0){
    return done();
  }

  console.log('Processing task: ' + task);
  var random = randomIntFromInterval(1, 30);
  if (random === 1) {
    console.log('FAKE SHUTDOWN when processing random ' + random);
    process.exit(1);
  }
  setTimeout(function() {
    done();
  }, randomIntFromInterval(1000, 6000));
}

function randomIntFromInterval (min, max) {
    return Math.floor( Math.random() * (max - min + 1) + min);
}