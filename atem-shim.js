const EventEmitter = require('events');
const fs = require('fs'); //for saving state
const { Atem } = require('atem-connection');

class ATEMShim extends EventEmitter {
    #defaultConfig = {
        saveStateFile: 'MyModule-state.json',
        MAX_LOG_BUFFER_SIZE: 100,
        autoStart: true
    };

    #config = {};
    #running = false;
    #upTime_startTime = Date.now(); // Start time of the module for uptime calculation
    
    #inputs = {};
    #atem = null; // ATEM connection object
    #routingState = {
        "ME1-Preview": 0,
        "ME1-Program": 0,
        "ME2-Preview": 0,
        "ME2-Program": 0,
        "AUX1": 0,
        "AUX2": 0,
        "AUX3": 0,
        "AUX4": 0   
    }

    // Parent logBuffers object (stores logs for each type)
    #logBuffers = {
        log: [],
        debug: [],
        error: []
    };

    constructor(config = {}) {
        super();
    
        // Apply default configuration
        this.#config = this.#deepMerge(this.#defaultConfig, config);

        this.#debug('Config:', this.#config)

        // Check when the first listener is attached to log, debug, or error
        // this solves the issue where logs are emitted before listeners are attached
        this.on('newListener', (event) => {
            
            if (event in this.#logBuffers && this.listenerCount(event) === 0) {
                this.#emitLogBuffer(event);
            }
        });

        this.#log('Module initializing...');

        /*************************************************************************/
        // ATEM setup
        this.#atem = new Atem();
        
        
        this.#atem.on('connected', () => {
            this.#log(`Connected to ATEM switcher on IP: ${this.#config.ip}`);
            this.#inputs = this.#extractInputs(this.#atem.state);
            this.#processRoutingState(this.#atem.state);
            this.emit('started');
        });

        this.#atem.on('disconnected', () => {
            this.#log('Disconnected from ATEM switcher.');
        });

        this.#atem.on('stateChanged', (state, pathToChange) => {
            //this need to happen first to update the clean routing state
            this.#processRoutingState(state);

            //clean the path and convert it to human readable format
            var cleanPath = pathToChange.map(this.#convertRoutingPath);
            //generate an array of changes
            var change = [];
            cleanPath.forEach((path) => {
                change.push({
                    path: path,
                    value: this.#routingState[path] //pull the value from the existing routing state
                });
            });

            this.#debug('What changed:', change);

            this.emit('stateChanged', change);
        });

        this.#atem.on('error', (error) => {
            this.#error(error);
        });

        if (this.#config.autoStart) {
            console.log('autoStart is true');
            this.start();
        }
    }

    /*************************************************************************/
    // starting and stopping the module
    start() {
        this.#debug('starting module');
        if (this.#running) {
            this.#log('Module already started.');
            return;
        }
        this.#running = true;
        this.#log('Starting ATEM...');
        this.#debug(`attempting to connect to ${this.#config.ip}`);
        this.#atem.connect(this.#config.ip);

        this.#debug('connection command sent');   
    }

    stop() {
        if (!this.#running) {
            this.#log('Module already stopped.');
            return;
        }
        this.#running = false;
        this.#log('Module stopped.');
        this.#atem.disconnect();
        this.emit('stopped');
    }

    /*************************************************************************/
    // Internal functions
    #processStateChange(state, pathToChange) {
        //FOR FUTURE USE
        /* This should only return interesting info for things like a cut or transition
        
        pathToChange.forEach((path) => {
            let cleanPath = '';
            let value = this.#getNestedProperty(state, path);

            if (path === 'video.mixEffects.0.programInput') {
                cleanPath = 'ME1-Program';
                this.#routingState["ME1-Program"] = value;
            }

            if (path === 'video.mixEffects.0.previewInput') {
                cleanPath = 'ME1-Preview';
                this.#routingState["ME1-Preview"] = value;
            }

            if (path === 'video.mixEffects.1.programInput') {
                cleanPath = 'ME2-Program';
                this.#routingState["ME2-Program"] = value;
            }

            if (path === 'video.mixEffects.1.previewInput') {
                cleanPath = 'ME2-Preview';
                this.#routingState["ME2-Preview"] = value;
            }

            if (path === 'video.auxilliaries.0') {
                cleanPath = 'AUX1';
                this.#routingState["AUX1"] = value;
            }

            if (path === 'video.auxilliaries.1') {
                cleanPath = 'AUX2';
                this.#routingState["AUX2"] = value;
            }

            if (path === 'video.auxilliaries.2') {
                cleanPath = 'AUX3';
                this.#routingState["AUX3"] = value;
            }

            if (path === 'video.auxilliaries.3') {
                this.#routingState["AUX4"] = value;
                cleanPath = 'AUX4';
            }

            
            if (path === 'video.mixEffects.0.transitionPosition') {
                this.#debug('Transition detected.');
            }

            
        });
        */
        
    }

    #processRoutingState = (state) => {  
        this.#routingState["ME1-Preview"] = state.video.mixEffects[0].previewInput;
        this.#routingState["ME1-Program"] = state.video.mixEffects[0].programInput;
        this.#routingState["ME2-Preview"] = state.video.mixEffects[1].previewInput;
        this.#routingState["ME2-Program"] = state.video.mixEffects[1].programInput;
        this.#routingState["AUX1"] = state.video.auxilliaries[0];
        this.#routingState["AUX2"] = state.video.auxilliaries[1];
        this.#routingState["AUX3"] = state.video.auxilliaries[2];
        this.#routingState["AUX4"] = state.video.auxilliaries[3];
    }

    #convertRoutingPath(path) {
        // Convert ATEM path to human-readable format
        switch (path) {
            case 'video.mixEffects.0.previewInput':
                return 'ME1-Preview';
            case 'video.mixEffects.0.programInput':
                return 'ME1-Program';
            case 'video.mixEffects.1.previewInput':
                return 'ME2-Preview';
            case 'video.mixEffects.1.programInput':
                return 'ME2-Program';
            case 'video.auxilliaries.0':
                return 'AUX1';
            case 'video.auxilliaries.1':
                return 'AUX2';
            case 'video.auxilliaries.2':
                return 'AUX3';
            case 'video.auxilliaries.3':
                return 'AUX4';
        }
        return path;
    }

    
    // Extract nested properties safely
    #getNestedProperty(state, path) {
        if (typeof path !== 'string') return 'Path must be a string';
        return path.split('.').reduce((obj, key) => {
            return obj && obj.hasOwnProperty(key) ? obj[key] : 'Property not found';
        }, state);
    }

    #extractInputs(data) {
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

    /*************************************************************************/
    // External functions
    getInputs() {
        return JSON.parse(JSON.stringify(this.#inputs));
    }

    getRoutingState(useNames = false) {
        const state = JSON.parse(JSON.stringify(this.#routingState));
        
        if (useNames) {
            for (const key in state) {
                state[key] = this.getInputName(state[key]);
            }
        }
        
        return state;
    }

    getInputName(inputIndex) {
        return this.#inputs[inputIndex] || null;
    }

    getState() {
        return JSON.parse(JSON.stringify(this.#atem.state));
    }

    /*************************************************************************/
    // Input control functions
    changeProgramInput(input, me = 0) {
        this.#atem.changeProgramInput(input, me);
    }

    changePreviewInput(input, me = 0) {
        this.#atem.changePreviewInput(input, me);
    }

    setAuxSource(input, aux = 0) {
        this.#atem.setAuxSource(input, aux);
    }

    cut(me = 0) {
        this.#atem.cut(me);
    }

    /*************************************************************************/
    //configuration functions
    setConfig(newConfig = {}) {
        //the intent here is that the user will supply a new configuration object
        //and this function will update the configuration object with the new values
        //and if needed can also run additional code to handle the changes
        //put every allowable configuration change in the configHandlers object
        
        const configHandlers = {
            saveStateFile: (value) => {
                this.#config.saveStateFile = value;
                this.#log(`Save state file changed to: ${value}`);
                this.saveState(); // Immediately save state when the file changes
            }
        };
    
        for (const key in newConfig) {
            if (key in configHandlers) {
                configHandlers[key](newConfig[key]); // Run the associated function
            } else {
                this.#log(`Cannot update '${key}' dynamically.`);
            }
        }
    
        this.emit('configUpdated', this.#config);
    }

    resetConfig() {
        this.#config = JSON.parse(JSON.stringify(this.#defaultConfig));
        this.#log('Configuration reset to defaults.');
        this.emit('configReset', this.#config);
    }

    getConfig() {
        return JSON.parse(JSON.stringify(this.#config)); // Return a shallow copy (prevents direct modification)
    }
    
    
    /*************************************************************************/
    //debugging functions
    
    getUptime() {
        return Date.now() - this.#upTime_startTime;
    }
    
    /*************************************************************************/
    //for saving and loading state
    saveState(filePath) {
        if (typeof filePath !== 'string' || filePath.trim() === '') { 
            filePath = this.#config.saveStateFile;
        }

        fs.writeFileSync(filePath, JSON.stringify(this.dumpState(), null, 2));
    }
    
    loadState(filePath) {
        if (typeof filePath !== 'string' || filePath.trim() === '') { 
            filePath = this.#config.saveStateFile;
        }

        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.#debug('[INFO] Loaded state:', data);
            return data;
        }
        return null;
    }
    
    /*************************************************************************/
    //logging functions
    #log(...args) {
        this.#emitLogBuffer('log', ...args);
    }

    #debug(...args) {
        this.#emitLogBuffer('debug', ...args);
    }

    #error(...args) {
        this.#emitLogBuffer('error', ...args);
    }

    #emitLogBuffer(event, ...args) {
        // Only store the log if it has content
        if (args.length > 0) {
            this.#logBuffers[event].push(args);
        }

        // Enforce rolling buffer size limit
        if (this.#logBuffers[event].length > this.#config.MAX_LOG_BUFFER_SIZE) {
            this.#logBuffers[event].shift(); // Remove oldest entry
        }

        // If there are listeners, emit all buffered logs and clear the buffer
        if (this.listenerCount(event) > 0) {
            this.#logBuffers[event].forEach(logArgs => this.emit(event, ...logArgs));
            this.#logBuffers[event] = []; // Clear buffer after emitting
        }
    }

    /*************************************************************************/
    // Utility functions
    #deepMerge(defaultObj, overrideObj) {
        if (typeof defaultObj !== "object" || defaultObj === null) {
            return "Error: defaultObj must be a non-null object.";
        }
        if (typeof overrideObj !== "object" || overrideObj === null) {
            return "Error: overrideObj must be a non-null object.";
        }
    
        function mergeDeep(target, source) {
            for (let key in source) {
                if (source.hasOwnProperty(key)) {
                    if (
                        typeof source[key] === "object" &&
                        source[key] !== null &&
                        !Array.isArray(source[key])
                    ) {
                        if (!target[key] || typeof target[key] !== "object") {
                            target[key] = {};
                        }
                        mergeDeep(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            }
            return target;
        }
    
        let clonedDefault = JSON.parse(JSON.stringify(defaultObj));
        return mergeDeep(clonedDefault, overrideObj);
    }
}

// Export the class directly
module.exports = ATEMShim;
