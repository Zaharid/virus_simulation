import {Simulation, Config} from  "../pkg/index.js";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


let simulation = null;
let policies = null;

let timeoutID = null;

let last_received_time = null;
let queue_full = false;
let isPaused = true;



async function init(args){
	last_received_time = 0;
	let config = args.config;
    policies = args.policies;
	simulation = Simulation.from_js(config);
	if (simulation===null){
		throw new Error("Invalid simulation configuation");
	}
	postMessage({"type": "STARTED"});
	isPaused = false;
	await sleep(0);
	postMessage({
		"type": "COUNTER_DATA",
		"args": {
			"time": simulation.get_time(),
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

const ops = {
    ">=": (a,b) => (a >= b),
    "<=": (a,b) => (a <= b)
}

function runPolicy(policy, data){
	console.log(policy, "<- TO BE APPLIED");
	switch (policy){
		case "shut-workplaces":
			simulation.disable_fraction_of_workplaces(data.workplaces);
			break
		case "social-distancing":
			simulation.multiply_workplace_infectability(1 - data["workplace-reduction"]);
			simulation.multiply_world_infectability(1 - data["world-reduction"]);
			break
	}

}

function checkTrigger(obj, trigger){
	let op = ops[trigger["trigger-operator"]];
	let v = obj[trigger["trigger-variable"]];
	let c = trigger["trigger-value"];
	console.log(op, v, c);
	return op(v, c);
}

function run(){
	simulation.tick();
	let time = simulation.get_time();
	let counter_data = simulation.get_counter();
	postMessage({
		"type": "COUNTER_DATA",
		"args": {
			"time": time,
			"counter_output": counter_data,
			"hospital_capacity": simulation.get_hospital_capacity()
		}
	});


	let newpolocies = [];
	for (let p of policies){
		if (checkTrigger(counter_data, p.trigger)){
			console.log(p, "POLICY OBJECT");
			runPolicy(p.policy, p.data);
			postMessage({
				"type": "POLICY_APPLIED",
				"args": {
					"time": time,
					"policy": p.policiy
				}
			})
		}else{
			newpolocies.push(p);
		}
	}
	policies = newpolocies;


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
			postMessage({
				"type": "DEFAULT_CONFIG", "args": {"config": Config.default_config()}
			});
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
