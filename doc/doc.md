### About

This is a simulation of a simplified model of epidemic response which attempts
to account for both dynamics of disease propagation, the saturation of the
healthcare system, and the effect of policy responses. The default parameters
and the choice of policies attempt to describe the current Covid-19 crisis.

The user interface allows users to choose when to set policies as a response to
the development of the disease and to vary multiple parameters.

The simulation can be viewed as an educational tool, and allows to visualize the
impact of the pandemic as a function of both policy choices and yet unknown
characteristics of the disease.  However please do read the disclaimer below.

### Important disclaimer

I am not an epidemiologist and I am mostly using my undergraduate-level
knowledge in this work. Some attempts by particle physicist to produce models
for the coronavirus situation [have been rather
schlocky](https://www.science20.com/tommaso_dorigo/the_virus_that_turns_physicists_into_crackpots-246490)
and have led to far too strong wrong conclusions resting wobbly grounds. This
simulation is emphatically not a research project, and has no aspirations to
predict the future. The modelling is simplistic and both the choice the model
itself and default parameters reflect my own biases and lack of knowledge. For
example different age groups are not modelled because I don't really know what
would look like (and don't know that such policy has been applied particularly
effectively anywhere in the world).

That said, I do believe this is an useful exercise for myself and hopefully
others. Rather that making predictions for the future, I have tried to explain
to myself the current policy debate and, hopefully in a way that can be useful
to others.

I believe the utility of this project is twofold:

  - Ascertain that the outcome of the models are hugely dependent on parameters
	that are currently not well known, such as the proportion of undetected
	asymptomatic cases, or the long term immunity. Any certain claims coming
	from modelling should come with good explanations on how the parameters are
	fixed, and what the actual uncertainty on the conclusions is.  Indeed
	different modelling efforts, including those done by dedicated teams from
	renowned organizations can reach vastly different conclusions, which in turn
	can [greatly impact government
	action](https://bylinetimes.com/2020/03/23/covid-19-special-investigation-part-one-the-politicised-science-that-nudged-the-johnson-government-to-safeguard-the-economy-over-british-lives/).

  - Serve as an education tool that allows public to recognize the merit and
    critically evaluate the need various public policy proposals.

### The model

The simulation tracks the evolution of a set of agents, which could model the
population of a city. Each agent is in one of
the following states:

  - Susceptible
  - Infected (Undetected)
  - Infected (Detected)
  - Severe
  - Unattended
  - Immune
  - Dead

The evolution proceeds in discrete time events, *days*. On each day, agents can
transition between stated according to

![Diagram of transitions between different states](flow.svg)

The model is similar to [commonly used simplified
descriptions](https://en.wikipedia.org/wiki/Compartmental_models_in_epidemiology),
but placing more emphasis in aspects that are relevant to the current crisis,
such as hospital saturation or the propagation of the disease by asymptomatic
carriers. It also used a [complex
network](https://en.wikipedia.org/wiki/Complex_network) to model the disease
propagation among different types of contacts. Many settings of the simulation can be controlled trough the
<a class="anchor-link" data-target="#configure-collapse" href="#configure-lead">Configure Simulation interface</a>. In particular it allows
to set probabilities for the various transitions as a function of time.

<div class="alert alert-secondary">
Note: Transition chances are parametrized as the probability of a given
transition happening assuming no other transition has happened that day. When
there are several possible transitions from one state to others (for example a
Severe agent can become either Dead or Immune), the probability of no
transition is fixed (as the product of probabilities of each of the possible
transitions not happening). A random number then decides whether the agent stays
in the same state or some of the possible transitions occur. If any transition
does happen, the probability of each possible transition is proportional to the
user entered setting.

For example if on a given day the probability of the transition Severe -> Immune
is 80% (as entered by the user, that is, assuming no other transitions happen)
and the probability Severe -> Dead is 20%, the actual transition probabilities
are:

  - Severe -> Severe (no transition): 16%
  - Severe -> Immune: 67.2%
  - Severe -> Dead: 16.8%

When probabilities are sufficiently small, the
difference is negligible. For example if instead the independent transition probabilities are
8% for the Severe -> Immune transition and 2% for the Severe -> Dead transition,
the actual probabilities are

  - Severe -> Severe (no transition): 90.16%
  - Severe -> Immune: 7.872%
  - Severe -> Dead: 1.968%

This way of parametrizing  has the advantage of allowing to think of
probabilities of the various transitions as if they were independent and not
having to worry that they e.g.  add up to 100%.

</div>

The dynamics of each possible transition as well as the relevant settings that
control them are described next.

#### Disease propagation

The probability of an Infected agent to transmit the disease to a Susceptible
one depends on the number of days elapsed since the infection (which models the
development of the disease), whether the agent is Detected or Undetected (which
is assumed to make people behave differently) on the interactions
with other agents.

The interactions leading to infection are modelled in terms of a set of networks
([undirected
graphs](https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)#Undirected_graph)):
Agents are arranged in three levels of networks:

  - Household network
  - Workplace network
  - World network

The disease spreads from Infected (Detected or Undetected) to Susceptible agents
that are connected to them by some of the networks.

Each agent is assigned to one household and one workplace, and it is connected
to the unique World network, which models the random infection-risking
interactions between the population. Each network is associated to different
infectability strengths, for either Detected or Undetected Infected agents,
expressed as a percentage of some max some maximum daily infectability. By
default it is assumed that the infectability is strongest for <a
class="anchor-link" href=#family_contact_undetected_coef>Undetected agents in
Household interactions</a> (and the strength is set to 100% by convention), and
the Household infectability decrease relatively little when a patient is <a
class="anchor-link" href="#family_contact_detected_coef">known to be
infected</a>.  <a class="anchor-link"
href="#workplace_contact_undetected_coef">Workplace</a> and <a
class="anchor-link" href="#world_contact_undetected_coef">World</a>
infectability strengths are lower, and also decrease strongly when a patient is
known to be infected. All strengths are tunable, and also can be influenced by
policy choices.


Each household network is a [fully
connected](https://en.wikipedia.org/wiki/Complete_graph) graph. The distribution
of household sizes <a class="anchor-link" href="#family_sizes">can be controlled explicitly</a>.


The size of each workplace follows a [Binomial
distribution](https://en.wikipedia.org/wiki/Binomial_distribution) where the
average size of the workplaces <a class="anchor-link"
href="#average_workplace_size">is controlled by the user</a>. This is the result
of assigning each agent to a workplace at random, with equal probability, with
the number of workplaces being chosen to reflect the mean size set by the user.

Each workplace network as well as the world network are [Erdős–Rényi
networks](https://en.wikipedia.org/wiki/Erd%C5%91s%E2%80%93R%C3%A9nyi_model):
That is, each pair of nodes is connected with an independent, constant,
probability. By default <a class="anchor-link"
hfref="#workplace-connectivity">Workplace connectivity</a> is almost full, and
World connectivity expressed in terms of the number of <a class="anchor-link"
href="#average_world_connections">average daily interactions</a> with random
agents, is lower, yet high enough to ensure that the network is almost surely
[connected](https://en.wikipedia.org/wiki/Connectivity_%28graph_theory%29#Connected_graph)
(that is there exists an indirect path in the World network between each pair of
agents, implying that it is possible that every agent gets infected through the
World network).

Currently all of the networks stay fixed throughout the simulation.

The infection rates are then computed as follow: On a given day, each
Susceptible agent has a probability of getting becoming infected for each of the
Infected agents it is connected to in all of the three networks. The infection
probabilities are independent and the Susceptible agent becomes Infected
(Undetected) if any single of its daily interactions results in an infection.
The infection probability is the product of a <a
href="#susceptible_infected_profile" class="anchor-link">factor</a> dependent on
the disease (specifically on the number of says since infection, and which can
be set by the user) and a strength factor depending on the type of network that
mediated the interaction (Household, Workplace or World) and whether the
Infected agent was Detected or Undetected.

At the beginning of the simulation <a class="anchor-link"
href="#initial_outbreak_size"> a few</a> agents start off as Infected
(Undetected), while the rest of the population is Susceptible. The disease then
spreads across the networks.

#### Detection

Each Infected (Undetected) agent has a <a class="anchor-link"
href="#infected_detected_profile">daily probability</a> of becoming Detected
spontaneously. This probability varies as a function of the number of says since
infection and is settable by the user. This models people assuming they have
contracted the disease, for example based on their symptoms. It is assumed that
the disease evolution is not affected by whether the agent is Detected or
Undetected, but however it their behaviour changes (for example they largely
stop going to work) leading to a smaller risk of infecting others. This is
parametrized by the infectability strengths explained above.

#### Disease evolution

Infected agents have a daily chance <a class="anchor-link"
href="#ingected_immune_profile">healing</a> (thus becoming Immune) or <a
class="anchor-link" href="#infected_severe_profile">worsen</a> and require
hospital assistance. These chances depend on the number of days elapsed since
the agent became Infected. Agents that have worsened and can be attended in the
hospital become Severe, and Unattended if hospitals are saturated, as described
next. Severe patients have a daily chance of <a class="anchor-link"
href="#severe_immune_profile">healing</a> and becoming Immune and a daily chance
of becoming <a class="anchor-link" href="#severe_dead_profile">Dead</a>. The
probabilities for each day since hospitalization can be set individually.

#### Hospital resources

Hospital resource scarcity is modelled by the <a class="anchor-link"
href="#hospital_capacity">total number of patients that can be hospitalized at
once</a>. If an agent requires hospitalization and the number of Severe patients
matches this threshold, then the agent becomes Unattended. The next day
unattended agents become Severe if there are hospital slots available or Dead
otherwise.

<div class="alert alert-secondary">
Note: For simplicity Severe and Unattended agents are typically reported
together in the user interface.
</div>

#### Immunity loss

The simulation allows for the possibility of immune agents losing their immunity
and becoming immune again. This is parametrized by a <a class="anchor-link"
href="#immune_susceptible_profile">daily probability</a> of becoming Susceptible
as a function of the number of days since infection.


### Policy choices

The simulation allows to estimate the effects of policies that influence the
disease propagation and are implemented as a response to various events.
Specifically policies can be triggered as a response of agents in a given state
(for example Detected cases, Severe patients that need hospitalization or Dead
agents) exceeding (or, alternatively, falling short of) a threshold set by the
user.

The policies are configurable through the set policies menu <a
class="anchor-link" data-target="#policy-collapse" href="#policy-lead">Set policies menu</a>.  The currently
available policies are described next.


#### Shut workplace

A given percentage of workplaces shut down completely and workplace virus
transition trough them is eliminated.

#### Social distancing

The propagation of the disease is reduced for Workplace and World interactions
by an amount set by the user. This affects only the propagation by Undetected
agents, but not by Detected ones.

#### Enhanced self isolation

The propagation of the disease is reduced in interactions with Detected agents,
by an amount set by the user.

#### Lockdown

Social contacts are reduced, resulting in a fraction of the World connections
being disabled.

#### Contact tracing

Reveal Infected agents among the contacts of each new Detected agent and in turn
transform them into Detected. The maximum number of daily tests is limited and
can be set by the user.

The tracing works by maintaining a queue of agents to be tested. Each appearance
of a Detected agents causes their contacts to be added to the queue. Household
contacts are given priority with respect to Workplace contacts, and both are
given priority with respect to World contacts. Only Susceptible, Immune and
Infected (Undetected) agents are added to the queue.

On each day, contacts are pulled from the queue in order of priority, until the
queue is empty or the daily test limit is reached. Infected (Undetected) contacts that are
selected will become Infected (Detected). Their contacts are subsequently added
to the queue, but not tested until the next day. Susceptible agents that get
tested will not be tested again for three days.

The contacts that are not selected remain in the queue with the same priority.
The size of the queue is limited to three times the maximum size. Higher
priority contacts will evict lower priority ones when the maximum size is
reached.

### Technical details

The code of the simulation can be found here:

<https://github.com/Zaharid/virus_simulation/>


The simulation runs entirely on the client browser and does not interact with a
server or store any user data.

