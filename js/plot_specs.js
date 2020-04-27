
//I have no idea why, but sorting by "value" works even though it doesn't make sense.
export const timeprofile_spec =  function(title, xlabel, ylabel){
    if (xlabel==undefined){
       xlabel = "day";
    }
    if (ylabel==undefined){
        ylabel = "Probability (%)";
    }
 return {
      "$schema": "https://vega.github.io/schema/vega-lite/v4.json",
      "description": "A time profile chart",
      "title": title,
      "width": "container",
      "data": {
          "name": "mydata"
      },
      "transform": [{"calculate": "isNumber(datum.day) ? datum.day : MAX_VALUE ", "as": "sortvalue"}],
      "layer": [
      {
      "mark": "bar",
      "encoding": {
        "x": {
            "field": "day", "title": xlabel, "type": "ordinal", "axis": {
                "labelAngle": 0}
            ,
            "sort": {"field": "sortvalue", "type": "quantitative"}
        },
        "y": {"field": "value", "type": "quantitative", "title": ylabel},
        "order": {"field": "value", "type": "ordinal"},
      }
      },
      {
      "mark": "bar",
      "transform": [{"filter": "datum.day==='...'"}],
      "encoding": {

        "x": {
            "field": "day", "type": "ordinal", "axis": {"labelAngle": 0}, "sort": {"field": "sortvalue", "type": "quantitative"}
        },
        "color": {"value": "#cccccc"},
        "y": {
            "field": "value",
            "type": "quantitative"
        },
        "tooltip": {"value": "Last value is repeated subsequent days"},
        "order": {"field": "value", "type": "ordinal"},
      }
      }


      ]
    };
}

const categories = ["Severe", "Dead", "Infected (Undetected)", "Infected (Detected)", "Immune", "Susceptible"];
const colors = ["#e7298a", "#666666", "#d95f02", "#e6ab02", "#66a61e", "#1b9e77"];


export const dist_spec = {
  "$schema": "https://vega.github.io/schema/vega-lite/v4.json",
  "title": "Household size distribution",
  "description": "Distribution",
  "width": "container",
  "data": {
      "name": "mydata"
  },
  "mark": "bar",
  "encoding": {
    "x": {"field": "x", "title": "Number of habitants", "type": "ordinal", "axis": {"labelAngle": 0}},
    "y": {"field": "y", "title": "Frequency", "type": "quantitative"}
  }
}

const day_since_outbreak_x = {
    x: {
        field: "time",
        type: "quantitative",
        title: "day since outbreak",
        scale: {nice: false},
        axis: {tickMinStep: 1},
    },
}

const policy_mark_layer = [
    {
        data: {
            name: "policy_data"
        },
        mark: "rule",
        encoding: {
            x: {
                field: "time",
                type: "quantitative"
            },
            color: {
                value: "#7570b3"
            },
            strokeWidth: {
                value: 2
            },
            tooltip: [{
                    field: "policy",
                    type: "nominal"
                },
                {
                    field: "time",
                    type: "quantitative",
                    title: "day"
                },
            ],
        },
    },

]

export function population_spec(total_population) {
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v4.json",
        "data": {
            "name": "mydata"
        },
        "width": "container",
        "title": "Population distribution",
        "height": 250,
        "layer": [{
                "transform": [{
                    "calculate": `indexof(${JSON.stringify(categories)}, datum.population)`,
                    "as": "cat_order"
                }],
                "mark": {
                    "type": "area",
                },
                "encoding": {
                    ...day_since_outbreak_x,
                    "color": {
                        "field": "population",
                        "type": "nominal",
                        "sort": categories,
                        "scale": {
                            "domain": categories,
                            "range": colors,
                        },
                    },
                    "y": {
                        "field": "value",
                        "title": "Population count",
                        "type": "quantitative",
                        "stack": true,
                        "scale": {
                            "domain": [0, total_population]
                        },
                        "axis": {"tickMinStep": 1},
                    },
                    "order": {
                        "field": "cat_order",
                        "type": "quantitative"
                    },
                    "tooltip": [{
                            "field": "time",
                            "type": "quantitative",
                            "title": "day"
                        },
                        {
                            "field": "population",
                            "type": "ordinal",
                            "title": "Group"
                        },
                        {
                            "field": "value",
                            "type": "quantitative",
                            "title": "Population count"
                        }
                    ]
                }
            },
            ...policy_mark_layer,

        ]

    };
}

export const severe_spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v4.json",
    "data": {"name": "mydata"},
    "width": "container",
    "title": "Hospital status",
    "height": 250,
    "layer": [
        {
            "mark": "line",
            "encoding":{
                ...day_since_outbreak_x,
                "y":{
                    "field": "value",
                    "type": "quantitative",
                    "title": "Number of patients",
                    "axis": {"tickMinStep": 1},
                },
                "color":{
                    "field": "kind",
                    "title": "",
                    "type": "nominal",
                    "scale": {
                        "domain": [ "Severe patients",  "Hospital capacity"],
                        "range": ["#e7298a", "black"]
                    }
                }
            }
        },
        {
            "transform": [{"filter": {"and": [
                "datum.kind == 'Severe patients'",
                "datum.value >= datum.current_capacity"
            ]}}],
            "mark": "line",
            "encoding": {
                "x":{
                    "field": "time",
                    "type": "quantitative"
                },
                "y":{
                    "field": "value",
                    "type": "quantitative",
                },
                "color": {"value": "#e7298a"},
                "strokeWidth": {"value": 5}
            }
        },
        ...policy_mark_layer,
    ],

}


export function daily_events_spec(cat){
    return {
        $schema: "https://vega.github.io/schema/vega-lite/v4.json",
        width: "container",
        title: `Daily new ${cat}`,
        height: 225,
        layer: [
            {
                data: {name: "mydata"},
                transform: [{"filter": `datum['Daily changes']=== '${cat}'`}],
                mark: "bar",
                encoding: {
                    ...day_since_outbreak_x,
                    y: {
                        field: "daily new",
                        type: "quantitative",
                        axis: {"tickMinStep": 1},
                    },
                    color: {
                        value: colors[categories.indexOf(cat)],
                    }
                }
            },
            ...policy_mark_layer,
        ]
    };
}

export const r_spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v4.json",
    width: "container",
    title: "Reproduction number",
    height: 100,
    data: {name: "mydata"},
    transform: [
        {
            frame: [-5, 5],
            window: [
                {
                    field: "r",
                    op: "mean",
                    as: "rolling_mean",
                },
            ],

        },
    ],
    layer: [
        {
            mark: {
                type: "line",
            },
            encoding: {
                ...day_since_outbreak_x,
                y: {
                    field: "rolling_mean",
                    type: "quantitative",
                    title: "Reproduction number",
                }

            }

        },
        {
            data: {values: [{y: 1}]},
            mark: "rule",
            encoding: {
                y: {
                    field: "y",
                    type: "quantitative",
                },
            }

        },
        ...policy_mark_layer,
    ]
}
