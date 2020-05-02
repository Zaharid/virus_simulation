mod utils;

use std::collections::hash_set;
use std::collections::VecDeque;
use std::iter;

use wasm_bindgen::prelude::*;
use web_sys;

use rand;
use rand::distributions::weighted::alias_method::WeightedIndex;
use rand::distributions::Distribution;
use rand::Rng;
use rand_distr::Binomial;
use rustc_hash::FxHashSet;
use serde::{Deserialize, Serialize};

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

//https://www.ine.es/en/prensa/ech_2018_en.pdf
const DEFAULT_FAMILY_SIZES: [usize; 5] = [1, 2, 3, 4, 5];
const FAMILY_SIZE_WEIGHTS: [f64; 5] = [25.5, 30.4, 20.8, 17.5, 5.7];

const SUSCEPTIBLE_INFECTED_PROFILE: [f64; 18] = [
    0., 0.007, 0.015, 0.035, 0.035, 0.035, 0.05, 0.05, 0.05, 0.035, 0.035, 0.035, 0.035, 0.015,
    0.0075, 0.0035, 0.0025, 0.00075,
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
    left_nodes: Vec<FxHashSet<usize>>,
    right_nodes: Vec<FxHashSet<usize>>,
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
        self.left_nodes.push(Default::default());
        self.right_nodes.push(Default::default());
        return self.left_nodes.len() - 1;
    }
    fn add_link(&mut self, i: usize, j: usize) -> Option<()> {
        if j < i {
            self.left_nodes.get_mut(i)?.insert(j);
            self.right_nodes.get_mut(j)?.insert(i);
        } else {
            self.left_nodes.get_mut(j)?.insert(i);
            self.right_nodes.get_mut(i)?.insert(j);
        }
        Some(())
    }
    fn remove_link(&mut self, i: usize, j: usize) -> Option<()> {
        if j < i {
            self.left_nodes.get_mut(i)?.remove(&j);
            self.right_nodes.get_mut(j)?.remove(&i);
        } else {
            self.left_nodes.get_mut(j)?.remove(&i);
            self.right_nodes.get_mut(i)?.remove(&j);
        }
        Some(())
    }

    fn iternodes(&self, n: usize) -> iter::Chain<hash_set::Iter<usize>, hash_set::Iter<usize>> {
        return self.left_nodes[n].iter().chain(self.right_nodes[n].iter());
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

#[derive(Default)]
struct ChainSet {
    data: VecDeque<FxHashSet<usize>>,
}

struct PartialDrainChainset<'a> {
    chainset: &'a mut ChainSet,
    drain: Option<Vec<usize>>,
    n: usize,
}

impl Iterator for PartialDrainChainset<'_> {
    type Item = usize;
    fn next(&mut self) -> Option<usize> {
        if let Some(drain) = self.drain.as_mut() {
            if let Some(val) = drain.pop() {
                self.n -= 1;
                return Some(val);
            }
        }
        while self.chainset.data.front()?.is_empty() {
            self.chainset.pop_child();
        }
        let set = self.chainset.data.front_mut()?;
        if self.n <= set.len() {
            self.drain = Some(set.drain().collect());
            self.chainset.pop_child();
            return self.next();
        } else {
            return self.chainset.pop_clean();
        }
    }
}

impl ChainSet {
    fn add_child(&mut self) {
        self.data.push_back(Default::default());
    }

    fn push_child(&mut self, s: FxHashSet<usize>) {
        self.data.push_back(s);
    }

    fn insert(&mut self, value: usize) -> bool {
        for set in self.data.iter() {
            if set.contains(&value) {
                return true;
            }
        }
        if self.data.is_empty() {
            self.add_child();
        }
        return self.data.back_mut().unwrap().insert(value);
    }

    fn contains(&self, value: usize) -> bool {
        for set in self.data.iter() {
            if set.contains(&value) {
                return true;
            }
        }
        false
    }

    fn remove(&mut self, value: usize) -> bool {
        for set in self.data.iter_mut() {
            if set.remove(&value) {
                return true;
            }
        }
        return false;
    }

    fn pop(&mut self) -> Option<usize> {
        for set in self.data.iter_mut() {
            if !set.is_empty() {
                let ele = set.iter().next().unwrap().clone();
                set.remove(&ele);
                return Some(ele);
            }
        }
        None
    }

    fn pop_clean(&mut self) -> Option<usize> {
        let res = self.pop();
        while self.data.front().is_some() && self.data.front().unwrap().is_empty() {
            self.data.pop_front();
        }
        res
    }

    fn pop_child(&mut self) {
        self.data.pop_front();
    }

    fn len(&self) -> usize {
        self.data.iter().map(|x| x.len()).sum()
    }

    fn is_empty(&self) -> bool {
        for set in self.data.iter() {
            if !set.is_empty() {
                return false;
            }
        }
        true
    }
}

struct TestQueue {
    maxsize: usize,
    family_queue: ChainSet,
    workplace_queue: ChainSet,
    world_queue: ChainSet,
    recently_tested: ChainSet,
}

impl TestQueue {
    fn new(maxsize: usize) -> Self {
        let family_queue = Default::default();
        let workplace_queue = Default::default();
        let world_queue = Default::default();
        let recently_tested = Default::default();
        Self {
            maxsize,
            family_queue,
            workplace_queue,
            world_queue,
            recently_tested,
        }
    }

    fn family_full(&self) -> bool {
        self.family_queue.len() >= self.maxsize
    }

    fn workplace_full(&self) -> bool {
        self.workplace_queue.len() >= self.maxsize - self.family_queue.len()
    }

    fn world_full(&self) -> bool {
        self.world_queue.len()
            >= self.maxsize - self.family_queue.len() - self.workplace_queue.len()
    }

    fn len(&self) -> usize {
        self.family_queue.len() + self.workplace_queue.len() + self.world_queue.len()
    }

    fn insert_family(&mut self, value: usize) -> bool {
        if self.family_full() {
            return false;
        }
        if self.recently_tested.contains(value) {
            return false;
        }
        let b = self.workplace_queue.remove(value) | self.world_queue.remove(value);
        if !b && self.len() > self.maxsize - 1 {
            if !self.world_queue.is_empty() {
                self.world_queue.pop_clean();
            } else {
                self.workplace_queue.pop_clean().unwrap();
            }
        }
        self.family_queue.insert(value)
    }

    fn insert_workplace(&mut self, value: usize) -> bool {
        if self.workplace_full() {
            return false;
        }
        if self.family_queue.contains(value) {
            return false;
        }
        if self.recently_tested.contains(value) {
            return false;
        }
        let b = self.world_queue.remove(value);
        if !b && self.len() > self.maxsize - 1 {
            self.world_queue.pop_clean().unwrap();
        }
        self.workplace_queue.insert(value)
    }

    fn insert_world(&mut self, value: usize) -> bool {
        if self.world_full() {
            return false;
        }
        if self.family_queue.contains(value) || self.workplace_queue.contains(value) {
            return false;
        }
        if self.recently_tested.contains(value) {
            return false;
        }
        self.world_queue.insert(value)
    }

    fn tick(&mut self, time: usize) {
        if time > 1 {
            self.recently_tested.pop_child();
        }
        for g in [
            &mut self.family_queue,
            &mut self.workplace_queue,
            &mut self.world_queue,
        ]
        .iter_mut()
        {
            while g.data.front().map_or(false, |v| v.is_empty()) {
                g.pop_child();
            }
            g.add_child();
        }
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
    max_daily_tests: usize,
    test_queue: TestQueue,
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
        let max_daily_tests = 0;
        let test_queue = TestQueue::new(0);
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
            test_queue,
            max_daily_tests,
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
        self.test_queue.tick(self.time);
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
        self.trace_contacts(&mut newstates);
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
    }

    pub fn multiply_world_infectability(&mut self, coef: f64) {
        self.config.world_contact_undetected_coef *= coef;
    }

    pub fn multiply_workplace_infectability(&mut self, coef: f64) {
        self.config.workplace_contact_undetected_coef *= coef;
    }

    pub fn disable_fraction_of_world_connections(&mut self, frac: f64) {
        let mut rng = rand::thread_rng();
        // Find a better algorithm
        let mut to_remove: FxHashSet<usize> = Default::default();
        // This needs to be indexes because of the borrow checker
        for i in 0..self.world_graph.left_nodes.len() {
            for j in self.world_graph.left_nodes[i].iter() {
                if frac > rng.gen() {
                    to_remove.insert(*j);
                }
            }
            for j in to_remove.iter() {
                self.world_graph.remove_link(i, *j);
            }

            to_remove.clear();
        }
    }

    pub fn set_max_contact_tracing(&mut self, max: usize){
        self.test_queue.maxsize = max*3;
        self.max_daily_tests = max;
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
                for n in g.iternodes(i) {
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

    fn trace_contacts_impl(
        &mut self,
        newstates: &mut [State],
    ) -> (FxHashSet<usize>, FxHashSet<usize>) {
        let mut res: FxHashSet<usize> = Default::default();
        let mut recently_tested: FxHashSet<usize> = Default::default();
        let mut n = self.max_daily_tests;
        if n <= 0 {
            return (res, recently_tested);
        }
        let mut queues = [
            &mut self.test_queue.family_queue,
            &mut self.test_queue.workplace_queue,
            &mut self.test_queue.world_queue,
        ];

        for q in queues.iter_mut() {
            for set in q.data.iter_mut() {
                if set.len() >= n {
                    for node in set.drain() {
                        let s = newstates.get_mut(node).unwrap();
                        if let State::Infected(t) = s {
                            let news = State::Detected(*t);
                            self.counter.transit(*s, news);
                            *s = news;
                            n -= 1;
                            res.insert(node);
                        } else if let State::Susceptible | State::Immune(_) = s {
                            recently_tested.insert(node);
                            n -= 1;
                        }
                        if n == 0 {
                            return (res, recently_tested);
                        }
                    }
                } else {
                    while let Some(node) = set.iter().next() {
                        let node = *node;
                        set.remove(&node);
                        let s = newstates.get_mut(node).unwrap();
                        if let State::Infected(t) = s {
                            let news = State::Detected(*t);
                            self.counter.transit(*s, news);
                            *s = news;
                            n -= 1;
                            res.insert(node);
                        } else if let State::Susceptible | State::Immune(_) = s {
                            recently_tested.insert(node);
                            n -= 1;
                        }
                        if n == 0 {
                            return (res, recently_tested);
                        }
                    }
                }
            }
        }
        return (res, recently_tested);
    }

    fn trace_contacts(&mut self, newstates: &mut [State]) {
        let (res, recently_tested) = self.trace_contacts_impl(newstates);
        self.test_queue.recently_tested.push_child(recently_tested);
        for i in res.iter() {
            self.queue_contact_tracing(*i);
        }
    }

    fn queue_contact_tracing(&mut self, i: usize) {
        for n in self.family_graph.iternodes(i) {
            if self.test_queue.family_full() {
                return;
            }
            self.test_queue.insert_family(*n);
        }
        for n in self.workplace_graph.iternodes(i) {
            if self.test_queue.workplace_full() {
                return;
            }
            self.test_queue.insert_workplace(*n);
        }
        for n in self.world_graph.iternodes(i) {
            if self.test_queue.world_full() {
                return;
            }
            self.test_queue.insert_world(*n);
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
        if let State::Detected(_) = s {
            self.queue_contact_tracing(i)
        }
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
