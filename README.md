# A coronavirus simulation

A simplistic model of disease propagation and the effect of public policies on
it. Runs on the browser. The backend is implemented with Rust + WebAssembley and
the front end with JavaScript.

The result is deployed at:

> <https://zigzah.com/virus/>

# Why

The main purpose is to explain myself the virus propagation. Hopefully the
result can be useful for others as well.

# Model description

The model is described in the
[docs](https://github.com/Zaharid/virus_simulation/tree/master/doc).

# Developing

I have only tested the setup on an Ubuntu based system.

You will need an up to date installation of
[Rust](https://www.rust-lang.org/tools/install),
[wasm-pack](https://rustwasm.github.io/wasm-pack/installer/),
[nodejs](https://nodejs.org/en/) and [npm](https://www.npmjs.com/). Note that
nodejs is fairly outdated in the Ubuntu packages. I used the trick described
[here](https://askubuntu.com/a/480642/293290) to get a version that works.

The original layout of the project was based on
[wasm-pack-template](https://github.com/rustwasm/wasm-pack-template).

With this setup, use

```
npm install
```
in the root folder of this repository to obtain the JavaScript dependencies.

Use

```
npm run start
```
to compile and run a development server and
```
npm run build
```

to obtain a deployable version. Note that you do need some sort of URL based
server in order to retrieve WebAssembley files. `file://` locations do not work.

# File structure

The bulk of the simulation code goes into
[src/lib.rs](https://github.com/Zaharid/virus_simulation/blob/master/src/lib.rs).

The rust code is compiled to WebAssembley and it is then interfaced to the JS
frontend. The simulation code lives in a separate thread and is interfaced to
the rest of the frontend with a  [web
worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).
The worker code is in [webworker/worker.js](https://github.com/Zaharid/virus_simulation/blob/master/webworker/worker.js).

The user interface code is in the
[js/](https://github.com/Zaharid/virus_simulation/tree/master/js) folder. In
particular
[index.js](https://github.com/Zaharid/virus_simulation/blob/master/js/index.js)
is the entry point and handles  the communication with the web worker.

[Vega-lite](https://vega.github.io/vega-lite/) is used for plotting. The
specification code is in
[js/plot_specs.js](https://github.com/Zaharid/virus_simulation/blob/master/js/plot_specs.js).
