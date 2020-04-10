export function parseForm(form){
	if(!form.checkValidity()){
		return null;
	}
	let res = {}
	let fd = new FormData(form);
	for (let [key, value] of fd.entries()){
		let ele = form.querySelector(`[name=${key}]`);
		if (ele.getAttribute("data-type") === "list"){
			if(ele.getAttribute("data-units") === "percent"){
				value = value.split(",").map((x) => {return Number(x)/100});
			}else{
				value = value.split(",").map((x) => {return Number(x)});
			}
		}else{
			if(ele.getAttribute("data-units") === "percent"){
				value = Number(value)/100;
			}else if (ele.getAttribute("type") === "number"){
				value = Number(value);
			}
		}
		res[key] = value;
	}
	return res;
}
