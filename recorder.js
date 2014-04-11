var sys = require('sys')
  , spawn = require('child_process').spawn
  , serial = require('serialport')
  , fs = require('fs')
  ;

process.argv = process.argv.slice(2);

var record = function(){
  var baud = process.argv[1];
  var input = process.argv[2];
  var output = process.argv[3];
  var stream = fs.createWriteStream(output);
  stream.once('open', function(){});

  if (!(baud && input && output)){
    usage();
    process.exit();
  }

  var port = new serial.SerialPort(input, { 
      baudrate: +baud
    , parser : serial.parsers.readline("\n")
  }, true);

  var timeStart = null;
  var processInput = function(data){
    if (!timeStart) timeStart = Date.now();
    console.log(data);
    stream.write(''+(Date.now()-timeStart));
    stream.write(':');
    stream.write(data);
    stream.write('\n');
  }

  port.on("data", processInput);

}

var play = function(){
  var input = process.argv[1];
  var output = process.argv[2];
  
  var recording = [];

  var readable = fs.createReadStream(input);
  readable.setEncoding('utf-8');
  readable.on('readable', function() {
    var chunk;
    while (null !== (chunk = readable.read())) {
      console.log('read chunk ' + chunk.length);
      console.log(chunk.split('\n').length);
      recording = recording.concat(chunk.split('\n').map(function(line){
        var split = line.match(/^([0-9]*):(.*)/);
        return split && {
          offset: split[1],
          data: split[2]
        }
      }).filter(function(x){ return x }));
      console.log(recording.length);
    }
  });

  var runChunk = function(size,continuation){
    var start = continuation && continuation.start || Date.now();
    var offset = continuation && continuation.offset || 0;
    
    var end = Math.min(offset+size, recording.length);

    for (var i = offset; i < end;){
      var now = Date.now() - start;
      var row = recording[i];
      if (row.offset <= now){
        console.log(row.data);
        i++;
      }
    }
    var ended = end == recording.length;
    return ended ? undefined : {
      start: start,
      offset: end
    };
  }

  var run = function(chunkSize,continuation){
    var next = runChunk(chunkSize,continuation);
    setImmediate(run.bind(null,chunkSize,next));
  };

  run(80);



}

var usage = function(){
  console.log("usage: serial-recorder record <baud> <input> <recording>");
  console.log("       serial-recorder play <recording> <output>")
  process.exit();
};

console.log(process.argv);

({
  "record" : record,
  "play"   : play
}[process.argv[0]] || usage)()