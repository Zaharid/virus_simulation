import {Simulation, Config} from  "../pkg/index.js";


const NAMES = [
    "Susceptible",
    "Infected (Undetected)",
    "Infected (Detected)",
    "Severe",
    "Unattended",
    "Immune (Undetected)",
    "Immune (Detected)",
    "Dead",
];


function make_counter_data(arr){
	let obj = {};
	NAMES.forEach((name, i) => {
		obj[name] = arr[i];
	});
	return obj;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


let simulation = null;
let policies = null;
let reverse_policies = null;

let timeoutID = null;

let last_received_time = null;
let queue_full = false;
let isPaused = true;



async function init(args){
	last_received_time = 0;
	let config = args.config;
    policies = args.policies;
    reverse_policies = [];
	simulation = Simulation.from_js(config);
	if (simulation===null){
		throw new Error("Invalid simulation configuation");
	}
	postMessage({"type": "STARTED"});
	isPaused = false;
	await sleep(0);
	let raw_counter_data = simulation.get_counter();
	let abs_counter_output = make_counter_data(raw_counter_data.abs_counter);
	let day_counter_output = make_counter_data(raw_counter_data.day_counter);
	postMessage({
		"type": "COUNTER_DATA",
		"args": {
			"time": simulation.get_time(),
			"abs_counter_output": abs_counter_output,
			"day_counter_output": day_counter_output,
			"hospital_capacity": simulation.get_hospital_capacity(),
            "day_r": simulation.get_daily_r(),
            "day_serial": simulation.get_daily_serial_interval(),
		}
	});
	//Actually send messages
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
    "<=": (a,b) => (a <= b),
    "==": (a,b) => (a === b),
}

function runPolicy(policy, data){
	switch (policy){
		case "shut-workplaces":
			simulation.disable_fraction_of_workplaces(data.workplaces);
			break
		case "social-distancing":
			simulation.multiply_undetected_workplace_infectability(1 - data["workplace-reduction"]);
			simulation.multiply_undetected_world_infectability(1 - data["world-reduction"]);
			break
        case "lockdown":
            simulation.disable_fraction_of_world_connections(data["connections_cut_fraction"])
            break
        case "contact-tracing":
            simulation.set_max_contact_tracing(data["max_daily_tests"]);
            break;
        case "enhanced-self-isolation":
            simulation.multiply_detected_household_infectability(1 - data["household-reduction"]);
            simulation.multiply_detected_workplace_infectability(1 - data["workplace-reduction"]);
            simulation.multiply_detected_world_infectability(1 - data["world-reduction"]);
            break;
     }

}

function reversePolicy(policy, data){
	switch (policy){
		case "shut-workplaces":
			simulation.undo_disable_fraction_of_workplaces(data.workplaces);
			break
		case "social-distancing":
			simulation.undo_multiply_undetected_workplace_infectability(1 - data["workplace-reduction"]);
			simulation.undo_multiply_undetected_world_infectability(1 - data["world-reduction"]);
			break
        case "lockdown":
            simulation.undo_disable_fraction_of_world_connections(data["connections_cut_fraction"])
            break
        case "contact-tracing":
            simulation.undo_set_max_contact_tracing(data["max_daily_tests"]);
            break;
        case "enhanced-self-isolation":
            simulation.undo_multiply_detected_household_infectability(1 - data["household-reduction"]);
            simulation.undo_multiply_detected_workplace_infectability(1 - data["workplace-reduction"]);
            simulation.undo_multiply_detected_world_infectability(1 - data["world-reduction"]);
            break;
     }

}


function checkTrigger(obj, trigger){
	let op = ops[trigger["trigger-operator"]];
	let v = obj[trigger["trigger-variable"]];
	let c = trigger["trigger-value"];
	return op(v, c);
}

function run(){
	simulation.tick();
	let time = simulation.get_time();
	let raw_counter_data = simulation.get_counter();
	let abs_counter_output = make_counter_data(raw_counter_data.abs_counter);
	let day_counter_output = make_counter_data(raw_counter_data.day_counter);
	postMessage({
		"type": "COUNTER_DATA",
		"args": {
			"time": time,
			"abs_counter_output": abs_counter_output,
			"day_counter_output": day_counter_output,
			"hospital_capacity": simulation.get_hospital_capacity(),
            "day_r": simulation.get_daily_r(),
            "day_serial": simulation.get_daily_serial_interval(),
		}
	});


	let newpolocies = [];
    let cmpobj = {time: time, ...abs_counter_output};
	for (let p of policies){
		if (checkTrigger(cmpobj, p.trigger)){
			runPolicy(p.policy, p.data);
			postMessage({
				"type": "POLICY_APPLIED",
				"args": {time: time, policy: p.policy, event: "applied",}
			});
            if (p.shutdown["trigger-variable"] !== "permanent"){
                if (p.shutdown["trigger-variable"] === "duration"){
                    p.shutdown["trigger-variable"] = "time";
                    p.shutdown["trigger-value"] += time;
                }
                reverse_policies.push(p);
            }
		}else{
			newpolocies.push(p);
		}
	}
	policies = newpolocies;

    let new_reverse_policies = [];
    for (let p of reverse_policies){
        if(checkTrigger(cmpobj, p.shutdown)){
            reversePolicy(p.policy, p.data);
            postMessage({
                "type": "POLICY_REVERSED",
                "args": {time: time, policy: p.policy, event: "reversed"}
            });
            if (p.shutdown.recurrent){
                policies.push(p);
            }
        }else{
            new_reverse_policies.push(p);
        }
    }
    reverse_policies = new_reverse_policies;


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
			if(queue_full && simulation.get_time() - last_received_time < 20){
				queue_full = false;
				if(!isPaused){
					timeoutID = setTimeout(run);
				}
			}
			break;
	}
}

postMessage({"type": "DEFAULT_CONFIG", "args": {"config": Config.default_config()}});
