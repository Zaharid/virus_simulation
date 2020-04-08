
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
			"field": "day", "title": xlabel, "type": "ordinal", "axis": {"labelAngle": 0}, "sort": {"field": "sortvalue", "type": "quantitative"}
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

const categories = ["Severe", "Dead", "Infected (Undetected)", "Infected (Detected)", "Inmune", "Susceptible"];


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

export function population_spec(total_population){
	return {
   "$schema": "https://vega.github.io/schema/vega-lite/v4.json",
  "data": {"name": "mydata"},
  "width": 350,
  "height": 250,


  "transform": [
	  {"calculate": `indexof(${JSON.stringify(categories)}, datum.population)`,
	   "as": "cat_order"}
  ],
  "mark": {
	  "type": "area",
  },
  "encoding": {
    "x": {
      "field": "time",
      "type": "quantitative",
	  "title": "days"
    },
    "color": {
      "field": "population",
      "type": "nominal",
      "sort": categories,
      "scale": {
		  "domain": categories,
		  "range": ["#e7298a", "#666666", "#d95f02", "#e6ab02", "#66a61e", "#1b9e77"]},
    },
    "y": {
      "field": "value",
	  "title": "Population count",
      "type": "quantitative",
      "stack": true,
	  "scale": {"domain": [0, total_population]},
    },
	"order": {"field": "cat_order", "type": "quantitative"},
    "tooltip": [
		  {"field": "time", "type": "quantitative", "title": "day"},
		  {"field": "population", "type": "ordinal", "title": "Group"},
		  {"field": "value", "type": "quantitative", "title": "Population count"}
	  ]
  }
 }
}

export const severe_spec = {
	"$schema": "https://vega.github.io/schema/vega-lite/v4.json",
	"data": {"name": "mydata"},
	"width": 300,
	"height": 250,
	"layer": [
		{
			"mark": "line",
			"encoding":{
				"x":{
					"field": "time",
					"type": "quantitative",
					"title": "days"
				},
				"y":{
					"field": "value",
					"type": "quantitative",
					"title": "People"
				},
				"color":{
					"field": "kind",
					"title": "",
					"type": "nominal",
					"scale": {
						"domain": [ "Severe patients",  "Hospital capacity"],
						"range": ["#e7298a", "red"]
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
					"type": "quantitative",
					"title": "days"
				},
				"y":{
					"field": "value",
					"type": "quantitative",
				},
				"color": {"value": "black"},
				"strokeWidth": {"value": 5}
			}
		}
	]

}


export const severe_specxx = {"$schema": "https://vega.github.io/schema/vega-lite/v4.json",
	"data": {"name": "mydata"},
	"transform": [{"filter": "datum.population === 'Severe'"}],
	"width": 350,
	"height": 250,
	"layer":[{
		"mark": "line",
		"encoding": {
			"x": {
				"field": "time",
				"type": "quantitative",
				"title": "days"
			},
			"color": {"value": "#e7298a"},
			"y": {
				"field": "value",
				"type": "quantitative",
				"title": "Severe patients"
			}
		}
	},
	{
		"mark": "line",
		"transform": [
			{"filter": "datum.value >= 2000"},
		],
		"encoding": {
			"x": {
				"field": "time",
				"type": "quantitative",
			},
			"color": {"value": "red"},
			"y": {
				"field": "value",
				"type": "quantitative",
			},
			"strokeWidth": {"value": 5}

		}
	},

	{
		"mark": "rule",
		"data": {"values": {"threshold": 2000}},
		"encoding": {
			"y": {
				"field": "threshold",
				"type": "quantitative",
				"title": "Maximum hospital capacity"
			},
			"color": {"value": "red"}
		}
	}
	]
}
