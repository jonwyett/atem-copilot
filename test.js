const { Atem } = require('atem-connection');
const myAtem = new Atem();
myAtem.on('info', console.log);
myAtem.on('error', console.error);

myAtem.connect('192.168.1.200');

myAtem.on('connected', () => {
	/*
    myAtem.changeProgramInput(3).then(() => {
		// Fired once the atem has acknowledged the command
		// Note: the state likely hasnt updated yet, but will follow shortly
		console.log('Program input set')
	});
    */
	console.log(myAtem.state);
});

myAtem.on('stateChanged', (state, pathToChange) => {
	//console.log(state); // catch the ATEM state.
    //console.log(pathToChange);

    pathToChange.forEach(path=> {
        var prop = getNestedProperty(state, path);
        console.log(path + ': ' + JSON.stringify(prop));

        if (path === 'video.mixEffects.0.programInput') {
            console.log('M/E1 program changed to: ' + prop);
            console.log('Mirroring to M/E2...');
            if (prop === 4) {// || prop ===5) {
                myAtem.changeProgramInput(1, 1);
            } else {
                myAtem.changeProgramInput(prop, 1);
            }
        }

        if (path === 'video.mixEffects.0.previewInput') {
            console.log('M/E1 preview changed to: ' + prop);
            console.log('Mirroring to M/E2...');
            if (prop === 4) {//} || prop ===5) {
                myAtem.changePreviewInput(1, 1);
            } else {
                myAtem.changePreviewInput(prop, 1);
            }
        }

        if (path === 'video.mixEffects.0.transitionPosition') {
            console.log('TRANSITION!');
        }
    });


});


function getNestedProperty(state, path) {
    if (typeof path !== 'string') {
        return 'Path must be a string';
    }

    var properties = path.split('.');
    var currentObject = state;

    for (var i = 0; i < properties.length; i++) {
        var property = properties[i];

        // Check if the property exists
        if (!currentObject.hasOwnProperty(property)) {
            return 'Property not found: ' + property;
        }

        currentObject = currentObject[property];
    }

    return currentObject;
}