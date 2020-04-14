import $ from "jquery";

import {parseForm} from "./formutils.js";

const addAnother = document.getElementById('add-another-policy');
const remove = document.getElementById('remove-policy');
const done = document.getElementById('policies-close');
const feedback = document.getElementById('policies-feedback');
const policyContaniner = document.getElementById('policy-container');
const blueprint = policyContaniner.querySelector('.policy-selector');



policyContaniner.addEventListener("sync", sync)


function sync(){
	const nodes = policyContaniner.querySelectorAll('.policy-selector');
	remove.disabled = (nodes.length === 0);
	let pforms = policyContaniner.querySelectorAll(".policy-selector .active .policy-form");
	let tforms = policyContaniner.querySelectorAll(".policy-selector .trigger-form");
	const valid = (f) => {return f.checkValidity();};
	let disabled = (
		!(pforms.length === nodes.length) ||
		!Array.from(pforms).every(valid) ||
		!Array.from(tforms).every(valid)
    );
	addAnother.disabled = disabled;
	done.disabled = disabled;
	if(disabled){
	    feedback.style.display = "block";
	}else{
	    feedback.style.display = "none";
	}


}

let n = 0;
addAnother.addEventListener('click', (event) => {
	let newnode = blueprint.cloneNode(true);
	const attrs = ["id", "href", "aria-controls", "aria-labelledby"];
	let descendents = newnode.getElementsByTagName('*');
	for (let ele of descendents){
		for (let a of attrs){
			if (ele.hasAttribute(a)){
				ele.setAttribute(a, ele.getAttribute(a).split("_")[0] + "_" + n);
			}
		}
		ele.classList.remove("show", "active");
	}
	wireEvents(newnode);
	policyContaniner.appendChild(newnode);
	n += 1;
	sync();
});

function wireEvents(node){
	$(node).find('a[data-toggle="pill"]').on('shown.bs.tab', sync);
	for (let f of node.querySelectorAll('input, select, button')){
		f.addEventListener('input', sync);
	}
}

remove.addEventListener('click', (event) => {
	let nodes = policyContaniner.querySelectorAll('.policy-selector');
	if (nodes.length > 0){
		let last = nodes[nodes.length -1];
		policyContaniner.removeChild(last);
	}
	sync();
});

export function getPolicies(){
	const nodes = policyContaniner.querySelectorAll('.policy-selector');
	let policies = [];
	for (let n of nodes){
		let pform = n.querySelector(".active .policy-form");
		if (pform === null){
			continue;
		}
		let policyData = parseForm(pform);
		if (policyData === null){
			return null;
		}
		let tform = n.querySelector(".trigger-form");

		let triggerData = parseForm(tform);
		if(triggerData === null){
			return null;
		}
		let policy = pform.getAttribute("data-policy");
		console.log("POLICY IS", policy);
		policies.push(
			{'policy': policy, 'trigger': triggerData, 'data': policyData}
		);

	}
	return policies;
}


wireEvents(blueprint);
sync();

