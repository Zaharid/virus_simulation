import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';


import vegaEmbed from 'vega-embed'

const display = document.getElementById("display");
const plot_display = document.getElementById("vis");
const severe_display = document.getElementById("severe-vis");
const playPauseButton = document.getElementById("play-pause");


let view = null;
let severe_view = null;

const categories = ["Severe", "Dead", "Infected (Undetected)", "Infected (Detected)", "Inmune", "Susceptible"];

const spec = {"$schema": "https://vega.github.io/schema/vega-lite/v4.json",
  "data": {"name": "mydata"},
  "width": 350,
  "height": 250,


  "transform": [
	  {"calculate": 'indexof(["Severe", "Dead", "Infected (Undetected)", "Infected (Detected)", "Inmune", "Susceptible"], datum.population)',
	   "as": "cat_order"}
  ],
  "mark": {
	  "type": "area",
  },
  "encoding": {
    "x": {
      "field": "time",
      "type": "quantitative",
	  "title": "days"
    },
    "color": {
      "field": "population",
      "type": "nominal",
      "sort": categories,
      "scale": {
		  "domain": categories,
		  "range": ["#e7298a", "#666666", "#d95f02", "#e6ab02", "#66a61e", "#1b9e77"]},
    },
    "y": {
      "field": "value",
	  "title": "Population count",
      "type": "quantitative",
      "stack": true,
      //"scale": {"type": "symlog", "constant": 1},
	  "scale": {"domain": [0,300000]}//,
      //"axis": {"values": [0, 50000, 100000, 150000, 200000, 250000, 300000]}
    },
	"order": {"field": "cat_order", "type": "quantitative"},
    "tooltip": [
		  {"field": "time", "type": "quantitative", "title": "day"},
		  {"field": "population", "type": "ordinal", "title": "Group"},
		  {"field": "value", "type": "quantitative", "title": "Population count"}
	  ]
	//"y2": {"field": "v2"}
  }
}

const severe_spec = {"$schema": "https://vega.github.io/schema/vega-lite/v4.json",
	"data": {"name": "mydata"},
	"transform": [{"filter": "datum.population === 'Severe'"}],
	"width": 350,
	"height": 250,
	"layer":[{
		"mark": "line",
		"encoding": {
			"x": {
				"field": "time",
				"type": "quantitative",
				"title": "days"
			},
			"y": {
				"field": "value",
				"type": "quantitative",
				"title": "Severe patients"
			}
		}
	},
	{
		"mark": "rule",
		"data": {"values": {"threshold": 2000}},
		"encoding": {
			"y": {
				"field": "threshold",
				"type": "quantitative",
				"title": "Maximum hospital capacity"
			},
			"color": {"value": "red"}
		}
	}
	]
}



let plot_values = []; //spec["data"]["values"];

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
			spec,
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
	let counter_output = data.counter_output;
	//Todo find a better way to represent plotting data
	for (let [key, value] of Object.entries(counter_output)){
		plot_values.push({"time": data.time, "population": key, "value": value});
	}
}


playPauseButton.textContent = "▶";

function handleIncomingData(data){
	push_counter(data);
	display.innerHTML = JSON.stringify(data.counter_output, null, 4);
	view.insert("mydata", plot_values).run();
	severe_view.insert("mydata", plot_values).run();
}

worker.onmessage = function(e){
	let msg = e.data;
	let tp = msg.type;
	switch (tp){
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
