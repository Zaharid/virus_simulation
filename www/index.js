import {Simulation} from "graph";
//import {vegaEmbed} from '/vendor/vega/js/vega-embed.js'

const display = document.getElementById("display");
const plot_display = document.getElementById("vis");
const playPauseButton = document.getElementById("play-pause");



const spec = {"$schema": "https://vega.github.io/schema/vega-lite/v4.json",
  "data": {"name": "mydata"},
  "width": 700,
  "height": 500,

  /*
  "transform":[
	  //{ "calculate": 'datum.population', "as": "order"  },

	  {
		  "stack": "value",
		  "as": ["v1", "v2"],
		  "groupby": ["time"],
		  "sort": {"field": "population"}
	  }

  ],*/

  "mark": "area",
  "encoding": {
    "x": {
      "field": "time",
      "type": "quantitative"
    },
    "color": {
      "field": "population",
      "type": "nominal",
      "sort": ["Severe", "Dead", "Infected (Undetected)", "Infected (Detected)", "Inmune", "Healthy"],
      "scale": {"scheme": "category20"}
    },
    "y": {
      "field": "value",
      "type": "quantitative",
      "stack": true,
      "scale": {"type": "symlog", "constant": 1},
	  //"sort": "-color",
      "axis": {"values": [1, 10, 20, 100, 200, 1000, 2000, 10000, 20000, 100000, 200000, 300000]}
    },
	//"y2": {"field": "v2"}
  }
}

let plot_values = []; //spec["data"]["values"];


let simulation = null;
let animationId = null;

function isPaused(){
	return animationId === null;
}

function play(){
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

async function init(){
	display.innerHTML = "Preparing simulation...";
	simulation = Simulation.new(300000, 2000, 0.0001, 0.8, 100);
	view = (await vegaEmbed("#vis", spec, {"mode": "vega-lite"})).view;
	console.log(view);
	play();
}


let time = 0;

const renderLoop = () => {
	simulation.tick();
	time++;
	let counter_output = simulation.get_counter();
	//Todo find a better way to represent plotting data
	for (let [key, value] of Object.entries(counter_output)){
		plot_values.push({"time": time, "population": key, "value": value});
	}
	display.innerHTML = JSON.stringify(counter_output, null, 4);
	animationId = requestAnimationFrame(renderLoop);
	view.insert("mydata", plot_values).run();

}

init();
