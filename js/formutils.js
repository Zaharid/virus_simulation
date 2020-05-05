export function parseForm(form){
    if(!form.checkValidity()){
        return null;
    }
    let res = Object.create(null);
    let fd = new FormData(form);
    for (let ele of form.querySelectorAll('[name]')){
        let key = ele.getAttribute("name");
        let value = fd.get(key);
        if (ele.getAttribute("type") === "checkbox"){
            value = ele.checked;
        }else if (ele.getAttribute("data-type") === "list"){
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


export function fillForm(form, data){
    for (let [key, value] of Object.entries(data)){
        let ele = form.querySelector(`[name=${key}]`);
        if(ele.getAttribute("data-units")==="percent"){
            if(ele.getAttribute("data-type")==="list"){
                value = value.map((x) => {return Number((x*100).toPrecision(5))}).join(", ");
            }else{
                value= Number((value*100).toPrecision(5));
            }
        }
        if (ele.getAttribute("type") === "checkbox"){
            ele.checked = value;
        }else{
            ele.value = value;
        }
        ele.setAttribute("data-original", value);
        let ev = new Event("input");
        ele.dispatchEvent(ev);
    }
}
