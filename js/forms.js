import vegaEmbed from 'vega-embed';

import {dist_spec, timeprofile_spec} from "./plot_specs.js";

let householdView = null;

let time_profiles = {}

async function init_forms(){
	const opts = {
		"mode": "vega-lite", "padding":{"left": 20, "top": 5, right: 5, "bottom": 20}, "actions": false
	};
	householdView = (await vegaEmbed('#family-dist-vis', dist_spec, opts)).view;
	let all_time_profiles = document.querySelectorAll(".time-profile-group");
	for (let form of all_time_profiles){
		let input = form.querySelector(".time-profile-input");
		let vis_div = form.querySelector(".time-profile-vis");
		let view = (await vegaEmbed(vis_div, timeprofile_spec, opts)).view;
		time_profiles[input.id] = view;
		input.addEventListener("input", timeProfileHandler);
	}
}




const configureClose = document.getElementById("configure-close");
const configureForm = document.getElementById("configure-form");


export function fillConfigForm(config){
	for (let [key, value] of Object.entries(config)){
		if (Array.isArray(value)){
			key = key + "_list";
		}
		let ele = document.getElementById(key);
		ele.value = value;
		let ev = new Event("input");
		ele.dispatchEvent(ev);
	}
}

export function getConfig(){
	if(!configureForm.checkValidity()){
		return null;
	}
	let res = {}
	let fd = new FormData(configureForm);
	for (let [key, value] of fd.entries()){
		if (key.endsWith("_list")){
			key = key.substring(0, key.length - 5);
			value = listToPosNums(value);
		}else{
			value = Number(value);
		}
		res[key] = value;
	}
	return res;
}

configureClose.addEventListener("click", (event) => {
	if(!configureForm.checkValidity()){
		event.preventDefault();
		event.stopPropagation();
		event.target.setCustomValidity("Please enter valid data in the form");
	}else{
		even.target.setCustomValidity("");
	}
});

const familyDist = document.getElementById("family_sizes_list");
const familyWeight = document.getElementById("family_size_weights_list");

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
		if (isNaN(number) || number < 0 || number > 1){
			return null;
		}
		numbers.push(number);
	}
	return numbers
}

function timeProfileHandler(event){
	let data = listToProbs(event.target.value);
	if (data===null || data.length === 0){
		event.target.setCustomValidity("Must be a list of probabilities");
		return;
	}
	event.target.setCustomValidity("");
	let view = time_profiles[event.target.id];
	show_time_profile_dist(data, view)
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
