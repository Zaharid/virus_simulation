
//I have no idea why, but sorting by "value" works even though it doesn't make sense.
export const timeprofile_spec = {
  "$schema": "https://vega.github.io/schema/vega-lite/v4.json",
  "description": "A time profile chart",
  "title": "Time profile",
  "width": 500,
  "data": {
	  "name": "mydata"
  },
  "transform": [{"calculate": "isNumber(datum.day) ? datum.day : MAX_VALUE ", "as": "sortvalue"}],
  "layer": [
  {
  "mark": "bar",
  "encoding": {
    "x": {
		"field": "day", "type": "ordinal", "axis": {"labelAngle": 0}, "sort": {"field": "sortvalue", "type": "quantitative"}
	},
    "y": {"field": "value", "type": "quantitative"},
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

const categories = ["Severe", "Dead", "Infected (Undetected)", "Infected (Detected)", "Inmune", "Susceptible"];


export const dist_spec = {
  "$schema": "https://vega.github.io/schema/vega-lite/v4.json",
  "description": "Distribution",
  "width": 200,
  "height": 150,
  "data": {
	  "name": "mydata"
  },
  "mark": "bar",
  "encoding": {
    "x": {"field": "x", "title": "value", "type": "ordinal", "axis": {"labelAngle": 0}},
    "y": {"field": "y", "title": "Frequency", "type": "quantitative"}
  }
}

export const population_spec = {"$schema": "https://vega.github.io/schema/vega-lite/v4.json",
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
      //"scale": {"type": "symlog", "constant": 1},
	  "scale": {"domain": [0,300000]}//,
      //"axis": {"values": [0, 50000, 100000, 150000, 200000, 250000, 300000]}
    },
	"order": {"field": "cat_order", "type": "quantitative"},
    "tooltip": [
		  {"field": "time", "type": "quantitative", "title": "day"},
		  {"field": "population", "type": "ordinal", "title": "Group"},
		  {"field": "value", "type": "quantitative", "title": "Population count"}
	  ]
	//"y2": {"field": "v2"}
  }
}

export const severe_spec = {"$schema": "https://vega.github.io/schema/vega-lite/v4.json",
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
