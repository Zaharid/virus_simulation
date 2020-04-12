import {Simulation, Config} from  "../pkg/index.js";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


let simulation = null;
let time = null;


let timeoutID = null;

let last_received_time = null;
let queue_full = false;
let isPaused = true;

async function init(args){
	time = 0;
	last_received_time = 0;
	simulation = Simulation.from_js(args);
	if (simulation===null){
		throw new Error("Invalid simulation configuation");
	}
	postMessage({"type": "STARTED"});
	isPaused = false;
	await sleep(0);
	postMessage({
		"type": "COUNTER_DATA",
		"args": {
			"time": time,
			"counter_output": simulation.get_counter(),
			"hospital_capacity": simulation.get_hospital_capacity()
		}
	});
	await sleep(0);
	run();
}


function resume(){
	isPaused = false;
	timeoutID = setTimeout(run);
	postMessage({"type": "STARTED"});
}

function pause(){
	isPaused = true;
	clearTimeout(timeoutID);
	postMessage({"type": "PAUSED"});
}

function run(){
	simulation.tick();
	time++;
	postMessage({
		"type": "COUNTER_DATA",
		"args": {
			"time": time,
			"counter_output": simulation.get_counter(),
			"hospital_capacity": simulation.get_hospital_capacity()
		}
	});
	if (time - last_received_time > 20){
		queue_full = true;
		timeoutID = null;
		return;
	}
	timeoutID = setTimeout(run);
}




onmessage = function(e){
	let msg = e.data;
	let tp = msg.type;
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
		case "ACK":
			last_received_time = msg.args;
			if(queue_full && time - last_received_time < 20){
				queue_full = false;
				if(!isPaused){
					timeoutID = setTimeout(run);
				}
			}
			break;
	}
}

postMessage({"type": "DEFAULT_CONFIG", "args": {"config": Config.default_config()}});
