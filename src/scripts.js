// CONST
const SIDEBAR_MENU_N = 2; // amount of sidebar menus
const PORT_LIST_REFRESH_RATE = 4; // available port list refresh rate in seconds

const MAX_FLOWRATE = 10000; // maximum flowrate user can input (in uL/min)
const MAX_VOLUME = 99999    // maximum volume user can input (in uL)
const MAX_DURATION = 36000  // maximum duration user can input (in s)

const SERIAL_NUMBER = 'MCFP001';        // serial number of microfluidic pump device
const FLOWRATE_CHART_MAX_TIME = 30;     // maximum time range shown in flowchart
const CONNECTION_TIMEOUT_DURATION = 3;  // connection timeout duration in seconds
const BAUD_RATE = 115200;               // serial UART baud rate setting.
const TIMER_UPDATE_PERIOD = 4;          // timer update period in milisecond
//const INFORMATION_UPDATE_PERIOD = 100;  // sequence information update period in milisecond
const INFO_UPDATE_COUNTER = 100;        // update counter before reset

// VARIABLES
/*  Sequence array consist of 5 items:
    {pump, dir, flowrate, dov_sel, dov} */
var sequence = []; // array containing complete sequence parameter data
var current_selected_sequence = 1; // currently selected sequence in the sequence input window
var running_sequence = 0; // current running sequence
var previous_running_sequence = 0; // previous running sequence

var isInputValid = false; // variable to show whether current user input value is invalid

//running sequence variables
var total_run_time = 0;         // sequence total run time
var last_total_run_time = 0;    // sequence total run time up to the last sequence finished
var time_left = 0;              // running sequence time left
var run_time = 0;               // running sequence run time
var run_time_ms = 0;            // running sequence run time in milisecond
var volume_infused = 0;         // running sequence volume infused
var volume_left = 0;            // running sequence volume left
var current_flow = 0;           // current flowrate in uL/min
var average_flow = 0;           // average flowrate of the currently running sequence in uL/min
var update_counter = 0;         // update sequence information data counter
var last_run_time = 0;          // last runtime for informastion update counter


var isPaused = true;        // current state of running sequence sequence
// status of whether sequence data is already sent to the device and 
// is being or about to be run.
var isSequenceRunning = false;
// load chart.js module
var Chart = require('chart.js');
var flowrateChart;          // line chart showing pump's flowrate
var flowrate_arr = [];      // array that store real-time flowrate data
var avg_flowrate_arr = [];  // array that store average flowrate data

// Variables for data saving
const remote = require('electron').remote;
const dialog = remote.dialog;
const fs = require('fs');

// SERIAL CONNECTION TO STM32
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
var port;               // variable for serial port!
var port_list = [];     // list of all available port
var parser;             // variable for parsing data received through serial communication
var selected_port = ''; // currently selected PORT
var port_open = 0;      // port open status 0 = closed, 1 = open
var port_ready = 0;     // variable to show whether port is verified and ready to receive data

// connection timeout variable handler
var connection_timeout; //variable holding the connection timeout countdown
var port_connecting = false; // variable indicating whether the application is currently trying to connec to a PORT
var port_auto_refresh; // auto refresh port list Interval variable holder

// Function to be run on window load/start
window.onload = function () {
    this.sidebarMenuSelected(1); //Add Sequence is selected on start
    this.createNewSequence();
    this.updateSequenceReview();

    // initiate the flowrate chart
    var ctx = document.getElementById('flowrateChart').getContext('2d');
    flowrateChart = new Chart(ctx, {
        type: 'line',
        data: { // graph data
            datasets: [{
                label: 'Flowrate',
                data: flowrate_arr,
                borderColor: ['rgba(54, 162, 235, 0.5)'],
                fill: false,
                borderWidth: 2
            },
            {
                label: 'Avg. flowrate',
                data: avg_flowrate_arr,
                borderColor: ['rgba(252, 40, 72)'],
                fill: false,
                borderWidth: 2
            }]
        },
        options: {
            title: {
                text: 'Flowrate',
                display: true
            },
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 //turn off animation
            },
            hover: {
                animationDuration: 0 //turn off animation
            },
            responsiveAnimationDuration: 0, //turn off animation
            elements: {
                point: {
                    pointStyle: 'circle',
                    radius: 0
                },
                line: {
                    tension: 0,
                }
            },
            scales: { //x-y axes settings
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'flowrate (&microL/min)'
                    },
                    type: 'linear',
                    ticks: {
                        beginAtZero: true,
                        stepSize: 10
                    }
                }],
                xAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'Time (s)'
                    },
                    type: 'linear',
                    bound: 'ticks',
                    ticks: {
                        beginAtZero: false,
                        stepSize: 2,
                        offset: true,
                        min: 0,
                        max: FLOWRATE_CHART_MAX_TIME
                    }
                }]
            },
            legend: { //legend settings
                display: true,
                position: 'right',
                labels: {
                    boxWidth: 20,
                }
            }
        }
    });

}



//Function to save sequence data to the computer
function saveSequenceData() {
    var content = '';
    var i = 0;

    //open save dialog
    dialog.showSaveDialog(remote.getCurrentWindow(), {
        title: 'Save sequence',
        filters: [{ name: 'Pump Sequence Save File', extensions: ['pssf'] }]
    }).then(result => {
        filename = result.filePath;
        if (!result.canceled) { // Save button is clicked
            if (filename === undefined) { // error if user didnt specify file name
                if (err) console.log(err);
                dialog.showMessageBox(remote.getCurrentWindow(), {
                    type: 'error',
                    title: 'Save Error',
                    message: "Failed to save file.",
                });
                return;
            }
            // reformat sequence parameters data into comma delimited.
            sequence.forEach(seq => {
                i++;
                if (i < sequence.length) {
                    content += `${seq.pump},${seq.dir},${seq.flowrate},${seq.dov_sel},${seq.dov}\n`;
                }
                else {
                    content += `${seq.pump},${seq.dir},${seq.flowrate},${seq.dov_sel},${seq.dov}`;
                }
            });
            // save sequence data into a file
            fs.writeFile(filename, content, (err) => {
                if (err) console.log(err);
                dialog.showMessageBox(remote.getCurrentWindow(), {
                    type: 'info',
                    title: 'File Saved',
                    message: "File has been successfully saved.",
                });
                console.log("File saved");
            });
        }
        else { // saving canceled
            console.log('Saving canceled')
        }
    })
}

// Function to load sequence data from a save file
function loadSequenceData() {
    var content = '';
    var sequence_content = [];

    dialog.showOpenDialog(remote.getCurrentWindow(), {
        title: 'Open sequence save file',
        filters: [{ name: 'Pump Sequence Save File', extensions: ['pssf'] }]
    }).then(result => {
        filename = result.filePaths[0];
        if (filename === undefined) { // error if user didnt specify file name
            return;
        }
        // load sequence data from a file
        fs.readFile(filename, (err, data) => {
            if (err) console.log(err);
            content = data.toString();
            console.log(content);
            content = content.split('\n');
            sequence = []; // clear current sequence data
            for (var i = 0; i < content.length; i++) {
                sequence_content = content[i].split(',');
                sequence[i] = {
                    pump: sequence_content[0], dir: sequence_content[1],
                    flowrate: sequence_content[2], dov_sel: sequence_content[3],
                    dov: sequence_content[4]
                };
            }
            dialog.showMessageBox(remote.getCurrentWindow(), {
                type: 'info',
                title: 'File Loaded',
                message: "File has been successfully loaded",
            });
            console.log("File loaded");

            //update the sequence list with sequence data that's been loaded
            current_selected_sequence = 1;
            updateSequenceReview();
        });
    })
}



function connectToPort() {
    try {
        port = new SerialPort(selected_port, { baudRate: BAUD_RATE }); // set port and baudrate
        parser = port.pipe(new Readline({ delimiter: '\n' })); // set delimiter on receiving data

        // triggered when port is opened
        port.on('open', () => {
            port.flush(() => { //flush any data in the buffer before connecting
                port_open = 1;
                sendData('c'); // send connection command
                setConnectionTimeoutLimit();
                // notify when the port is opened
                console.log('serial port open');
            });
        });

        // triggered when port is closed
        port.on('close', () => {
            port_open = 0;
            port_ready = 0;
            if (connection_timeout != null) {
                port_connecting = false;
                clearTimeout(connection_timeout);
            }

            // stop running and alert user if PORT is disconnected during sequence run
            if (isSequenceRunning) {
                isPaused = true; // pump in paused state
                updateIsPausedStatus(); // update pump status in the information window
                dialog.showMessageBox(remote.getCurrentWindow(), {
                    type: 'error',
                    title: 'Disconnected',
                    message: 'Device is disconnected!'
                })
            }
            // notify when the port is closed
            console.log('serial port closed');
            getAndShowPortList(); // show available port list
        })

        // Read data received by port
        parser.on('data', data => {
            console.log('received data: ', data);
            // receive sensor flowrate feedback data from the microcontroler
            if (data.startsWith('rt')) {
                run_time_ms = parseInt(data.slice(2));
                run_time = run_time_ms / 1000;
            }
            else if (data.startsWith('fr')) {
                updateFlowrateData(run_time_ms, data.slice(2));
            }
            else if (data.startsWith('afr')) {
                updateAvgFlowrateData(run_time_ms, data.slice(3));
            }
            else if (data.startsWith('vi')) {
                volume_infused = data.slice(2);
            }
            else if (data.startsWith('!up')) {
                /*
                update_counter++;
                if (update_counter >= INFO_UPDATE_COUNTER) {
                    updateSequenceInformationData();
                    update_counter = 0;
                }
                */
                if (last_run_time < parseInt(run_time)) {
                    updateSequenceInformationData();
                    last_run_time = parseInt(run_time);
                }
            }
            // receive confirmation that a microcontroller has been connected
            else if (data.startsWith('!connected')) {
                port_connecting = false;
                port_ready = 1;
                clearTimeout(connection_timeout);
                document.getElementById('status-port-text').innerHTML = `Connected | ${selected_port}`;
                document.getElementById('status-port-text').style = 'color: #33cc33;';
            }
            // receive command to close/disconnect with the current connected port
            else if (data.startsWith('!disconnect')) {
                port.close(); //close port
            }
            // confirmation that microcontroller has done receiving a sequence data
            // send next sequence data if exist
            else if (data.startsWith('!r')) {
                updateIsPausedStatus();
            }
            else if (data.startsWith('!done')) {
                console.log(`sequence-${running_sequence} done`);
                //update information data
                updateSequenceInformationData();
                last_total_run_time = parseFloat(total_run_time);

                running_sequence++;
                if (running_sequence <= sequence.length) {
                    initiateRunningSequence();
                }
                else {
                    // sequence done
                    sendEndSequenceCommand();
                    // pause
                    isPaused = true;
                    updateIsPausedStatus();
                    // reset sequence from the beginning
                    running_sequence = 0;
                }
            }
        });

    } catch (error) { }

}

/**
 * Function called to set a time limit before connection timed out when 
 * there is no successful connection
 */
function setConnectionTimeoutLimit() {
    connection_timeout = setTimeout(connectionTimedOut, CONNECTION_TIMEOUT_DURATION * 1000);
    port_connecting = true;
}

/**
 * 
 */
function connectionTimedOut() {
    port.close();
    port_connecting = false;
    dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'error',
        title: 'Connection timed out',
        message: `Connection timed out. Failed to connect to ${selected_port}`
    });
    // selected_port = '';
}


/**
 * Function called to send data {data_to_send} through serial communication
 * @param {string} data_to_send 
 */
function sendData(data_to_send) {
    // Write data and send it to arduino/stm32 microcontroller
    data_to_send += '\n';
    port.write(data_to_send, (err) => {
        if (err) {
            return console.log('Error on write: ', err.message)
        }
        console.log('data sent:');
        console.log(`${data_to_send}`);
    });
}

/**
 * Send data of sequence[n] through serial port.
 * @param {*} n 
 */
function sendSequenceData(n) {
    sendData(`s${sequence[n - 1].pump},${sequence[n - 1].dir},${sequence[n - 1].flowrate},${sequence[n - 1].dov_sel},${sequence[n - 1].dov}`);
}

/** Function to send all the sequence data in array sequence[] through connected serial port */
function startSequenceButton() {
    var error_message = document.getElementById('error-message');
    var invalid_sequence = [];
    var error_message_string = 'Invalid sequence on sequence: <br>';

    // check if the app is connected to a port 
    if (port_ready) {
        //validate sequence data
        for (let i = 0; i < sequence.length; i++) {
            if (sequence[i].pump == 1) {
                if ((sequence[i].flow == 0) || (sequence[i].dov == 0)) { //data is invalid
                    // save invalid sequence to the invalid_sequence array
                    invalid_sequence.push(i+1);
                }
            }
        }

        if (invalid_sequence.length > 0) { //invalid sequence(s) exist
            for (let i = 0; i < invalid_sequence.length; i++) {
                if (i == invalid_sequence.length - 1) {
                    error_message_string += `${invalid_sequence[i]}.`;
                }
                else {
                    error_message_string += `${invalid_sequence[i]}, `;
                }
            };
            error_message.innerHTML = error_message_string;
            return; //cancel process
        }

        //initiate/reset variables
        running_sequence = 0;
        total_run_time = 0;
        last_total_run_time = 0;
        isPaused = true;
        updateIsPausedStatus();

        changeHomeWindowMode(1); // show the sequence information window
        showRunningSequenceReview();
        showSequenceInformation(1);
    }
    else { // alert user that the app is not connected to a port/microcontroler
        showNotConnectedDialog();
    }
}

function startStopButton() {
    var button = document.getElementById('start-stop-button');

    if (isPaused) { // pump is currently paused/stopped, starting pump
        isPaused = false;
        if (running_sequence == 0) {
            // send sequence data the first time start button is clicked.
            initiateRunningSequence();
        }
        else {
            sendStartPumpCommand();
        }
    }
    else { // pump is running, pausing/stopping pump
        isPaused = true;
        sendPausePumpCommand();
    }
    updateIsPausedStatus();
}

/** Send command to pause pump through serial port */
function sendPausePumpCommand() {
    if (port_ready) {
        // send command to microcontroller
        sendData('e');
    }
    else {// port not connected
        showNotConnectedDialog();
    }
}

/** Send command to start pump on current sequence, or on sequence n if n is given
 * @param {int} n */
function sendStartPumpCommand() {
    if (port_ready) {
        // start/resume pumping on current sequence
        sendData('x');
    }
    else { // port not connected
        showNotConnectedDialog();
    }
}


/**
 * Send command to stop pump through serial port
 */
function sendEndSequenceCommand() {
    // send command
    sendData('o');
}

/** Initiate & rest variables afor the next sequence to run */
function initiateRunningSequence() {
    if (running_sequence == 0) {    // sequence started from the beginning
        last_total_run_time = 0;    // initialize total run time
        running_sequence++;
    }

    if (sequence[running_sequence - 1].dov_sel == 0) {
        time_left = sequence[running_sequence - 1].dov;
    }
    else { // sequence.dov_sel == 1 (volume)
        volume_left = sequence[running_sequence - 1].dov;
    }
    console.log(`${time_left}`);
    last_run_time = 0;              // reset pump last run time
    run_time = 0;                   //reset pump run time
    volume_infused = 0.0;           //reset pump run time
    flowrateChart_time_last = 0;    // reset flowrate chart last maximum time
    flowrateChart_i = 0;            //reset flowchart time tick counter
    //reset flowchart data for the new sequence
    flowrate_arr = [];
    avg_flowrate_arr = [];
    flowrateChart.data.datasets[0].data = [];
    flowrateChart.data.datasets[1].data = [];
    flowrateChart.options.scales.xAxes[0].ticks.min = 0;
    flowrateChart.options.scales.xAxes[0].ticks.max = FLOWRATE_CHART_MAX_TIME;

    sequence_info_update_comparator = 0;
    highlightRunningSequence();
    showSequenceInformation(); //show information of current sequence in the sequence information window
    sendSequenceData(running_sequence); //send current sequence data to microcontroler
}

/**
 * Show an popup alert that device is not connected
 */
function showNotConnectedDialog() {
    dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'error',
        title: 'Not Connected',
        message: 'Not connected to a microfluidic pump!'
    });
}

/** Function to update information display with data received from microcontroller */
function updateSequenceInformationData() {
    var time_elapsed_information = document.getElementById('sequence-information-time-elapsed');
    var time_left_information = document.getElementById('sequence-information-time-left');
    var volume_infused_information = document.getElementById('sequence-information-volume-infused');
    var volume_left_information = document.getElementById('sequence-information-volume-left');
    var total_time_elapsed_information = document.getElementById('sequence-information-total-time-elapsed');
    var current_flowrate_information = document.getElementById('sequence-information-current-flowrate');
    var average_flowrate_information = document.getElementById('sequence-information-average-flowrate');

    total_run_time = last_total_run_time + run_time;

    sequence_info_update_comparator = run_time;

    time_elapsed_information.innerHTML = secondToHMS(run_time);
    total_time_elapsed_information.innerHTML = secondToHMS(total_run_time);

    //volume pumped in the current sequence. volume in microliters. 
    volume_infused_information.innerHTML = volume_infused;
    //volume pumped in the current sequence. accounting sensor flowrate readings.
    // run_volume += time_interval * sequence[running_sequence - 1].flowrate / 60;
    if (sequence[running_sequence - 1].dov_sel == 0) {
        time_left = (sequence[running_sequence - 1].dov - run_time).toFixed(2);
        time_left_information.innerHTML = secondToHMS(sequence[running_sequence - 1].dov - parseInt(run_time));
    }
    else { //volume 
        volume_left = (sequence[running_sequence - 1].dov - volume_infused).toFixed(2);
        volume_left_information.innerHTML = volume_left;
    }
    // update current flowrate data
    current_flowrate_information.innerHTML = current_flow;
    // update average flowrate
    average_flowrate_information.innerHTML = average_flow;
    // update flowratechart
    flowrateChart.update();
}

/** Convert second to h:mm:ss string format */
function secondToHMS(second) {
    var hms = '';
    var hour = parseInt(second / 3600);
    var min = toNDigits(parseInt((second % 3600) / 60), 2);
    var sec = toNDigits(parseInt(second % 60), 2);
    hms = `${hour}:${min}:${sec}`

    return hms;
}

/**
 * return a string of n digit of integer num,
 * adds '0's in from of num if num digit < n
 * @param {integer} num 
 * @param {integer} n 
 */
function toNDigits(num, n) {
    var result = `${num}`;
    let len = `${num}`.length;
    if (len < n) {
        for (var i = len; i < n; i++) {
            result = '0' + result;
        }
    }

    return result;
}

// flowrate chart data iteration variable
var flowrateChart_i = 0;
var flowrateChart_time_last = 0;

/** Function to update the current flowrate graph
 * @param {*} time 
 * @param {*} flow 
 */
function updateFlowrateData(time, flow) {
    // update current flowrate 
    current_flow = flow;
    flowrate_arr[flowrateChart_i] = { x: time / 1000, y: flow };
    // update flowrate chart data
    flowrateChart.data.datasets[0].data = flowrate_arr;
    // moving time axis if flowrate data passed outside the current time range
    // range = 10 sec, range update every 2 sec
    if ((time / 1000 >= FLOWRATE_CHART_MAX_TIME) && (time / 1000 - flowrateChart_time_last >= 2)) {
        flowrateChart.options.scales.xAxes[0].ticks.min += 2;
        flowrateChart.options.scales.xAxes[0].ticks.max += 2;
        if (flowrateChart_time_last == 0) {
            flowrateChart_time_last = FLOWRATE_CHART_MAX_TIME;
        }
        else {
            flowrateChart_time_last += 2;
        }
    }
}

/** Function to update average flowrate graph
 * @param {*} time 
 * @param {*} flow 
 */
function updateAvgFlowrateData(time, flow) {
    average_flow = flow;
    avg_flowrate_arr[flowrateChart_i] = { x: time / 1000, y: flow };
    // update average flowrate
    // average_flow = ((average_flow * (flowrateChart_i) + current_flow) / (flowrateChart_i + 1)).toFixed(2);
    // update flowrate chart data
    flowrateChart.data.datasets[1].data = avg_flowrate_arr;
    // moving time axis if flowrate data passed outside the current time range
    // range = 10 sec, range update every 2 sec
    if ((time / 1000 >= FLOWRATE_CHART_MAX_TIME) && (time / 1000 - flowrateChart_time_last >= 2)) {
        flowrateChart.options.scales.xAxes[0].ticks.min += 2;
        flowrateChart.options.scales.xAxes[0].ticks.max += 2;
        if (flowrateChart_time_last == 0) {
            flowrateChart_time_last = FLOWRATE_CHART_MAX_TIME;
        }
        else {
            flowrateChart_time_last += 2;
        }
    }
    flowrateChart_i++;
}

/** Function to reset currently running sequence to the start of the sequence */
function resetRunningSequence() {
    if (isPaused) {
        running_sequence = 0; // sequence hasn't been started yet
        total_run_time = 0;
        last_total_run_time = 0;

        showSequenceInformation(1); // show the first sequence
        highlightRunningSequence();

        if (port_ready) {
            // sequence done
            sendEndSequenceCommand();
        }
    }
}

/** Function to close information window and return to the sequence input window */
function closeSequenceInformationWindow() {
    if (!isPaused) {
        // confirm exit if sequence information window is closed while pump is still running
        dialog.showMessageBox(remote.getCurrentWindow(), {
            type: 'warning',
            title: 'Confirmation',
            message: 'Pump is still running, stop the running sequence and go back?',
            buttons: ['Yes', 'No']
        }).then(result => {
            if (result.response == 0) {
                // stop the running pump before going back to seqeunce input window
                if (port_ready) {
                    sendEndSequenceCommand();
                }
            }
            else if (result.response == 1) {
                return;
            }
            else {
                return;
            }


            // return to sequence input// sequence done
            changeHomeWindowMode(0);
        })
    }
    else {
        // stop the running pump before going back to seqeunce input window
        if (port_ready) {
            sendEndSequenceCommand();
        }
        // return to sequence input
        changeHomeWindowMode(0);
    }
}

function changeHomeWindowMode(mode) {
    const seq_input_window = document.getElementById('seq-input-window');
    const seq_running_window = document.getElementById('seq-running-window');
    switch (mode) {
        // sequence input mode
        // showing the input window
        case 0:
            isSequenceRunning = false;
            seq_input_window.style.display = 'block';
            seq_running_window.style.display = 'none';
            break;
        // running sequence mode
        // showing the sequence information window
        case 1:
            showSequenceInformation(1);
            isSequenceRunning = true;
            seq_input_window.style.display = 'none';
            seq_running_window.style.display = 'block';
            break;
    }
}

/** Function to show running sequence data table */
function showRunningSequenceReview() {
    const run_seq_review = document.getElementById('run-seq-review');
    var review_text = '';

    for (var i = 0; i < sequence.length; i++) {
        if (sequence[i].pump == 0) { // show that the sequence is idle mode
            review_text += `<tr class="sequence-item" id="seq-run-${i + 1}">
            <td class="col-sequence sequence-item-item">${i + 1}</td>
            <td class="sequence-item-item">n/a</td>
            <td class="sequence-item-item">-</td>
            <td class="sequence-item-item">0</td>
            <td class="sequence-item-item">${sequence[i].dov}</td>
            <td class="sequence-item-item">-</td>
            </tr>`
        }
        else { // sequence run pump 1, 2, or 3
            if (sequence[i].dov_sel == 0) {
                review_text += `<tr class="sequence-item" id="seq-run-${i + 1}">
                <td class="col-sequence sequence-item-item">${i + 1}</td>
                <td class="sequence-item-item">${sequence[i].pump}</td>
                <td class="sequence-item-item">${sequence[i].dir}</td>
                <td class="sequence-item-item">${sequence[i].flowrate}</td>
                <td class="sequence-item-item">${sequence[i].dov}</td> 
                <td class="sequence-item-item">-</td>
                </tr>`
            }
            else {
                review_text += `<tr  class="sequence-item" id="seq-run-${i + 1}">
                <td class="col-sequence sequence-item-item">${i + 1}</td>
                <td class="sequence-item-item">${sequence[i].pump}</td>
                <td class="sequence-item-item">${sequence[i].dir}</td>
                <td class="sequence-item-item">${sequence[i].flowrate}</td>
                <td class="sequence-item-item">-</td>
                <td class="sequence-item-item">${sequence[i].dov}</td></tr>`
            }
        }
    }
    run_seq_review.innerHTML = review_text;
    highlightRunningSequence();
}


function highlightRunningSequence(n = running_sequence) {
    var sequence_element = document.getElementById(`seq-run-${n}`);

    // remove previous highlight
    if (previous_running_sequence != 0) {
        try {
            document.getElementById(`seq-run-${previous_running_sequence}`).style['background-color'] = '';
        } catch (error) { }
    }
    // highlight currently running sequence
    if (n > 0) {
        sequence_element.style['background-color'] = '#1094ec';
    }
    previous_running_sequence = running_sequence;
}



/**  Function to show all the currently running sequence's parameters 
 *   to the sequence information window */
function showSequenceInformation(n = running_sequence) {
    updateIsPausedStatus();
    document.getElementById('sequence-information-sequence').innerHTML = n;
    document.getElementById('sequence-information-pump').innerHTML = sequence[n - 1].pump;
    document.getElementById('sequence-information-direction').innerHTML =
        (sequence[n - 1].dir == 0 ? 'Forward' : 'Backward');

    document.getElementById('sequence-information-flowrate').innerHTML =
        (sequence[n - 1].pump == 3 ? '-' : sequence[n - 1].flowrate);

    document.getElementById('sequence-information-current-flowrate').innerHTML = 0;
    document.getElementById('sequence-information-average-flowrate').innerHTML = 0;
    if (sequence[n - 1].dov_sel == 0) { // sequence limited by duration
        document.getElementById('sequence-information-duration').innerHTML = secondToHMS(sequence[n - 1].dov);
        document.getElementById('sequence-information-time-elapsed').innerHTML = '00:00';
        document.getElementById('sequence-information-time-left').innerHTML = secondToHMS(sequence[n - 1].dov);
        document.getElementById('sequence-information-volume').innerHTML = '-';
        document.getElementById('sequence-information-volume-infused').innerHTML = 0;
        document.getElementById('sequence-information-volume-left').innerHTML = '-';
    }
    else { // limited by volume
        document.getElementById('sequence-information-duration').innerHTML = '-';
        document.getElementById('sequence-information-time-elapsed').innerHTML = '00:00';
        document.getElementById('sequence-information-time-left').innerHTML = '-';
        document.getElementById('sequence-information-volume').innerHTML = sequence[n - 1].dov;
        document.getElementById('sequence-information-volume-infused').innerHTML = 0;
        document.getElementById('sequence-information-volume-left').innerHTML = sequence[n - 1].dov;
    }
    document.getElementById('sequence-information-total-time-elapsed').innerHTML = '00:00';
}

/**
 * Function to update pump status and of whether it is paused or not
 * Update start/stop button based on whether it is paused or not
 */
function updateIsPausedStatus() {
    document.getElementById('sequence-information-status').innerHTML =
        (isPaused ? 'Paused' : 'Running');


    document.getElementById('start-stop-button').innerHTML =
        (isPaused ? 'Start' : 'Stop');
}

/**
 * Function called to show and save all available ports data into array port_list
 * Example of data extracted from a PORT
    comName: "COM18"
    path: "COM18"
    manufacturer: "FTDI"
    serialNumber: "A50285BI"
    pnpId: "FTDIBUS\VID_0403+PID_6001+A50285BIA\0000"
    locationId: undefined
    vendorId: "0403"
    productId: "6001"
 */
function getAndShowPortList() {
    var new_port = 1;
    var port_exist = 0;
    var selected_port_exist = 0;
    var current_port_connection = port_open;
    const port_holder = document.getElementById('portlist');
    const status_port = document.getElementById('status-port-text');
    var port_text = '';

    SerialPort.list().then(
        ports => {
            port_list = [];
            ports.forEach(port => {
                if (typeof (port.serialNumber) != 'undefined') {
                    // check if port is a suitable microfluidic pump device
                    if (port.serialNumber.startsWith(SERIAL_NUMBER)) {
                        port_list.push(port);
                    }
                }
            });
            // show available ports if at least one port exists
            if (port_list.length > 0) {
                port_list.forEach(port => {
                    port_text += `<a href="#" class="portlist-item" id="${port.path.toLowerCase()}"
                 onclick="selectPort('${port.path}');">
                <li class="portlist-item-item">
                PORT: ${port.path}<br>\n
                Serial: ${port.serialNumber}</li></a>\n`;
                })
            }
            else { // no device detected
                port_text += `<p style="color: #cc3333;">No FIAPump device detected.</p>`;
            }

            if (current_port_connection == 0) {
                if (selected_port == '') {
                    status_port.innerHTML = `No PORT connected`;
                    status_port.style = 'color: #dddddd;';
                }
                else {
                    status_port.innerHTML = `Disconnected | ${selected_port}`;
                    status_port.style = 'color: #ff0000;';
                }
            }

            // print all available
            port_holder.innerHTML = port_text;
            if ((selected_port != '') &&
                ((current_port_connection == 1) || (port_connecting))) {
                try {
                    document.getElementById(`${selected_port.toLowerCase()}`).style['background-color'] = '#1094ec';
                } catch (error) { }
            }

        }
    );
    console.log('port refreshed');
}



function selectPort(port_path) {
    const port_element = document.getElementById(`${port_path.toLowerCase()}`); // selected port from port list
    const status_port = document.getElementById('status-port-text');

    if ((selected_port != port_path) || (!port_open)) {
        try {
            document.getElementById(`${selected_port.toLowerCase()}`).style['background-color'] = '';
        } catch (error) { }
        status_port.innerHTML = `Connecting | ${port_path}`;
        status_port.style = 'color: #dddddd;';

        selected_port = port_path;
        connectToPort();
        port_element.style['background-color'] = '#1094ec';
    }
}
/**
 * Change input shown based on whether user selected volume or duration.
 */
function volDurSelect() {
    var val = document.getElementById('voldur').value;

    if (val == 0) {
        document.getElementById('durationinput').style = 'display: block';
        document.getElementById('volumeinput').style = 'display: none';
    }
    else {
        document.getElementById('durationinput').style = 'display: none';
        document.getElementById('volumeinput').style = 'display: block';
    }
}

function pumpSelect(n) {
    var flowrate_input = document.getElementById('flow-input');
    var direction_input = document.getElementById('dir-input')
    var voldur_select = document.getElementById('voldur_container');
    var volume_input = document.getElementById('volumeinput');
    var duration_input = document.getElementById('durationinput');

    if (n == 0) { // idle mode selected, show only duration input
        flowrate_input.style = 'display: none';
        direction_input.style = 'display: none';
        voldur_select.style = 'display: none';
        volume_input.style = 'display: none';
        duration_input.style = 'display: block';
        //voldur value = 0
    }
    else if (n == 3) { //pump 3 selected, show only direction and duration input
        flowrate_input.style = 'display: none';
        direction_input.style = 'display: block';
        voldur_select.style = 'display: none';
        volume_input.style = 'display: none';
        duration_input.style = 'display: block';
    }
    else { //pump 1 or 2 selected
        direction_input.style = 'display: block';
        flowrate_input.style = 'display: block';
        voldur_select.style = 'display: block';
        volDurSelect();
    }
}

/**
 * Change highlighted sidebar menu based on the menu selected
 * @param {*} menu 
 */
function sidebarMenuSelected(menu) {
    var home_icon = document.getElementById('icon-home');
    var setup_icon = document.getElementById('icon-setup');
    var home_white = 'resources/icons/home-icon-white.svg';
    var home_black = 'resources/icons/home-icon-black.svg';
    var setup_white = 'resources/icons/settings-icon-white.svg';
    var setup_black = 'resources/icons/settings-icon-black.svg';

    const page = document.getElementById(`menu${menu}`);

    for (var i = 1; i < SIDEBAR_MENU_N + 1; i++) {
        document.getElementById(`menu${i}`).style['background-color'] = '';
        document.getElementById(`menu${i}`).style['color'] = '#000000';
    }

    page.style['background-color'] = '#1094ec';
    page.style['color'] = '#ffffff';

    switch (menu) {
        case 1:
            home_icon.style.background = `url('${home_white}')`;
            setup_icon.style.background = `url('${setup_black}')`;
            break;
        case 2:
            home_icon.style.background = `url('${home_black}')`;
            setup_icon.style.background = `url('${setup_white}')`;
            break;
    }
}

function openPage(page) {
    const window1 = document.getElementById('home-window');
    const window2 = document.getElementById('settings-window');

    if (typeof openPage.current_page == 'undefined') {
        openPage.current_page = 1;
    }
    if (openPage.current_page != page) {
        openPage.current_page = page;
        switch (page) {
            case 1: // main sequence page
                turnOffAutoRefreshPortList();
                window1.style.display = 'block';
                window2.style.display = 'none';
                break;
            case 2: // settings page
                turnOnAutoRefreshPortList();
                getAndShowPortList();
                window1.style.display = 'none';
                window2.style.display = 'block';
                break;
            default:
                break;
        }
    }
}

function turnOnAutoRefreshPortList() {
    // Refresh available port every few seconds
    port_auto_refresh = setInterval(() => {
        getAndShowPortList();
    }, PORT_LIST_REFRESH_RATE * 1000);
}

function turnOffAutoRefreshPortList() {
    if (port_auto_refresh != null) {
        try {
            clearInterval(port_auto_refresh);
        } catch (error) { }
    }
}

/**
 * Add user's input to the sequence array
 * @param {*} i 
 * @param {*} pump 
 * @param {*} dir 
 * @param {*} flowrate 
 * @param {*} dov_sel 
 * @param {*} dov 
 */
function saveSequence(i, pump, dir, flowrate, dov_sel, dov) {
    const n = sequence.length;
    const newseq = { pump: pump, dir: dir, flowrate: flowrate, dov_sel: dov_sel, dov: dov };
    if (i > n) {
        sequence.push(newseq); // push new sequence data to the end of sequence array
    }
    else { // push new sequence data to index i in the array, shift the rest
        var newarr = sequence.slice(0, i - 1);
        const temparr = sequence.slice(i);
        newarr.push(newseq);
        sequence = newarr.concat(temparr);
    }
}

/** Function called when add sequence button is pressed */
function saveSequenceButton() {
    var error_message = document.getElementById('error-message');
    var temp_error_message = '';

    var i = current_selected_sequence;
    var pump_el = document.getElementsByName('pump');
    var pump;
    var dir_el = document.getElementsByName('dir');
    var dir;
    var flowrate = parseInt(document.getElementById('flowrate').value);
    var dov_sel_el = document.getElementById('voldur');
    var dov_sel = dov_sel_el.options[dov_sel_el.selectedIndex].value;
    var dov;

    resetInvalidInputMessage();

    // get selected pump
    for (var j = 0; j < pump_el.length; j++) {
        if (pump_el[j].checked) {
            pump = pump_el[j].value;
        }
    }
    // get selected direction
    for (var j = 0; j < dir_el.length; j++) {
        if (dir_el[j].checked) {
            dir = dir_el[j].value;
        }
    }
    // pump = 0 -> idle
    if ((pump == 0) || (pump == 3)) {
        flowrate = 0;
        dov_sel = 0;
        if (pump == 0) {
            dir = 0;
        }
        dov = parseInt(document.getElementById('duration').value);
        // validate input values
        if ((dov != '') && (dov > 0) && (dov <= MAX_DURATION)) {
            isInputValid = true;
            saveSequence(i, pump, dir, flowrate, dov_sel, dov);
            updateSequenceReview();
        }
        else { //duration value invalid
            isInputValid = false;
            error_message.innerHTML =
                `! Duration input value must be between 1 to ${MAX_DURATION} !`;
        }
    }
    else { // pump = 1, 2, or 3
        if (dov_sel == 0) {
            dov = parseInt(document.getElementById('duration').value);

            // validate input values
            if (((dov != '') && (dov > 0) && (dov <= MAX_DURATION)) &&
                ((flowrate != '') && (flowrate > 0) && (flowrate < MAX_FLOWRATE))) {
                isInputValid = true;
                saveSequence(i, pump, dir, flowrate, dov_sel, dov);
                updateSequenceReview();
            }
            else { // invalid input
                isInputValid = false;
                if (!((flowrate != '') && (flowrate > 0) && (flowrate < MAX_FLOWRATE))) {
                    temp_error_message =
                        `! Flowrate input value must be between 1 to ${MAX_FLOWRATE} !`;
                }
                if (!((dov != '') && (dov > 0) && (dov <= MAX_DURATION))) {
                    temp_error_message +=
                        `<br>! Duration input value must be between 1 to ${MAX_DURATION} ! `;
                }
                error_message.innerHTML = temp_error_message;
            }
        }
        else {
            dov = parseInt(document.getElementById('volume').value);
            // validate input values
            if (((dov != '') && (dov > 0) && (dov <= MAX_DURATION)) &&
                ((flowrate != '') && (flowrate > 0) && (flowrate < MAX_FLOWRATE))) {
                isInputValid = true;
                saveSequence(i, pump, dir, flowrate, dov_sel, dov);
                updateSequenceReview();
            }
            else { // invalid input
                isInputValid = false;
                if (!((flowrate != '') && (flowrate > 0) && (flowrate < MAX_FLOWRATE))) {
                    temp_error_message = `! Flowrate input value must be between 1 to ${MAX_FLOWRATE} !`;
                }
                if (!((dov != '') && (dov > 0) && (dov <= MAX_VOLUME))) {
                    temp_error_message += `<br>! Volume input value must be between 1 to ${MAX_DURATION} ! `;
                }
                error_message.innerHTML = temp_error_message;
            }
        }
    }
}

/** Function to reset/clear the invalid input message alert */
function resetInvalidInputMessage() {
    document.getElementById('error-message').innerHTML = '';
}


/** Function to save current sequence and add a new sequence*/
function addAndSaveSequenceButton() {
    saveSequenceButton();
    if (isInputValid) {
        current_selected_sequence += 1;
        createNewSequence(current_selected_sequence);
        updateSequenceReview();
    }
}

/** Function called to update and show the full list of the sequence  */
function updateSequenceReview() {
    const review = document.getElementById('seq_review');
    var review_text = '';

    for (var i = 0; i < sequence.length; i++) {

        if (sequence[i].pump == 0) { // show that the sequence is idle mode
            review_text += `<tr class="sequence-item" id="seq${i + 1}"
            onclick="selectSequence(${i + 1});">
            <td class="col-sequence sequence-item-item">${i + 1}</td>
            <td class="sequence-item-item">n/a</td>
            <td class="sequence-item-item">-</td>
            <td class="sequence-item-item">0</td>
            <td class="sequence-item-item">${sequence[i].dov}</td>
            <td class="sequence-item-item">-</td>
            </tr>`
        }
        else if (sequence[i].pump == 3) {
            review_text += `<tr  class="sequence-item" id="seq${i + 1}"
                onclick="selectSequence(${i + 1});">
                <td class="col-sequence sequence-item-item">${i + 1}</td>
                <td class="sequence-item-item">${sequence[i].pump}</td>
                <td class="sequence-item-item">${sequence[i].dir}</td>
                <td class="sequence-item-item">-</td>
                <td class="sequence-item-item">${sequence[i].dov}</td>
                <td class="sequence-item-item">-</td></tr>`
        }
        else { // sequence run pump 1 or 2
            if (sequence[i].dov_sel == 0) {
                review_text += `<tr class="sequence-item" id="seq${i + 1}"
                onclick="selectSequence(${i + 1});">
                <td class="col-sequence sequence-item-item">${i + 1}</td>
                <td class="sequence-item-item">${sequence[i].pump}</td>
                <td class="sequence-item-item">${sequence[i].dir}</td>
                <td class="sequence-item-item">${sequence[i].flowrate}</td>
                <td class="sequence-item-item">${sequence[i].dov}</td> 
                <td class="sequence-item-item">-</td>
                </tr>`
            }
            else {
                review_text += `<tr  class="sequence-item" id="seq${i + 1}"
                onclick="selectSequence(${i + 1});">
                <td class="col-sequence sequence-item-item">${i + 1}</td>
                <td class="sequence-item-item">${sequence[i].pump}</td>
                <td class="sequence-item-item">${sequence[i].dir}</td>
                <td class="sequence-item-item">${sequence[i].flowrate}</td>
                <td class="sequence-item-item">-</td>
                <td class="sequence-item-item">${sequence[i].dov}</td></tr>`
            }
        }
    }
    review.innerHTML = review_text;
    selectSequence(current_selected_sequence);
}


/** Function to delete selected sequence
 * @param {*} n 
 */
function deleteSequence(n = current_selected_sequence) {
    if (sequence.length > 1) {
        sequence.splice(n - 1, 1); //delete selected seq

        if (n >= sequence.length) { // deleted sequence is the last sequence
            current_selected_sequence = sequence.length;
        }
        updateSequenceReview(); //update sequence list
    }
}

/** Function to delete all sequences/ reset all sequence input */
function deleteAllSequence() {
    sequence = [];
    createNewSequence();
    current_selected_sequence = 1;
    updateSequenceReview();
}

/** Function called when delete all button is clicked */
function deleteAllSequenceButton() {
    // get user's confirmation to delete all sequence
    dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'warning',
        title: 'Confirm delete',
        message: 'Delete all sequence data?',
        buttons: ['Yes', 'No']
    }).then(result => {
        if (result.response == 0) { // user clicked 'Yes' button
            deleteAllSequence();
        }
        else { // user clicked 'No' button
            return;
        }
    });

}
/** Function to create a new sequence after the currently selected sequence
 * @param {*} n 
 */
function createNewSequence(n = current_selected_sequence) {
    var temparr = sequence.slice(n - 1);
    // fill the default parameters on the new seqeunce
    saveSequence(i = n, pump = 1, dir = 0, flowrate = 0, dov_sel = 0, dov = 0);
    sequence = sequence.slice(0, n).concat(temparr);
}

function createNewSequenceButton() {
    current_selected_sequence += 1;
    createNewSequence();
    updateSequenceReview();
}


/** Show all the currently selected sequence parameter in the edit window
 * @param {*} n 
 */
function editSequence(n = current_selected_sequence) {
    pumpSelect(sequence[n - 1].pump);
    document.getElementById('sequence-label').innerHTML = `Sequence ${n}`;
    document.getElementById(`pump${sequence[n - 1].pump}`).checked = true;
    document.getElementById(`dir${sequence[n - 1].dir}`).checked = true;
    document.getElementById('flowrate').value = sequence[n - 1].flowrate;
    document.getElementById('voldur').value = `${sequence[n - 1].dov_sel}`;
    volDurSelect();
    if (sequence[n - 1].dov_sel == 0) { // duration based
        document.getElementById('duration').value = sequence[n - 1].dov;
        document.getElementById('volume').value = 0;
    } else { // volume based
        document.getElementById('duration').value = 0;
        document.getElementById('volume').value = sequence[n - 1].dov;
    }
}

/**
 * Select sequence n, highlight it in the sequence list and show its parameter in the edit window
 * @param {*} n 
 */
function selectSequence(n) {
    // remove previous invalid messages
    resetInvalidInputMessage();
    // remove highlight from sequence selected before
    try {
        document.getElementById(`seq${current_selected_sequence}`).style['background-color'] = '';
    } catch (error) { }
    //highlight newly selected sequence
    highlightSequence(n);
    current_selected_sequence = n; // newly selected sequence
    editSequence(); // show selected sequence data in the input sequence form
}

function highlightSequence(n) {
    var sequence_element;
    if (n <= sequence.length) {
        sequence_element = document.getElementById(`seq${n}`);
    }
    else {
        sequence_element = document.getElementById(`seq${sequence.length}`);
    }
    sequence_element.style['background-color'] = '#1094ec';
}