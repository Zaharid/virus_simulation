mod utils;

use std::collections::HashMap;

use wasm_bindgen::prelude::*;
use web_sys;

use rand;
use rand::Rng;
use rand::distributions::Distribution;
use rand_distr::Binomial;
use rand::distributions::weighted::alias_method::WeightedIndex;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

//https://www.ine.es/en/prensa/ech_2018_en.pdf
const DEFAULT_FAMILY_SIZES:[usize; 5] = [1, 2, 3, 4, 5];
const FAMILY_SIZE_WEIGHTS:[f64; 5] = [25.5, 30.4, 20.8, 17.5, 5.7];


const HEALTHY_INFECTED_PROFILE:[f64; 23] = [0., 0.003, 0.005, 0.01, 0.01, 0.01, 0.01, 0.02, 0.05, 0.05, 0.05, 0.07, 0.07, 0.07, 0.05, 0.05, 0.05, 0.05, 0.02, 0.01, 0.005, 0.003, 0.001];

const INFECTED_DETECTED_PROFILE:[f64; 18] = [0., 0., 0., 0.01, 0.02, 0.03, 0.05, 0.7, 0.10, 0.10, 0.15, 0.10, 0.10, 0.10, 0.07, 0.05, 0.02, 0.01];

const INFECTED_CRITICAL_PROFILE:[f64;14] = [0. ,0. ,0. ,0.,0.,0., 0., 0., 0.01, 0.02, 0.05, 0.03, 0.02, 0.01];

const INFECTED_INMUNE_PROFILE:[f64;15] = [0., 0., 0., 0., 0., 0., 0., 0., 0., 0.05, 0.1, 0.2, 0.3, 0.5, 0.7];

const CRITICAL_DEATH_PROFILE:[f64;5] = [0., 0.01, 0.01, 0.02, 0.05];

const CRITICAL_INMUNE_PROFILE:[f64;10] = [0., 0., 0., 0., 0., 0., 0.03, 0.04, 0.07, 0.1];

const INMUNE_HEALTHY_PROFILE: [f64; 30] = [0.,0.,0.,0.,0.,0.,0.,0.,0.,0.,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0. ,0.00189723];

const FAMILY_CONTACT_INFECTED_COEF:f64 = 1.;
const FAMILY_CONTACT_DETECTED_COEF: f64 = 0.3;

const WORKPLACE_CONTACT_INFECTED_COEF: f64 = 0.7;
const WORKPLACE_CONTACT_DETECTED_COEF: f64 = 0.05;

const WORLD_CONTACT_INFECTED_COEF: f64 = 0.15;
const WORLD_CONTACT_DETECTED_COEF: f64 = 0.01;





fn sat_index<T: Copy>(v: &[T], i: usize) -> T{
    *v.get(i).unwrap_or_else(|| v.last().unwrap())
}




macro_rules! log {
    ($($t:tt)*) => {
        web_sys::console::log_1(&format!($($t)*).into());
    }
}


fn sample_family_size(index: &WeightedIndex<f64>) -> usize{
    DEFAULT_FAMILY_SIZES[index.sample(&mut rand::thread_rng())]
}


#[derive(Clone, Copy)]
enum State{
    Healthy,
    Infected(usize),
    Detected(usize),
    Severe(usize),
    Inmune(usize),
    Dead,
}

impl State{
    fn name(&self) -> &'static str{
        match self{
            State::Healthy => "Healthy",
            State::Infected(_) => "Infected (Undetected)",
            State::Detected(_) => "Infected (Detected)",
            State::Severe(_) => "Severe",
            State::Inmune(_) => "Inmune",
            State::Dead => "Dead",
        }
    }
}


struct Graph{
    nodes: Vec<Vec<usize>>,
}

impl Graph{
    fn new () -> Graph{
        let nodes:Vec<Vec<usize>> = Vec::new();
        Graph{nodes}
    }
    fn register_node(&mut self) -> usize{
        self.nodes.push(vec![]);
        return self.nodes.len() - 1;
    }
    fn add_link(&mut self, i:usize, j:usize) -> Option<()>{
        if j < i{
            self.nodes.get_mut(i)?.push(j);
        }else{
            self.nodes.get_mut(j)?.push(i);
        }
        Some(())
    }

}


type Counter = HashMap<&'static str, i32>;

trait Count {
    fn register(&mut self, s:State);
    fn transit(&mut self, from:State, to:State);
}

impl Count for Counter{
    fn register(&mut self, s:State){
        let v = self.entry(s.name()).or_insert(0);
        *v += 1;
    }

    fn transit(&mut self, from:State, to:State){
        let v = self.get_mut(from.name()).unwrap();
        *v -= 1;
        let v = self.entry(to.name()).or_insert(0);
        *v += 1;
    }

}

#[wasm_bindgen]
pub struct Simulation {
    family_graph: Graph,
    workplace_graph: Graph,
    world_graph: Graph,
    counter: Counter,
    states: Vec<State>,
}



#[wasm_bindgen]
impl Simulation{

    pub fn new(approximate_population:usize, nworkplaces:usize, initial_infected_chance: f64, workplace_connectivity: f64, average_universe_connections: usize) -> Simulation{
        utils::set_panic_hook();

        let mut rng = rand::thread_rng();
        let family_sampler = WeightedIndex::new(FAMILY_SIZE_WEIGHTS.to_vec()).unwrap();


        let mut counter = HashMap::new();

        let mut family_graph = Graph::new();
        let mut workplace_graph = Graph::new();
        let mut world_graph = Graph::new();

        let mut workplaces: Vec<Vec<usize>> = Vec::new();
        workplaces.resize_with(nworkplaces, Default::default);

        let mut states: Vec<State> = Vec::new();
        let world_p = f64::min((average_universe_connections as f64)/(approximate_population as f64), 1.);


        let mut nnodes = 0;
        while nnodes < approximate_population{
            let fsize = sample_family_size(&family_sampler);
            for id_f in 0..fsize{
                let g_index = family_graph.register_node();

                for prev_g_index in (g_index - id_f).. g_index{
                    family_graph.add_link(prev_g_index, g_index);
                }



                let workplace:usize = rng.gen_range(0, nworkplaces);
                let _ = workplace_graph.register_node();
                let workplace_nodes = &workplaces[workplace];
                let nconnections = Binomial::new(workplace_nodes.len() as u64, workplace_connectivity).unwrap().sample(&mut rng) as usize;
                let connections = rand::seq::index::sample(&mut rng, workplace_nodes.len(), nconnections);
                for c in connections.iter(){
                    workplace_graph.add_link(g_index, workplace_nodes[c]);
                }

                workplaces[workplace].push(g_index);

                let _ = world_graph.register_node();
                let nconnections = Binomial::new(g_index as u64, world_p).unwrap().sample(&mut rng) as usize;
                let connections = rand::seq::index::sample(&mut rng, g_index, nconnections);
                for c in connections.iter(){
                    world_graph.add_link(c, g_index);
                }



                let chance: f64 = rng.gen();
                let s = if chance < initial_infected_chance
                {
                    State::Infected(0)
                }else{
                    State::Healthy
                };
                counter.register(s);
                states.push(s);
                nnodes += 1;
                //log!("inserted node {}", g_index);
            }


        }
        Simulation{family_graph, workplace_graph, world_graph, counter, states}
    }


    pub fn tick(&mut self){
        let mut newstates:Vec<State> = Vec::with_capacity(self.states.len());

        //Don't iterate over state here so we can mutably borrow `self` later
        for i in 0..self.states.len(){
            let s = self.states[i];
            let newstate = match s{
                State::Healthy => self.get_infected(i),
                State::Infected(t) => {
                    self.infect_others(i, t, FAMILY_CONTACT_INFECTED_COEF, WORKPLACE_CONTACT_INFECTED_COEF, WORLD_CONTACT_INFECTED_COEF, &mut newstates);
                    self.transit_infected(t)},
                State::Detected(t) => {
                    self.infect_others(i, t, FAMILY_CONTACT_DETECTED_COEF, WORKPLACE_CONTACT_DETECTED_COEF, WORLD_CONTACT_DETECTED_COEF, &mut newstates);
                    self.transit_detected(t)},
                State::Severe(t) => self.transit_severe(t),
                State::Inmune(t) => self.transit_inmune(t),
                State::Dead => State::Dead,
            };
            newstates.push(newstate);
        }
        self.states = newstates;
    }

    pub fn get_counter(&self) -> JsValue{
        return JsValue::from_serde(&self.counter).unwrap();
    }




    pub fn len(&self) -> usize{
        return self.states.len();
    }

}

impl Simulation{

    fn get_infected(&mut self, i:usize) -> State{
        //TODO: Optimize this and avoid repetition
        let do_infect = |nodes: &[usize], infected_coef:f64, detected_coef: f64, counter: &mut Counter, states: &[State]|{
            for n in nodes{
                let connected_state = states[*n];
                let become_infected = match connected_state{
                    State::Infected(t) => infected_coef*sat_index(&HEALTHY_INFECTED_PROFILE, t) > rand::random(),
                    State::Detected(t) => detected_coef*sat_index(&HEALTHY_INFECTED_PROFILE, t) > rand::random(),
                    _ => false
                };
                if become_infected{
                    let ns  = State::Infected(0);
                    counter.transit(State::Healthy, ns);
                    return Some(ns)
                }
            }
            None
        };

        if let Some(s) = do_infect(&self.family_graph.nodes[i], FAMILY_CONTACT_INFECTED_COEF, FAMILY_CONTACT_DETECTED_COEF, &mut self.counter, &self.states){
            s
        }else if let Some(s) = do_infect(&self.workplace_graph.nodes[i], WORKPLACE_CONTACT_INFECTED_COEF, WORKPLACE_CONTACT_DETECTED_COEF, &mut self.counter, &self.states){
            s
        }else if let Some(s) = do_infect(&self.world_graph.nodes[i], WORLD_CONTACT_INFECTED_COEF, WORLD_CONTACT_DETECTED_COEF, &mut self.counter, &self.states){
            s
        }else{
            State::Healthy
        }
    }

    fn infect_others(&mut self, i: usize, t:usize, family_coef: f64, workplace_coef: f64, world_coef: f64, newstates: &mut Vec<State>){

        let mut do_infect = |nodes: &[usize], coef: f64, counter: &mut Counter|{
            for n in nodes{
                let connected_state = newstates.get_mut(*n).unwrap();
                if let State::Healthy = connected_state{
                    if coef*sat_index(&HEALTHY_INFECTED_PROFILE, t) > rand::random(){
                        let ns = State::Infected(0);
                        counter.transit(State::Healthy, ns);
                        *connected_state = ns;
                    }
                }
            }
        };
        do_infect(&self.family_graph.nodes[i], family_coef, &mut self.counter);
        do_infect(&self.workplace_graph.nodes[i], workplace_coef, &mut self.counter);
        do_infect(&self.world_graph.nodes[i], world_coef, &mut self.counter);

    }

    fn sample_state(states: &[State], weights: &[f64]) -> State{
        let mut weights = weights.to_vec();
        let logs = weights.iter().map(|x| (1. - *x).ln());
        let s = logs.sum::<f64>().exp();
        weights.push(s);
        let mut rng = rand::thread_rng();
        let index = WeightedIndex::new(weights).unwrap().sample(&mut rng);
        states[index]
    }

    fn transit_infected(&mut self, t:usize) -> State {
        let opts =  [State::Inmune(0),                       State::Detected(t+1),                     State::Severe(0),                         State::Infected(t+1)];
        let w =     [sat_index(&INFECTED_INMUNE_PROFILE, t), sat_index(&INFECTED_DETECTED_PROFILE, t), sat_index(&INFECTED_CRITICAL_PROFILE, t)];
        let s = Simulation::sample_state(&opts, &w);
        self.counter.transit(State::Infected(0), s);
        s
    }

    fn transit_detected(&mut self, t:usize) -> State {
        let opts =  [State::Inmune(0),                        State::Severe(0),                         State::Detected(t+1)];
        let w =     [sat_index(&INFECTED_INMUNE_PROFILE, t),  sat_index(&INFECTED_CRITICAL_PROFILE, t)];
        let s = Simulation::sample_state(&opts, &w);
        self.counter.transit(State::Detected(0), s);
        s
    }

    fn transit_severe(&mut self, t:usize) -> State{
        let opts =  [State::Inmune(0),                       State::Dead,                          State::Severe(t+1)];
        let w =     [sat_index(&CRITICAL_INMUNE_PROFILE, t), sat_index(&CRITICAL_DEATH_PROFILE, t)];
        let s = Simulation::sample_state(&opts, &w);
        self.counter.transit(State::Severe(0), s);
        s
    }

    fn transit_inmune(&mut self, t: usize) -> State{
        let opts = [State::Healthy,                       State::Inmune(t+1)];
        let w =    [sat_index(&INMUNE_HEALTHY_PROFILE, t)];
        let s = Simulation::sample_state(&opts, &w);
        self.counter.transit(State::Inmune(0), s);
        s
    }


}







#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    let mut s = Simulation::new(300000, 2000, 0.0001, 0.8, 100);
    log!("Initilized simulation with {} nodes, {} healthy and {} infected", s.len(), s.counter.get(&State::Healthy.name()).unwrap(), s.counter.get(&State::Infected(0).name()).unwrap());
    let mut day = 0;
    loop{
        day +=1;
        s.tick();
        log!("Day {} simulation {:?}", day, s.counter);
    }
    //alert("Hello, graph!");
}

