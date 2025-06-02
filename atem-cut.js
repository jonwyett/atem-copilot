const ATEMShim = require('./atem-shim');
const myAtem = new ATEMShim({ ip: '192.168.1.200', autoStart: true });

myAtem.on('log', console.log);
myAtem.on('error', console.error);

console.clear();

myAtem.on('started', () => {
    console.log('Connected to ATEM');
});

const readline = require('readline');

// Function to execute when 'x' is pressed
function cut() {
    console.log("--CUT--");
    myAtem.cut();
}

// Function to change ME/1 program input
function changeProgramInput(input) {
    console.log(`Changing ME/1 Program to input ${input}`);
    myAtem.changeProgramInput(input, 0); // 0 is ME/1
}

// Function to change ME/1 preview input
function changePreviewInput(input) {
    console.log(`Changing ME/1 Preview to input ${input}`);
    myAtem.changePreviewInput(input, 0); // 0 is ME/1
}

// Setting up readline to listen for key presses
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

console.log("Program Controls:");
console.log("1-5: Change ME/1 Program input");
console.log("a,s,d,f,g: Change ME/1 Preview input");
console.log("x: Cut");
console.log("q: Exit");

// Listening for key presses
process.stdin.on('keypress', (str, key) => {
    // Handle special keys first
    if (key.name === 'x') {
        cut();
        return;
    }
    if (key.name === 'q') {
        console.log("Exiting...");
        process.exit();
        return;
    }
    // Handle all other keys
    switch (key.name) {
        // Program input controls (1-5)
        case '1':
            changeProgramInput(1);
            break;
        case '2':
            changeProgramInput(2);
            break;
        case '3':
            changeProgramInput(3);
            break;
        case '4':
            changeProgramInput(4);
            break;
        case '5':
            changeProgramInput(5);
            break;
        
        // Preview input controls (a-g)
        case 'a':
            changePreviewInput(1);
            break;
        case 's':
            changePreviewInput(2);
            break;
        case 'd':
            changePreviewInput(3);
            break;
        case 'f':
            changePreviewInput(4);
            break;
        case 'g':
            changePreviewInput(5);
            break;
    }
});