import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';


import $ from "jquery";
import vegaEmbed from 'vega-embed';


import {population_spec, severe_spec} from "./plot_specs.js"
import {fillConfigForm, getConfig} from './forms.js';
import {getPolicies} from './policy_forms.js'


const display = document.getElementById("display");
const plot_display = document.getElementById("vis");
const severe_display = document.getElementById("severe-vis");
const playPauseButton = document.getElementById("play-pause");
const resetButton = document.getElementById("reset");


let view = null;
let severe_view = null;


let worker = new Worker("./worker.js");

let initialized = false;

let isPaused = true;
let isStarted = false;

for (let ele of document.querySelectorAll(".anchor-link")){
	ele.addEventListener("click", (e) => {
		let ele = e.target;
		let dest = document.querySelector(ele.getAttribute('href'));
		let collapse = null;
		if (ele.hasAttribute("data-target")){
			collapse = ele.getAttribute("data-target");
		}else{
			collapse = dest.closest(".collapse");
		}
		if (collapse){
			$(collapse).one("shown.bs.collapse", (_) => dest.scrollIntoView());
			$(collapse).collapse("show");
		}
	});
}


function endStyles(){
	playPauseButton.classList.remove("btn-primary");
	playPauseButton.classList.add("btn-secondary");
	resetButton.classList.add("btn-primary");
	resetButton.classList.remove("btn-secondary");
}

function initStyles(){
	resetButton.classList.remove("btn-primary");
	resetButton.classList.add("btn-secondary");
	playPauseButton.classList.add("btn-primary");
	playPauseButton.classList.remove("btn-secondary");
}

async function init(){
	stopped_once = false;
	display.innerHTML = "Preparing simulation...";
	let policies = getPolicies();
	let config = getConfig();
	worker.postMessage({"type": "INIT", "args": {"config": config, "policies": policies}});
	const opts = {
		"mode": "vega-lite",
		"padding":{"left": 25, "top": 5, right: 5, "bottom": 20},
		"actions": false
	};
	view = (
		await vegaEmbed(
			"#vis",
			population_spec(config.total_population),
			opts
			)
	).view;

    //For some reason the severe plot wants a different padding
	const severe_opts = {
		"mode": "vega-lite",
		"padding":{"left": 40, "top": 5, right: 5, "bottom": 20},
		"actions": false
	};

	severe_view = (
		await vegaEmbed(
			"#vis-severe",
			severe_spec,
			severe_opts
			)
	).view;

}

function play(event){
	if (!isStarted){
		init();
		event.target.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span class="sr-only">Loading...</span>`;
		isStarted = true;
	}else{
		worker.postMessage({"type": "RESUME"});
	}
	playPauseButton.disabled = true;
	resetButton.disabled = true;
}

function pause(event){
	worker.postMessage({"type": "PAUSE"});
	playPauseButton.disabled = true;
}

function reset(){
	initStyles();
	pause();
	isStarted = false;
	resetButton.disabled = true;
}




playPauseButton.addEventListener("click", event => {
	if (isPaused){
		play(event);
	}else{
		pause(event);
	}
})


resetButton.addEventListener("click", reset);



function push_counter(data){
	let plot_values = [];
	let counter_output = data.counter_output;
	//Todo find a better way to represent plotting data
	for (let [key, value] of Object.entries(counter_output)){
		plot_values.push(
			{"time": data.time, "population": key, "value": value}
		);
	}
	return plot_values;
}

function push_severe(data){
	//TODO: See if there is a way to do this without current_capacity
	return [
		{
			"time": data.time, "kind": "Severe patients",
		    "value": data.counter_output["Severe"],
			"current_capacity": data.hospital_capacity
		},
		{"time": data.time, "kind": "Hospital capacity",  "value": data.hospital_capacity}
	];
}


playPauseButton.textContent = "▶";

let stopped_once = false;

function handleIncomingData(data){
	//Merge severe and unattended for simplicity of reportying
	if (data.counter_output["Unattended"] > 0){
		data.counter_output["Severe"] += data.counter_output["Unattended"];
	}
	delete data.counter_output["Unattended"];
	let plot_values = push_counter(data);
	display.innerHTML = JSON.stringify(data.counter_output, null, 4);
	view.insert("mydata", plot_values).run();
	severe_view.insert("mydata", push_severe(data)).run();
	if(data.time % 10 === 0){
		worker.postMessage({"type": "ACK", "args": data.time});
	}
	if (
		!stopped_once &&
		data.counter_output["Infected (Undetected)"] + data.counter_output["Infected (Detected)"] === 0
	){
		pause();
		endStyles();
		stopped_once = true;
	}
}

function handlePolicyData(data){
	severe_view.insert("policy_data", data).run();
	view.insert("policy_data", data).run();
}

worker.onmessage = function(e){
	let msg = e.data;
	let tp = msg.type;
	switch (tp){
		case "DEFAULT_CONFIG":
			fillConfigForm(msg.args.config);
			break;
		case "STARTED":
		    isPaused = false;
			playPauseButton.textContent = "⏸";
			playPauseButton.disabled = false;
			resetButton.disabled = false;
		    break;
		case "COUNTER_DATA":
			 handleIncomingData(msg.args);
		     break;
		case "PAUSED":
		    isPaused = true;
			playPauseButton.textContent = "▶";
			playPauseButton.disabled = false;
			break;
		case "POLICY_APPLIED":
			handlePolicyData(msg.args);
			break;
	}
}

worker.onerror = function(e){
	console.log(e);

}


