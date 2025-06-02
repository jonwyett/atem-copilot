const fs = require('fs');
const { Atem } = require('atem-connection');
const EventEmitter = require('events');

class atemCopilot extends EventEmitter {
    constructor(atemIp, mappingFile) {
        super();
        this.atemIp = atemIp || '192.168.1.200';
        this.mappingFile = mappingFile || 'mapping.json';
        this.atem = new Atem();
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

        this.atem.on('error', (error) => {
            this.emit('error', error);
        });

        this.connect();
    }

    connect() {
        this.atem.connect(this.atemIp);
        this.atem.on('connected', () => {
            this.emit('log', 'Connected to ATEM switcher.');
            this.loadMapping();
            this.inputs = this.extractInputs(this.atem.state);
            this.emit('log', 'Input Names:', this.inputs);
        });

        this.atem.on('disconnected', () => this.emit('log', 'Disconnected from ATEM switcher.'));

        // Handle state changes
        this.atem.on('stateChanged', (state, pathToChange) => {
            pathToChange.forEach((path) => {
                let value = this.getNestedProperty(state, path);

                if (path === 'video.mixEffects.0.programInput') {
                    this.applyProgramMapping(value);
                    this.currentState["ME1-Program"] = value;
                }

                if (path === 'video.mixEffects.0.previewInput') {
                    this.applyPreviewMapping(value);
                    this.currentState["ME1-Preview"] = value;
                }

                if (path === 'video.mixEffects.1.programInput') {
                    this.currentState["ME2-Program"] = value;
                }

                if (path === 'video.mixEffects.1.previewInput') {
                    this.currentState["ME2-Preview"] = value;
                }

                if (path === 'video.auxilliaries.0') {
                    this.currentState["AUX1"] = value;
                }

                if (path === 'video.auxilliaries.1') {
                    this.currentState["AUX2"] = value;
                }

                if (path === 'video.auxilliaries.2') {
                    this.currentState["AUX3"] = value;
                }

                if (path === 'video.auxilliaries.3') {
                    this.currentState["AUX4"] = value;
                }

                if (path === 'video.mixEffects.0.transitionPosition') {
                    this.emit('log', 'Transition detected.');
                }

                //this should actually emit the state to the client
                this.emit('state', this.currentState);

                
            });
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

    extractInputs(data) {
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

    // Apply mapping for M/E2 Program and AUX (Triggered by M/E1 Program change)
    applyProgramMapping(me1Program) {
        if (this.mapping.hasOwnProperty(me1Program)) {
            let config = this.mapping[me1Program];
    
            this.emit('log', `M/E1 program changed to: ${me1Program}`);
    
            if (config.ME2 !== undefined && config.ME2 !== null && config.ME2 !== '') {
                this.emit('log', `Mirroring M/E2 program to: ${config.ME2}`);
                this.atem.changeProgramInput(config.ME2, 1);
            } else {
                this.emit('log', `Skipping M/E2 program update due to null or empty mapping.`);
            }
    
            // Apply AUX settings only if they have valid values
            Object.entries(config).forEach(([key, source]) => {
                if (key.startsWith("AUX") && source !== undefined && source !== null && source !== '') {
                    let auxIndex = parseInt(key.charAt(3), 10) - 1; // Convert to zero-based index
                    if (!isNaN(auxIndex) && auxIndex >= 0 && auxIndex < 10) {
                        this.emit('log', `Setting AUX${auxIndex} to input ${source}`);
                        this.atem.setAuxSource(source, auxIndex).catch(err => {
                            this.emit('error', `Error setting AUX${auxIndex}: ${err.message}`);
                        });
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
                this.atem.changePreviewInput(config.ME2, 1);
            } else {
                this.emit('log', `Skipping M/E2 preview update due to null or empty mapping.`);
            }
        } else {
            this.emit('log', `No mapping found for M/E1 preview input ${me1Preview}, skipping.`);
        }
    }
    

    // Extract nested properties safely
    getNestedProperty(state, path) {
        if (typeof path !== 'string') return 'Path must be a string';
        return path.split('.').reduce((obj, key) => {
            return obj && obj.hasOwnProperty(key) ? obj[key] : 'Property not found';
        }, state);
    }

    getCurrentState() {
        return this.currentState;
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
}

const copilotInstance = new atemCopilot();

module.exports = {
    updateMapping: copilotInstance.updateMapping.bind(copilotInstance),
    deleteMapping: copilotInstance.deleteMapping.bind(copilotInstance),
    on: copilotInstance.on.bind(copilotInstance),
    emit: copilotInstance.emit.bind(copilotInstance),
    getCurrentState: copilotInstance.getCurrentState.bind(copilotInstance)
  };
