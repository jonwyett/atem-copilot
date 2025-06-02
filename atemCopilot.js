const fs = require('fs');
const EventEmitter = require('events');
const ATEMShim = require('./atem-shim');

class atemCopilot extends EventEmitter {
    constructor(atemIp, mappingFile) {
        super();
        this.atemIp = atemIp || '192.168.1.200';
        this.mappingFile = mappingFile || 'mapping.json';
        this.mapping = {};
        this.inputs = {};
        this.currentState = {
            "ME1-Preview": 0,
            "ME1-Program": 0,
            "ME2-Preview": 0,
            "ME2-Program": 0,
            "AUX1": 0,
            "AUX2": 0,
            "AUX3": 0,
            "AUX4": 0
        };

        // Initialize ATEM shim
        this.atem = new ATEMShim({ ip: this.atemIp, autoStart: true });

        // Forward ATEM shim events
        this.atem.on('log', (...args) => this.emit('log', ...args));
        this.atem.on('error', (...args) => this.emit('error', ...args));

        // Handle state changes from ATEM shim
        this.atem.on('stateChanged', (changes) => {
            // Update current state based on changes
            changes.forEach(change => {
                this.currentState[change.path] = change.value;
            });

            // Check for mapping triggers
            changes.forEach(change => {
                if (change.path === 'ME1-Program') {
                    this.applyProgramMapping(change.value);
                } else if (change.path === 'ME1-Preview') {
                    this.applyPreviewMapping(change.value);
                }
            });

            // Emit state for server compatibility
            this.emit('state', this.currentState);
        });

        // Handle ATEM connection
        this.atem.on('started', () => {
            this.loadMapping();
            this.inputs = this.atem.getInputs();
            this.emit('log', 'Input Names:', this.inputs);
        });
    }

    loadMapping() {
        try {
            const data = fs.readFileSync(this.mappingFile, 'utf8');
            this.mapping = JSON.parse(data);
            this.emit('log', 'Mapping file loaded:', this.mapping);
        } catch (error) {
            this.emit('error', `Error loading mapping file: ${error.message}`);
        }
    }

    saveMapping() {
        try {
            fs.writeFileSync(this.mappingFile, JSON.stringify(this.mapping, null, 4), 'utf8');
            this.emit('log', 'Mapping file saved successfully.');
        } catch (error) {
            this.emit('error', `Error saving mapping file: ${error.message}`);
        }
    }

    updateMapping(newEntry) {
        const key = Object.keys(newEntry)[0];
        this.mapping[key] = newEntry[key];
        this.emit('log', `Updated mapping for input ${key}:`, this.mapping[key]);
        this.saveMapping();
    }

    deleteMapping(input) {
        if (this.mapping.hasOwnProperty(input)) {
            delete this.mapping[input];
            this.emit('log', 'Deleted mapping for input ' + input);
            this.saveMapping();
        } else {
            return "Mapping for input " + input + " does not exist.";
        }
    }

    // Apply mapping for M/E2 Program and AUX (Triggered by M/E1 Program change)
    applyProgramMapping(me1Program) {
        if (this.mapping.hasOwnProperty(me1Program)) {
            let config = this.mapping[me1Program];
    
            this.emit('log', `M/E1 program changed to: ${me1Program}`);
    
            if (config.ME2 !== undefined && config.ME2 !== null && config.ME2 !== '') {
                this.emit('log', `Mirroring M/E2 program to: ${config.ME2}`);
                this.atem.changeProgramInput(config.ME2, 1); // Use atem-shim method for M/E2
            } else {
                this.emit('log', `Skipping M/E2 program update due to null or empty mapping.`);
            }
    
            // Apply AUX settings only if they have valid values
            Object.entries(config).forEach(([key, source]) => {
                if (key.startsWith("AUX") && source !== undefined && source !== null && source !== '') {
                    let auxIndex = parseInt(key.charAt(3), 10) - 1; // Convert to zero-based index
                    if (!isNaN(auxIndex) && auxIndex >= 0 && auxIndex < 10) {
                        this.emit('log', `Setting AUX${auxIndex} to input ${source}`);
                        this.atem.setAuxSource(source, auxIndex); // Use atem-shim method for AUX
                    }
                }
            });
        } else {
            this.emit('log', `No mapping found for M/E1 program input ${me1Program}, skipping.`);
        }
    }

    // Apply mapping for M/E2 Preview (Triggered by M/E1 Preview change)
    applyPreviewMapping(me1Preview) {
        if (this.mapping.hasOwnProperty(me1Preview)) {
            let config = this.mapping[me1Preview];
    
            this.emit('log', `M/E1 preview changed to: ${me1Preview}`);
    
            if (config.ME2 !== undefined && config.ME2 !== null && config.ME2 !== '') {
                this.emit('log', `Mirroring M/E2 preview to: ${config.ME2}`);
                this.atem.changePreviewInput(config.ME2, 1); // Use atem-shim method for M/E2
            } else {
                this.emit('log', `Skipping M/E2 preview update due to null or empty mapping.`);
            }
        } else {
            this.emit('log', `No mapping found for M/E1 preview input ${me1Preview}, skipping.`);
        }
    }

    getCurrentState() {
        return this.currentState;
    }
}

const copilotInstance = new atemCopilot();

module.exports = {
    updateMapping: copilotInstance.updateMapping.bind(copilotInstance),
    deleteMapping: copilotInstance.deleteMapping.bind(copilotInstance),
    on: copilotInstance.on.bind(copilotInstance),
    emit: copilotInstance.emit.bind(copilotInstance),
    getCurrentState: copilotInstance.getCurrentState.bind(copilotInstance)
};
