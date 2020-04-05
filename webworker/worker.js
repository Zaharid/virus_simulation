import {Simulation, Config} from  "../pkg/index.js";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


let simulation = null;
let time = null;

function push_counter(){
	let plot_values = [];
	let counter_output = simulation.get_counter();
	//Todo find a better way to represent plotting data
	for (let [key, value] of Object.entries(counter_output)){
		plot_values.push({"time": time, "population": key, "value": value});
	}
	//display.innerHTML = JSON.stringify(counter_output, null, 4);
	return plot_values;
}


let timeoutID = null;

async function init(args){
	time = 0;
	simulation = Simulation.new(...args);
	postMessage({"type": "STARTED"});
	await sleep(0);
	postMessage({"type": "COUNTER_DATA", "args": {"counter_output": simulation.get_counter()}});
	await sleep(0);
	run();
}


function resume(){
	timeoutID = setTimeout(run);
	postMessage({"type": "STARTED"});
}

function pause(){
	clearTimeout(timeoutID);
	postMessage({"type": "STOPPED"});
}

function run(){
	simulation.tick();
	postMessage({"type": "COUNTER_DATA", "args": {"counter_output": simulation.get_counter(), "time": time}});
	time++;
	timeoutID = setTimeout(run);
}

onmessage = function(e){
	console.log("Got some message");
	let msg = e.data;
	let tp = msg.type;
	console.log(tp);
	switch (tp){
		case "GET_DEFAULT_CONFIG":
			postMessage({"type": "DEFAULT_CONFIG", "args": {"config": Config.default_config()}});
			break;
		case "INIT":
		    init(msg.args);
		    break;
		case "PAUSE":
		    pause();
			break;
		case "RESUME":
		    resume();
			break;
	}
}

postMessage({"type": "DEFAULT_CONFIG", "args": {"config": Config.default_config()}});
