mod utils;

use wasm_bindgen::prelude::*;
use web_sys;

use rand;
use rand::distributions::weighted::alias_method::WeightedIndex;
use rand::distributions::Distribution;
use rand::Rng;
use rand_distr::Binomial;
use serde::{Deserialize, Serialize};

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

//https://www.ine.es/en/prensa/ech_2018_en.pdf
const DEFAULT_FAMILY_SIZES: [usize; 5] = [1, 2, 3, 4, 5];
const FAMILY_SIZE_WEIGHTS: [f64; 5] = [25.5, 30.4, 20.8, 17.5, 5.7];

const SUSCEPTIBLE_INFECTED_PROFILE: [f64; 23] = [
    0., 0.005, 0.007, 0.015, 0.015, 0.015, 0.015, 0.03, 0.07, 0.07, 0.07, 0.1, 0.1, 0.1, 0.07,
    0.07, 0.07, 0.07, 0.03, 0.015, 0.007, 0.005, 0.0015,
];

const INFECTED_DETECTED_PROFILE: [f64; 18] = [
    0., 0., 0., 0.01, 0.02, 0.03, 0.05, 0.07, 0.10, 0.10, 0.15, 0.10, 0.10, 0.10, 0.07, 0.05, 0.02,
    0.01,
];

const INFECTED_CRITICAL_PROFILE: [f64; 14] = [
    0., 0., 0., 0., 0., 0., 0., 0., 0.01, 0.02, 0.05, 0.03, 0.02, 0.01,
];

const INFECTED_INMUNE_PROFILE: [f64; 15] = [
    0., 0., 0., 0., 0., 0., 0., 0., 0., 0.05, 0.1, 0.2, 0.3, 0.5, 0.7,
];

const CRITICAL_DEATH_PROFILE: [f64; 7] = [0., 0., 0., 0.01, 0.01, 0.02, 0.05];

const CRITICAL_INMUNE_PROFILE: [f64; 10] = [0., 0., 0., 0., 0., 0., 0.03, 0.04, 0.07, 0.1];

const INMUNE_SUSCEPTIBLE_PROFILE: [f64; 30] = [
    0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
    0., 0., 0., 0., 0., 0.00189723,
];

const FAMILY_CONTACT_INFECTED_COEF: f64 = 1.;
const FAMILY_CONTACT_DETECTED_COEF: f64 = 0.3;

const WORKPLACE_CONTACT_INFECTED_COEF: f64 = 0.7;
const WORKPLACE_CONTACT_DETECTED_COEF: f64 = 0.05;

const WORLD_CONTACT_INFECTED_COEF: f64 = 0.15;
const WORLD_CONTACT_DETECTED_COEF: f64 = 0.01;

const DEFAULT_INITIAL_OUTBREAK_SIZE: usize = 20;

const DEFAULT_TOTAL_POPULATION: usize = 300000;
const DEFAULT_HOSPITAL_CAPACITY: usize = 2000;
const DEFAULT_AVERAGE_WORKPLACE_SIZE: f64 = 15.;

const DEFAULT_WORKPLACE_CONNECTIVITY: f64 = 0.8;

const DEFAULT_WORLD_CONNECTIONS: f64 = 50.;

fn sat_index<T: Copy>(v: &[T], i: usize) -> T {
    *v.get(i).unwrap_or_else(|| v.last().unwrap())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Config {
    susceptible_infected_profile: Vec<f64>,
    infected_detected_profile: Vec<f64>,
    infected_severe_profile: Vec<f64>,
    infected_immune_profile: Vec<f64>,
    severe_immune_profile: Vec<f64>,
    severe_dead_profile: Vec<f64>,
    immune_susceptible_profile: Vec<f64>,
    initial_outbreak_size: usize,
    total_population: usize,
    hospital_capacity: usize,
    family_sizes: Vec<usize>,
    family_size_weights: Vec<f64>,
    family_contact_undetected_coef: f64,
    family_contact_detected_coef: f64,
    average_workplace_size: f64,
    workplace_connectivity: f64,
    workplace_contact_undetected_coef: f64,
    workplace_contact_detected_coef: f64,
    average_world_connections: f64,
    world_contact_undetected_coef: f64,
    world_contact_detected_coef: f64,
}

impl Default for Config {
    fn default() -> Config {
        Config {
            susceptible_infected_profile: SUSCEPTIBLE_INFECTED_PROFILE.to_vec(),
            infected_detected_profile: INFECTED_DETECTED_PROFILE.to_vec(),
            infected_severe_profile: INFECTED_CRITICAL_PROFILE.to_vec(),
            infected_immune_profile: INFECTED_INMUNE_PROFILE.to_vec(),
            severe_immune_profile: CRITICAL_INMUNE_PROFILE.to_vec(),
            severe_dead_profile: CRITICAL_DEATH_PROFILE.to_vec(),
            immune_susceptible_profile: INMUNE_SUSCEPTIBLE_PROFILE.to_vec(),
            initial_outbreak_size: DEFAULT_INITIAL_OUTBREAK_SIZE,
            total_population: DEFAULT_TOTAL_POPULATION,
            hospital_capacity: DEFAULT_HOSPITAL_CAPACITY,
            family_sizes: DEFAULT_FAMILY_SIZES.to_vec(),
            family_size_weights: FAMILY_SIZE_WEIGHTS.to_vec(),
            family_contact_undetected_coef: FAMILY_CONTACT_INFECTED_COEF,
            family_contact_detected_coef: FAMILY_CONTACT_DETECTED_COEF,
            average_workplace_size: DEFAULT_AVERAGE_WORKPLACE_SIZE,
            workplace_connectivity: DEFAULT_WORKPLACE_CONNECTIVITY,
            workplace_contact_undetected_coef: WORKPLACE_CONTACT_INFECTED_COEF,
            workplace_contact_detected_coef: WORKPLACE_CONTACT_DETECTED_COEF,
            average_world_connections: DEFAULT_WORLD_CONNECTIONS,
            world_contact_undetected_coef: WORLD_CONTACT_INFECTED_COEF,
            world_contact_detected_coef: WORLD_CONTACT_DETECTED_COEF,
        }
    }
}

impl Config {
    fn nworkplaces(&self) -> usize {
        f64::max(
            (self.total_population as f64) / self.average_workplace_size,
            1.,
        ) as usize
    }
}

#[wasm_bindgen]
impl Config {
    pub fn default_config() -> JsValue {
        JsValue::from_serde(&Config::default()).unwrap()
    }
}

macro_rules! log {
    ($($t:tt)*) => {
        web_sys::console::log_1(&format!($($t)*).into());
    }
}

#[derive(Clone, Copy)]
enum State {
    Susceptible,
    Infected(usize),
    Detected(usize),
    Severe(usize),
    Unattended,
    Immune(usize),
    Dead,
}

impl State {
    fn index(&self) -> usize {
        match self {
            State::Susceptible => 0,
            State::Infected(_) => 1,
            State::Detected(_) => 2,
            State::Severe(_) => 3,
            State::Unattended => 4,
            State::Immune(_) => 5,
            State::Dead => 6,
        }
    }
}

struct Graph {
    left_nodes: Vec<Vec<usize>>,
    right_nodes: Vec<Vec<usize>>,
}

impl Graph {
    fn new() -> Graph {
        let left_nodes = Vec::new();
        let right_nodes = Vec::new();
        Graph {
            left_nodes,
            right_nodes,
        }
    }
    fn register_node(&mut self) -> usize {
        self.left_nodes.push(vec![]);
        self.right_nodes.push(vec![]);
        return self.left_nodes.len() - 1;
    }
    fn add_link(&mut self, i: usize, j: usize) -> Option<()> {
        if j < i {
            self.left_nodes.get_mut(i)?.push(j);
            self.right_nodes.get_mut(j)?.push(i);
        } else {
            self.left_nodes.get_mut(j)?.push(i);
            self.right_nodes.get_mut(i)?.push(j);
        }
        Some(())
    }
}

#[derive(Serialize, Deserialize, Debug)]
struct Counter {
    abs_counter: [i32; 7],
    day_counter: [i32; 7],
}

impl Counter {
    fn new() -> Counter {
        let abs_counter = [0, 0, 0, 0, 0, 0, 0];
        let day_counter = [0, 0, 0, 0, 0, 0, 0];
        Counter {
            abs_counter,
            day_counter,
        }
    }
    fn register(&mut self, s: State) {
        self.abs_counter[s.index()] += 1;
    }
    fn state_count(&self, s: State) -> i32 {
        self.abs_counter[s.index()]
    }
    fn transit(&mut self, from: State, to: State) {
        self.abs_counter[from.index()] -= 1;
        self.abs_counter[to.index()] += 1;
        if from.index() != to.index() {
            self.day_counter[to.index()] += 1;
        }
    }
    fn reset_day_counter(&mut self) {
        for i in self.day_counter.iter_mut() {
            *i = 0
        }
    }
}

struct Averager {
    sum: i32,
    count: usize,
}

impl Averager {
    fn new() -> Self {
        let sum = 0;
        let count = 0;
        Self { sum, count }
    }

    fn push(&mut self, ele: i32) {
        self.sum += ele;
        self.count += 1;
    }

    fn reset(&mut self) {
        self.sum = 0;
        self.count = 0;
    }

    fn get(&self) -> f64 {
        self.sum as f64 / self.count as f64
    }
}

#[wasm_bindgen]
pub struct Simulation {
    family_graph: Graph,
    workplace_graph: Graph,
    world_graph: Graph,
    counter: Counter,
    states: Vec<State>,
    worker_workplaces: Vec<usize>,
    infections_caused: Vec<usize>,
    r_average: Averager,
    serial_interval_average: Averager,
    last_disabled_workplace: usize,
    config: Config,
    time: usize,
}

impl Simulation {
    pub fn new(config: Config) -> Simulation {
        utils::set_panic_hook();

        let mut rng = rand::thread_rng();
        let family_sampler = WeightedIndex::new(config.family_size_weights.clone()).unwrap();

        let mut counter = Counter::new();

        let mut family_graph = Graph::new();
        let mut workplace_graph = Graph::new();
        let mut world_graph = Graph::new();

        let nworkplaces = config.nworkplaces();
        let mut workplaces: Vec<Vec<usize>> = Vec::with_capacity(nworkplaces);
        let mut worker_workplaces = Vec::with_capacity(config.total_population + 10);
        workplaces.resize_with(nworkplaces, Default::default);

        let mut states: Vec<State> = Vec::new();
        let world_p = f64::min(
            (config.average_world_connections) / (config.total_population as f64),
            1.,
        );

        let mut nnodes = 0;
        while nnodes < config.total_population {
            let fsize_index = family_sampler.sample(&mut rand::thread_rng());
            let fsize = config.family_sizes[fsize_index];
            for id_f in 0..fsize {
                let g_index = family_graph.register_node();

                for prev_g_index in (g_index - id_f)..g_index {
                    family_graph.add_link(prev_g_index, g_index);
                }

                let workplace: usize = rng.gen_range(0, nworkplaces);
                worker_workplaces.push(workplace);
                let _ = workplace_graph.register_node();
                let workplace_nodes = &workplaces[workplace];
                let nconnections =
                    Binomial::new(workplace_nodes.len() as u64, config.workplace_connectivity)
                        .unwrap()
                        .sample(&mut rng) as usize;
                let connections =
                    rand::seq::index::sample(&mut rng, workplace_nodes.len(), nconnections);
                for c in connections.iter() {
                    workplace_graph.add_link(g_index, workplace_nodes[c]);
                }

                workplaces[workplace].push(g_index);

                let _ = world_graph.register_node();
                let nconnections = Binomial::new(g_index as u64, world_p)
                    .unwrap()
                    .sample(&mut rng) as usize;
                let connections = rand::seq::index::sample(&mut rng, g_index, nconnections);
                for c in connections.iter() {
                    world_graph.add_link(c, g_index);
                }

                let s = State::Susceptible;
                counter.register(s);
                states.push(s);
                nnodes += 1;
            }
        }

        let initial_outbreak_size = usize::min(nnodes, config.initial_outbreak_size);
        let infected = rand::seq::index::sample(&mut rng, states.len(), initial_outbreak_size);
        for j in infected.iter() {
            states[j] = State::Infected(0);
            counter.transit(State::Susceptible, State::Infected(0));
        }
        let mut infections_caused = Vec::with_capacity(nnodes);
        infections_caused.resize_with(nnodes, Default::default);
        let r_average = Averager::new();
        let serial_interval_average = Averager::new();
        let time = 0;
        let last_disabled_workplace = 0;
        Simulation {
            time,
            family_graph,
            workplace_graph,
            world_graph,
            counter,
            worker_workplaces,
            infections_caused,
            r_average,
            serial_interval_average,
            states,
            last_disabled_workplace,
            config,
        }
    }
}

#[wasm_bindgen]
impl Simulation {
    pub fn from_js(config: JsValue) -> Option<Simulation> {
        match config.into_serde() {
            Ok(c) => Some(Simulation::new(c)),
            Err(_) => None,
        }
    }

    pub fn tick(&mut self) {
        self.counter.reset_day_counter();
        self.r_average.reset();
        self.serial_interval_average.reset();
        let mut newstates: Vec<State> = Vec::with_capacity(self.states.len());

        //Don't iterate over state here so we can mutably borrow `self` later
        for i in 0..self.states.len() {
            let s = self.states[i];
            let newstate = match s {
                State::Susceptible => self.get_infected(i),
                State::Infected(t) => self.transit_infected(t, i),
                State::Detected(t) => self.transit_detected(t, i),
                State::Unattended => self.transit_unattended(),
                State::Severe(t) => self.transit_severe(t),
                State::Immune(t) => self.transit_immune(t),
                State::Dead => State::Dead,
            };
            newstates.push(newstate);
        }
        self.states = newstates;
        self.time += 1;
    }

    pub fn get_counter(&self) -> JsValue {
        JsValue::from_serde(&self.counter).unwrap()
    }

    pub fn get_daily_r(&self) -> f64 {
        self.r_average.get()
    }

    pub fn get_daily_serial_interval(&self) -> f64 {
        self.serial_interval_average.get()
    }

    pub fn get_hospital_capacity(&self) -> usize {
        self.config.hospital_capacity
    }

    pub fn get_time(&self) -> usize {
        self.time
    }

    pub fn disable_fraction_of_workplaces(&mut self, fraction: f64) {
        self.last_disabled_workplace = (fraction * self.config.nworkplaces() as f64) as usize;
        log!(
            "Last disabled workpalce is {}",
            self.last_disabled_workplace
        );
    }

    pub fn multiply_world_infectability(&mut self, coef: f64) {
        self.config.world_contact_undetected_coef *= coef;
    }

    pub fn multiply_workplace_infectability(&mut self, coef: f64) {
        self.config.workplace_contact_undetected_coef *= coef;
    }
}

impl Simulation {
    fn get_infected(&mut self, i: usize) -> State {
        let iterdata: [Option<(&Graph, f64, f64)>; 3] = [
            Some((
                &self.family_graph,
                self.config.family_contact_undetected_coef,
                self.config.family_contact_detected_coef,
            )),
            if self.worker_workplaces[i] < self.last_disabled_workplace {
                None
            } else {
                Some((
                    &self.workplace_graph,
                    self.config.workplace_contact_undetected_coef,
                    self.config.workplace_contact_detected_coef,
                ))
            },
            Some((
                &self.world_graph,
                self.config.world_contact_undetected_coef,
                self.config.world_contact_detected_coef,
            )),
        ];
        for opt in iterdata.iter() {
            if let Some((g, infected_coef, detected_coef)) = opt {
                let nodes = g.left_nodes[i].iter().chain(g.right_nodes[i].iter());
                for n in nodes {
                    let connected_state = self.states[*n];
                    if let State::Infected(t) | State::Detected(t) = connected_state {
                        let coef = if let State::Infected(_) = connected_state {
                            infected_coef
                        } else {
                            detected_coef
                        };
                        if coef * sat_index(&self.config.susceptible_infected_profile, t)
                            > rand::random()
                        {
                            let ns = State::Infected(0);
                            self.infections_caused[*n] += 1;
                            self.serial_interval_average.push(t as i32);
                            self.counter.transit(State::Susceptible, ns);
                            return ns;
                        }
                    }
                }
            }
        }
        State::Susceptible
    }

    fn hospitals_full(&self) -> bool {
        self.counter.state_count(State::Severe(0)) >= self.config.hospital_capacity as i32
    }

    fn sample_state(states: &[State], weights: &[f64]) -> State {
        let mut weights = weights.to_vec();
        // Compute probability of no transition, in a numerically stable way.
        // Product (1-p_i) = Exp(Sum(Log(1-p_i)))
        let logs = weights.iter().map(|x| (-(*x)).ln_1p());
        let pnotrans = logs.sum::<f64>().exp();
        // The probabilities are c*Pi..., pnotrans, where c is fixed by normalization.
        // Reweight pnotrans instead.
        let rwpnotrans = if pnotrans < 1. {
            let wsum: f64 = weights.iter().sum();
            pnotrans * wsum / (1. - pnotrans)
        } else {
            pnotrans
        };

        weights.push(rwpnotrans);
        let mut rng = rand::thread_rng();
        let index = WeightedIndex::new(weights).unwrap().sample(&mut rng);
        states[index]
    }

    fn handle_r0(&mut self, i: usize, s: State) {
        //Exhaustive match here is on purpose.
        match s {
            State::Unattended
            | State::Susceptible
            | State::Severe(_)
            | State::Immune(_)
            | State::Dead => {
                let ninfected = self.infections_caused[i];
                self.r_average.push(ninfected as i32);
                self.infections_caused[i] = 0;
            }
            State::Infected(_) | State::Detected(_) => {}
        }
    }

    fn transit_infected(&mut self, t: usize, i: usize) -> State {
        let severe_state = if self.hospitals_full() {
            State::Unattended
        } else {
            State::Severe(0)
        };
        let opts = [
            State::Immune(0),
            State::Detected(t + 1),
            severe_state,
            State::Infected(t + 1),
        ];
        let w = [
            sat_index(&self.config.infected_immune_profile, t),
            sat_index(&self.config.infected_detected_profile, t),
            sat_index(&self.config.infected_severe_profile, t),
        ];
        let s = Simulation::sample_state(&opts, &w);
        self.handle_r0(i, s);
        self.counter.transit(State::Infected(0), s);
        s
    }

    fn transit_detected(&mut self, t: usize, i: usize) -> State {
        let severe_state = if self.hospitals_full() {
            State::Unattended
        } else {
            State::Severe(0)
        };
        let opts = [State::Immune(0), severe_state, State::Detected(t + 1)];
        let w = [
            sat_index(&self.config.infected_immune_profile, t),
            sat_index(&self.config.infected_severe_profile, t),
        ];
        let s = Simulation::sample_state(&opts, &w);
        self.handle_r0(i, s);
        self.counter.transit(State::Detected(0), s);
        s
    }

    fn transit_unattended(&mut self) -> State {
        let newstate = if self.hospitals_full() {
            State::Dead
        } else {
            State::Severe(1)
        };
        self.counter.transit(State::Unattended, newstate);
        newstate
    }

    fn transit_severe(&mut self, t: usize) -> State {
        let opts = [State::Immune(0), State::Dead, State::Severe(t + 1)];
        let w = [
            sat_index(&self.config.severe_immune_profile, t),
            sat_index(&self.config.severe_dead_profile, t),
        ];
        let s = Simulation::sample_state(&opts, &w);
        self.counter.transit(State::Severe(0), s);
        s
    }

    fn transit_immune(&mut self, t: usize) -> State {
        let opts = [State::Susceptible, State::Immune(t + 1)];
        let w = [sat_index(&self.config.immune_susceptible_profile, t)];
        let s = Simulation::sample_state(&opts, &w);
        self.counter.transit(State::Immune(0), s);
        s
    }
}

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}
