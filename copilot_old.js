const fs = require('fs');
const { Atem } = require('atem-connection');

const ATEM_IP = '192.168.1.200'; // Change this to your ATEM's IP address
const MAPPING_FILE = 'mapping.json';

const atem = new Atem();

var inputs = {};

atem.connect(ATEM_IP);

let mapping = {};

// Load the mapping file
function loadMapping() {
    try {
        const data = fs.readFileSync(MAPPING_FILE, 'utf8');
        mapping = JSON.parse(data);
        console.log('Mapping file loaded:', mapping);
    } catch (error) {
        console.error('Error loading mapping file:', error.message);
    }
}

// Save the mapping file
function saveMapping() {
    try {
        fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 4), 'utf8');
        console.log('Mapping file saved successfully.');
    } catch (error) {
        console.error('Error saving mapping file:', error.message);
    }
}

// Update the internal mapping
function updateMapping(newEntry) {
    const key = Object.keys(newEntry)[0];
    mapping[key] = newEntry[key];
    console.log(`Updated mapping for input ${key}:`, mapping[key]);
    saveMapping();
}

// Apply mapping for M/E2 Program and AUX (Triggered by M/E1 Program change)
function applyProgramMapping(me1Program) {
    if (mapping.hasOwnProperty(me1Program)) {
        let config = mapping[me1Program];

        console.log(`M/E1 program changed to: ${me1Program}`);
        console.log(`Mirroring M/E2 program to: ${config.ME2}`);
        atem.changeProgramInput(config.ME2, 1);

        // Apply AUX settings if specified
        Object.entries(config).forEach(([key, source]) => {
            if (key.startsWith("AUX")) {
                console.log(`Processing key: ${key} with source: ${source}`);

                // Extract the AUX index from the second character (assuming "AUX1" to "AUX9")
                let auxIndex = parseInt(key.charAt(3), 10);
                auxIndex--; // Convert to zero-based index

                console.log(`Extracted AUX index: ${auxIndex}`);

                if (!isNaN(auxIndex) && auxIndex >= 0 && auxIndex < 10) {
                    console.log(`Setting AUX${auxIndex} to input ${source}`);
                    atem.setAuxSource(source, auxIndex).catch(err => {
                        console.error(`Error setting AUX${auxIndex}:`, err.message);
                    });
                } else {
                    console.error(`Invalid AUX bus key detected: ${key}`);
                }
            }
        });
    } else {
        console.log(`No mapping found for M/E1 program input ${me1Program}, skipping.`);
    }
}

// Apply mapping for M/E2 Preview (Triggered by M/E1 Preview change)
function applyPreviewMapping(me1Preview) {
    if (mapping.hasOwnProperty(me1Preview)) {
        let config = mapping[me1Preview];

        console.log(`M/E1 preview changed to: ${me1Preview}`);
        console.log(`Mirroring M/E2 preview to: ${config.ME2}`);
        atem.changePreviewInput(config.ME2, 1);
    } else {
        console.log(`No mapping found for M/E1 preview input ${me1Preview}, skipping.`);
    }
}

// Handle state changes
atem.on('stateChanged', (state, pathToChange) => {
    pathToChange.forEach((path) => {
        let value = getNestedProperty(state, path);

        if (path === 'video.mixEffects.0.programInput') {
            applyProgramMapping(value);
        }

        if (path === 'video.mixEffects.0.previewInput') {
            applyPreviewMapping(value);
        }

        if (path === 'video.mixEffects.0.transitionPosition') {
            console.log('Transition detected.');
        }
    });
});

// Extract nested properties safely
function getNestedProperty(state, path) {
    if (typeof path !== 'string') return 'Path must be a string';
    return path.split('.').reduce((obj, key) => {
        return obj && obj.hasOwnProperty(key) ? obj[key] : 'Property not found';
    }, state);
}


function extractInputs(data) {
    let inputs = {};

    if (data.inputs) {
        for (let key in data.inputs) {
            if (data.inputs.hasOwnProperty(key) && data.inputs[key].longName) {
                inputs[key] = data.inputs[key].longName;
            }
        }
    }

    return inputs;
}

// Event handlers
atem.on('connected', () => {
    console.log('Connected to ATEM switcher.');
    loadMapping();
    console.log('Current ATEM state:', atem.state);
    inputs = extractInputs(atem.state);
    console.log('Input Names:', inputs);
});

atem.on('disconnected', () => console.log('Disconnected from ATEM switcher.'));
atem.on('error', (error) => console.log('ATEM Error:', error.message || error));
