import $ from "jquery";

import {parseForm, fillForm} from "./formutils.js";

const addAnother = document.getElementById('add-another-policy');
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

function addPolicyForm(event){
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
    newnode.scrollIntoView();
    return newnode;
}

function triggerSelect(event){
    let ele = event.target;
    let opEle = ele.parentNode.querySelector('[name="trigger-operator"]');
    let eqtrigger = (ele.value === "duration") || (ele.value === "time");
    for (let opt of opEle.querySelectorAll("option")){
        if (opt.value === "=="){
            opt.disabled = !eqtrigger;
        }else{
            opt.disabled = eqtrigger;
        }
    }
    let selectOp = opEle.options[opEle.selectedIndex];
    if (selectOp.disabled){
        for (let o of opEle.options){
            if (!o.disabled){
                opEle.value = o.value;
                break;
            }
        }
    }
}

function shutdownSelect(event){
    let ele = event.target;
    let opEle = ele.parentNode.querySelector('[name="trigger-operator"]');
    let valEle = ele.parentNode.querySelector('[name="trigger-value"]');
    let recEle = ele.parentNode.querySelector('[name="recurrent"]');
    opEle.disabled = valEle.disabled = recEle.disabled = (ele.value === "permanent");
}

addAnother.addEventListener('click', addPolicyForm);

function wireEvents(node){
    $(node).find('a[data-toggle="pill"]').on('shown.bs.tab', sync);
    $(node).find('a[data-toggle="pill"]').on('shown.bs.tab', (e) => document.querySelector(e.target.getAttribute('href')).querySelector("input").focus());
    for (let f of node.querySelectorAll('input, select, button')){
        f.addEventListener('input', sync);
    }
    for (let sel of node.querySelectorAll("[name='trigger-variable']")){
        sel.addEventListener("input", triggerSelect);
        triggerSelect({target: sel});
    }
    let shutSelect = node.querySelector(".shutdown-form [name='trigger-variable']");
    shutSelect.addEventListener("input", shutdownSelect);
    shutdownSelect({target: shutSelect});
    let remove = node.querySelector(".remove-policy");
    remove.addEventListener("click", removePolicy);
}


function removePolicy(event){
    let node = event.target.closest(".policy-selector");
    node.remove();
    sync();
}


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
        policies.push(
            {'policy': policy, 'trigger': triggerData, 'data': policyData}
        );

    }
    return policies;
}

export function fillPolicyForm(policies){
    for (let node of policyContaniner.querySelectorAll(".policy-selector")){
        node.remove();
    }
    for (let policy of policies){
        let f = addPolicyForm();
        let selected_policy_form = f.querySelector(`.policy-form[data-policy='${policy.policy}']`)
        let a = f.querySelector(`.policy-select > .nav-link[href='#${selected_policy_form.parentNode.id}']`);
        $(a).tab("show");
        let triggerForm = f.querySelector(".trigger-form");
        fillForm(triggerForm, policy.trigger);
        let pform = f.querySelector(".active .policy-form");;
        fillForm(pform, policy.data);
        sync();
    }

}


wireEvents(blueprint);
sync();
