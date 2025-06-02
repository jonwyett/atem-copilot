const { Atem } = require('atem-connection');

const atem = new Atem();
const ATEM_IP = '192.168.1.200'; // Change this to your ATEM's IP address

// Connect to the ATEM
atem.connect(ATEM_IP);

atem.on('connected', () => {
    console.log('Connected to ATEM switcher.');

    // Retrieve and log input labels
    Object.values(atem.state.inputs).forEach(input => {
        console.log(`Input ${input.inputId}: ${input.shortName} (${input.longName})`);
    });
});

atem.on('disconnected', () => {
    console.log('Disconnected from ATEM switcher.');
});

atem.on('error', (error) => {
    console.log('ATEM Error:', error.message || error);
});

atem.on('stateChanged', (state, path) => {
    console.log('State changed:', path);
});
