import {Simulation} from  "../pkg/index.js";

import vegaEmbed from 'vega-embed'

const display = document.getElementById("display");
const plot_display = document.getElementById("vis");
const severe_display = document.getElementById("severe-vis");
const playPauseButton = document.getElementById("play-pause");


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


let simulation = null;
let animationId = null;

function isPaused(){
	return animationId === null;
}

async function play(){
	if (simulation === null){
		await init();
	}
	playPauseButton.textContent = "⏸";
	renderLoop();
}

function pause(){
	playPauseButton.textContent = "▶";
	cancelAnimationFrame(animationId);
    animationId = null;
}

playPauseButton.addEventListener("click", event => {
	if (isPaused()){
		play();
	}else{
		pause();
	}
})


let view = null;
let severe_view = null;

let time = 0;

function push_counter(){
	let counter_output = simulation.get_counter();
	//Todo find a better way to represent plotting data
	for (let [key, value] of Object.entries(counter_output)){
		plot_values.push({"time": time, "population": key, "value": value});
	}
	display.innerHTML = JSON.stringify(counter_output, null, 4);
	time++;
}

async function init(){
	display.innerHTML = "Preparing simulation...";
	simulation = Simulation.new(300000, 2000, 0.0001, 0.8, 20, 30000000);
	push_counter();
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



const renderLoop = () => {
	simulation.tick();
	push_counter();
	animationId = requestAnimationFrame(renderLoop);
	view.insert("mydata", plot_values).run();
	severe_view.insert("mydata", plot_values).run();

}

playPauseButton.textContent = "▶";
