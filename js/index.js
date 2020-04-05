import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';


import vegaEmbed from 'vega-embed';

import {population_spec, severe_spec} from "./plot_specs.js"
import {fillConfigForm} from './forms.js';


const display = document.getElementById("display");
const plot_display = document.getElementById("vis");
const severe_display = document.getElementById("severe-vis");
const playPauseButton = document.getElementById("play-pause");


let view = null;
let severe_view = null;


let worker = new Worker("./worker.js");

let initialized = false;

let isPaused = true;
let isStarted = false;

async function init(){
	display.innerHTML = "Preparing simulation...";
	worker.postMessage({"type": "INIT", "args": [300000, 2000, 0.0001, 0.8, 20, 2000]});
	const opts = {"mode": "vega-lite", "padding":{"left": 20, "top": 5, right: 5, "bottom": 20}, "actions": false};
	view = (
		await vegaEmbed(
			"#vis",
			population_spec,
			opts
			)
	).view;

	severe_view = (
		await vegaEmbed(
			"#vis-severe",
			severe_spec,
			opts
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
}

function pause(event){
	worker.postMessage({"type": "PAUSE"});
	playPauseButton.disabled = true;
}





playPauseButton.addEventListener("click", event => {
	if (isPaused){
		play(event);
	}else{
		pause(event);
	}
})


function push_counter(data){
	let plot_values = [];
	let counter_output = data.counter_output;
	//Todo find a better way to represent plotting data
	for (let [key, value] of Object.entries(counter_output)){
		plot_values.push({"time": data.time, "population": key, "value": value});
	}
	return plot_values;
}


playPauseButton.textContent = "▶";

let stopped_once = false;

function handleIncomingData(data){
	let plot_values = push_counter(data);
	display.innerHTML = JSON.stringify(data.counter_output, null, 4);
	view.insert("mydata", plot_values).run();
	severe_view.insert("mydata", plot_values).run();
	if (
		!stopped_once &&
		data.counter_output["Infected (Undetected)"] + data.counter_output["Infected (Detected)"] === 0
	){
		pause();
		stopped_once = true;
	}
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

		    break;
		case "COUNTER_DATA":
			 handleIncomingData(msg.args);
		     break;
		case "STOPPED":
		    isPaused = true;
			playPauseButton.textContent = "▶";
			playPauseButton.disabled = false;
			break;
	}
}

worker.onerror = function(e){
	console.log(e);

}


