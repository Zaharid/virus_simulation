import $ from "jquery";
import vegaEmbed from 'vega-embed';

import {dist_spec, timeprofile_spec} from "./plot_specs.js";
import {parseForm, fillForm} from "./formutils.js";

let householdView = null;


async function init_forms(){
	const opts = {
		"mode": "vega-lite", "padding":{"left": 20, "top": 5, right: 5, "bottom": 20}, "actions": false
	};
	householdView = (await vegaEmbed('#family-dist-vis', dist_spec, opts)).view;
	let all_time_profiles = document.querySelectorAll(".time-profile-group");
	for (let form of all_time_profiles){
		let input = form.querySelector(".time-profile-input");
		let vis_div = form.querySelector(".time-profile-vis");
		let title = form.querySelector("label").innerHTML
		let xlabel = vis_div.getAttribute("data-xlabel");
		let ylabel = vis_div.getAttribute("data-ylabel")
		let view = (
			await vegaEmbed(vis_div, timeprofile_spec(title, xlabel, ylabel), opts)
		).view;
		input.addEventListener("input", (event) =>{
			let data = listToProbs(event.target.value);
			if (data===null || data.length === 0){
				event.target.setCustomValidity("Must be a list of probabilities");
				return;
			}
			event.target.setCustomValidity("");
			show_time_profile_dist(data, view);
	        }
		);

		let multiply_input = form.querySelector(".multiply-inp");
		let multiply_btn = form.querySelector(".multiply-btn");
		input.addEventListener("input", (event) => {
			multiply_btn.disabled = !event.target.checkValidity();
		});
		multiply_btn.addEventListener("click", (event)=>{
			let value = listToPosNums(input.value);
			let multiplier = Number(multiply_input.value);
			input.value = value.map((v) => {return (v*multiplier).toPrecision(3)});
			let e = new Event("input");
			input.dispatchEvent(e);
			multiply_input.value = (1/multiplier).toFixed(1);
			e = new Event("input");
			multiply_input.dispatchEvent(e);
		});
		let reset_btn = form.querySelector(".reset-inp-btn");
		reset_btn.addEventListener("click", () => {
			input.value = input.getAttribute("data-original");
			let e = new Event("input");
			input.dispatchEvent(e);
		});
	}
}




//A resize event is needed for the plots wake.
//See:
//https://vega.github.io/vega-lite/docs/size.html#specifying-responsive-width-and-height
//
//The event is triggered as per
//https://getbootstrap.com/docs/4.0/components/collapse/#events
$('#configure-collapse').on('shown.bs.collapse', () => {window.dispatchEvent(new Event('resize'));});
//No idea why this doen't work.
//const configureCollapse = document.getElementById("configure-collapse");
//configureCollapse.addEventListener('shown',  xxf);


const configureClose = document.getElementById("configure-close");
const configureForm = document.getElementById("configure-form");


export function fillConfigForm(config){
	fillForm(configureForm, config);
}

export function getConfig(){
	return parseForm(configureForm);
}

configureClose.addEventListener("click", (event) => {
	if(!configureForm.checkValidity()){
		event.preventDefault();
		event.stopPropagation();
		event.target.setCustomValidity("Please enter valid data in the form");
	}else{
		event.target.setCustomValidity("");
	}
});

const familyDist = document.getElementById("family_sizes");
const familyWeight = document.getElementById("family_size_weights");

function listToPosNums(l){
	let words = l.split(",");
	let numbers = []
	for (let w of words){
		let number = Number(w);
		if (isNaN(number) || number < 0){
			return null;
		}
		numbers.push(number);
	}
	return numbers
}


function listToProbs(l){
	let words = l.split(",");
	let numbers = []
	for (let w of words){
		let number = Number(w);
		if (isNaN(number) || number < 0 || number > 100){
			return null;
		}
		numbers.push(number);
	}
	return numbers
}


function show_time_profile_dist(data, view){
    let plot_data = data.map((val, i) => {return {"day": i+1, "value": val}});
	plot_data.push({"day": "...", "value": data[data.length - 1]});
	view.data("mydata", plot_data).run()
}

function show_household_dist(){
	let data = [];
	let familyDistNumbers = listToPosNums(familyDist.value);
	let familyWeightNumbers = listToPosNums(familyWeight.value);
	for (let i=0; i<familyDistNumbers.length; i++){
		data.push({"x": familyDistNumbers[i], "y": familyWeightNumbers[i]});
	}
	householdView.data("mydata", data).run();
}


const householdHandler = (event, other) => {
	let ownvalues = listToPosNums(event.target.value);
	if (ownvalues===null){
		event.target.setCustomValidity("Invalid numbers");
		return;
	}
	let othervalues = listToPosNums(other.value)
	if (othervalues===null){
		return;
	}
	if (ownvalues.length !== othervalues.length){
		event.target.setCustomValidity("Length mismatch");
		return;
	}else{
		if (other.validationMessage === "Length mismatch"){
			other.setCustomValidity("")
		}
	}
	event.target.setCustomValidity("");
	show_household_dist();
}

const familyDistHandler = (event) => {
	return householdHandler(event, familyWeight)
};

const familyWeightsHandler = (event) => {
	return householdHandler(event, familyDist)
};


familyDist.addEventListener('input', familyDistHandler);
familyWeight.addEventListener('input', familyWeightsHandler);

init_forms();
