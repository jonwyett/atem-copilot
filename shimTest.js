console.clear();
console.log('************* Starting ATEM shim TEST *************', '\r\n');

const ATEMShim = require('./atem-shim.js');
const fs = require('fs'); //for saving state

const atem = new ATEMShim({ip: '192.168.1.200', autoStart: true});

atem.on('log', (...msgs) => {
    console.log('[ATEM LOG]', ...msgs);
});

atem.on('error', (...msgs) => {
    console.error('[ATEM ERROR]', ...msgs);
});

atem.on('debug', (...msgs) => {
    console.debug('[ATEM DEBUG]', ...msgs);
});

atem.on('stateChanged', (change) => {
    console.log('[ATEM STATE CHANGED]', change);
    console.log('[ATEM ROUTING STATE]', atem.getRoutingState(true));
});

atem.on('started', () => {
    console.log('ATEM started');
    console.log('Current Routing State: ', atem.getRoutingState(true));
});

//atem.start();
