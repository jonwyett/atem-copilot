const copilot = require('./atemCopilot');

copilot.on('log', (...args) => {
    console.log('[AtemCopilot LOG]:', ...args);
});

copilot.on('error', (error) => {
    console.error('[AtemCopilot ERROR]:', error);
});
//copilot.updateMapping({ "3": { "ME2": 6, "AUX1": 2 } });