'use strict';

var express    = require('express');
var http       = require('http');
var socketIO   = require('socket.io');
var bodyParser = require('body-parser');
var fs         = require('fs');

var atemModule = require('./atemCopilot');

var app    = express();
var server = http.createServer(app);
var io     = socketIO(server);

var PORT = 8080;

console.clear();

app.use(bodyParser.json());
app.use(express.static('public'));

// Route for the AUX test panel
app.get('/aux-test', function(req, res) {
  res.sendFile(__dirname + '/public/aux_test_panel.html');
});

// Route for the AUX Live Control Panel
app.get('/aux-panel', function(req, res) {
  res.sendFile(__dirname + '/public/aux_panel.html');
});

// Helper function to load mapping from file.
function getMapping() {
  try {
    var data = fs.readFileSync('mapping.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return "Error loading mapping file: " + error.message;
  }
}

var atemInputs = {};

// REST endpoint to return the list of inputs.
app.get('/api/inputs', function(req, res) {
  res.json(atemInputs);
});

// REST endpoint to return the mapping.
app.get('/api/mapping', function(req, res) {
  var mapping = getMapping();
  if (typeof mapping === 'string') {
    res.status(500).json({ error: mapping });
  } else {
    res.json(mapping);
  }
});

// REST endpoint to return the current state.
app.get('/api/state', function(req, res) {
  var state = atemModule.getCurrentState();
  res.json(state);
});

// REST endpoint to update mapping.
// Expects JSON payload: { input: "2", mapping: { ME2: "3", AUX1: "4", ... } }
app.post('/api/mapping', function(req, res) {
  var input         = req.body.input;
  var mappingConfig = req.body.mapping;
  if (!input || !mappingConfig) {
    res.status(400)
      .json({ error: 'Invalid request data' });
    return;
  }
  var updateObj = {};
  updateObj[input] = mappingConfig;
  var result = atemModule.updateMapping(updateObj);
  res.json({ success: true });
});

// REST endpoint to delete a mapping.
// DELETE /api/mapping/:input
app.delete('/api/mapping/:input', function(req, res) {
  var input = req.params.input;
  var result = atemModule.deleteMapping(input);
  if (typeof result === 'string') {
    res.status(500).json({ error: result });
  } else {
    res.json({ success: true });
  }
});

// REST endpoint to return the AUX palettes configuration.
app.get('/api/aux_palettes', function(req, res) {
  var auxPalettes = atemModule.getAuxPalettes();
  res.json(auxPalettes);
});

// REST endpoint to update AUX palettes configuration.
// Expects JSON payload with complete aux palettes object
app.post('/api/aux_palettes', function(req, res) {
  var newConfig = req.body;
  if (!newConfig) {
    res.status(400).json({ error: 'Invalid request data' });
    return;
  }
  atemModule.updateAuxPalettes(newConfig);
  res.json({ success: true });
});

atemModule.on('log', function() {
  var args = Array.prototype.slice.call(arguments);
  if (args.length >= 2 && args[0] === 'Input Names:') {
    atemInputs = args[1];
  }
  io.emit('log', args.join(' '));
});

atemModule.on('error', function() {
  var args = Array.prototype.slice.call(arguments);
  io.emit('log', args.join(' '));
});

// Listen for state events from the ATEM module.
atemModule.on('state', function(state) {
  io.emit('state', state);
});

io.on('connection', function(socket) {
  socket.emit('log', 'Connected to server.');
  socket.emit('state', atemModule.getCurrentState());
  socket.emit('inputs', atemInputs);
  socket.emit('mapping', getMapping());
  socket.emit('auxPalettes', atemModule.getAuxPalettes());
  
  // Handle manual AUX input changes from the live control panel
  socket.on('setAuxInput', function(data) {
    io.emit('log', 'Received setAuxInput request: ' + JSON.stringify(data));
    
    if (!data || !data.auxId || data.inputId === undefined) {
      io.emit('log', 'Invalid setAuxInput data received');
      return;
    }
    
    var auxId = data.auxId; // e.g., "AUX1"
    var inputId = data.inputId; // e.g., 2
    var auxIndex = parseInt(auxId.charAt(3), 10) - 1; // Convert AUX1 -> 0, AUX2 -> 1, etc.
    
    if (isNaN(auxIndex) || auxIndex < 0 || auxIndex > 3) {
      io.emit('log', 'Invalid AUX ID: ' + auxId);
      return;
    }
    
    io.emit('log', 'Setting ' + auxId + ' (index ' + auxIndex + ') to input ' + inputId);
    
    // Set the primary AUX
    atemModule.atem.setAuxSource(inputId, auxIndex);
    
    // Check for any AUX that should sync with this one
    var auxPalettes = atemModule.getAuxPalettes();
    Object.keys(auxPalettes).forEach(function(otherAuxId) {
      var otherConfig = auxPalettes[otherAuxId];
      if (otherConfig.syncTarget === auxId && !otherConfig.isLocked) {
        var otherAuxIndex = parseInt(otherAuxId.charAt(3), 10) - 1;
        if (!isNaN(otherAuxIndex) && otherAuxIndex >= 0 && otherAuxIndex <= 3) {
          io.emit('log', 'Syncing ' + otherAuxId + ' to follow ' + auxId + ' with input ' + inputId);
          atemModule.atem.setAuxSource(inputId, otherAuxIndex);
        }
      }
    });
  });
  
});

server.listen(PORT, function() {
  console.log('Server is running on port ' + PORT);
});
