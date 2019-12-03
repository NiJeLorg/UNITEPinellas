/* Simple data platform mapping app functions */

/* geographic constants */
const baseGeoAPI = "https://api.censusreporter.org/1.0/geo/show/tiger2018?geo_ids="
const pcgid = '05000US12103';
//const sl = {'block_group':'150', 'tract':'140', 'zip_code':'860', 'puma':'795', 'place': '160', 'state_house':'620', 'state_senate':'610', 'congressional_district':'500'}

/* data API constants */
const baseDataURL = 'https://api.censusreporter.org/1.0/data/show/latest?'

/* other constants */
const legend = L.control({position: 'bottomright'});

/* variables */
let map;
let selected_sl;
let geoFeatures = {'150':{}, '140':{}, '860':{}, '795':{}, '160':{}, '620':{}, '610':{}, '500':{}};
let geoJsons = {'150':{}, '140':{}, '860':{}, '795':{}, '160':{}, '620':{}, '610':{}, '500':{}};
let dataAPICall;
let selected_tableID;
let selected_tableKey;
let color;

// check to see which value is selected in the geography drop down
if ($('#geography-select').val()) {
	selected_sl = $('#geography-select').val();
} else {
	selected_sl = '795'; // default summary level is Census Defined Place
}


function initMap() {
	createMap();
	updateGeography();
}

function createMap() {
	map = L.map('map').setView([27.865129, -82.678459], 11);
	L.tileLayer('https://{s}.basemaps.cartocdn.com/{style}/{z}/{x}/{y}' + (L.Browser.retina ? '@2x.png' : '.png'), {
		attribution:'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
		subdomains: 'abcd',
		style: 'light_all',
		maxZoom: 20,
		minZoom: 0
	}).addTo(map);
}

function updateGeography() {
	// if geography is empty, make API call and store in geojsons dictionary
	if (isEmpty(geoFeatures[selected_sl])) {
		geoAPI = baseGeoAPI + selected_sl + '|' + pcgid;
		d3.json(geoAPI).then(function(json, error) {
			if (error) return console.warn(error);
			geoFeatures[selected_sl] = json.features;
			// pass to a function to make a geojson
			updateGeojson();
		})
	} else {
		updateGeojson();
	}

}

function updateGeojson() {
	// is table selected?
	if (selected_tableID) {
		mergeDataWGeoFeatures();
	}
	// check for existence of geojson
	else if (!map.hasLayer(geoJsons[selected_sl])) {
		geoJsons[selected_sl] = L.geoJSON(geoFeatures[selected_sl], {style: outlineStyle, onEachFeature: outlineOnEachFeature});
		geoJsons[selected_sl].addTo(map);
	}

}

function removeGeojson() {
	if (map.hasLayer(geoJsons[selected_sl])) {
		map.removeLayer(geoJsons[selected_sl]);
	}
}

function mergeDataWGeoFeatures() {
	// select data from a specific table and merge with geoFeatures
	dataAPICall = baseDataURL + "table_ids=" + selected_tableID + "&geo_ids=" + selected_sl + '|' + pcgid;
	console.log(dataAPICall);
	d3.json(dataAPICall).then(function(json, error) {
		if (error) return console.warn(error);
		let values = [];
		for (let geoid in json.data) {
			for (let i = 0; i < geoFeatures[selected_sl].length; i++) {
				if (geoid == geoFeatures[selected_sl][i].properties.geoid) {
					geoFeatures[selected_sl][i].properties[selected_tableID] = json.data[geoid][selected_tableID];
					values.push(geoFeatures[selected_sl][i].properties[selected_tableID].estimate[selected_tableKey])
				}
			}
		}
		// create color scale
		color = d3.scaleSequentialQuantile(values, d3.interpolateBlues)

		// create geojson
		geoJsons[selected_sl] = L.geoJSON(geoFeatures[selected_sl], {style: style, onEachFeature: onEachFeature});
		geoJsons[selected_sl].addTo(map);
	});

}

function outlineStyle(feature) {
	return {
		fillColor: '#fde28e',
		weight: 0.5,
		opacity: 1,
		color: '#666',
		fillOpacity: 0.3
	};
}

function outlineOnEachFeature(feature, layer) {
	layer.bindTooltip("<h3 class='f5 ma0 gray ttu'>"+ feature.properties.name + "</h3>", {sticky: true});
}


function style(feature) {
	return {
		fillColor: color(feature.properties[selected_tableID].estimate[selected_tableKey]),
		weight: 0.5,
		opacity: 1,
		color: 'white',
		fillOpacity: 0.5
	};
}

function highlightFeature(e) {
	var layer = e.target;

	layer.setStyle({
		weight: 2,
		color: '#666',
		dashArray: '',
		fillOpacity: 0.7
	});

	if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
		layer.bringToFront();
	}
}

function resetHighlight(e) {
	geoJsons[selected_sl].resetStyle(e.target);
}



function onEachFeature(feature, layer) {
	layer.on({
		mouseover: highlightFeature,
		mouseout: resetHighlight
	});

	layer.bindTooltip("<h3 class='f5 ma0 gray ttu'>"+ feature.properties.name + "</h3><p class='gray ma0'>"+ layer.feature.properties[selected_tableID].estimate[selected_tableKey] +"</p>", {sticky: true, className: 'housing-tooltip', permanent: false});

	// layer.bindPopup(function (layer) {
	// 	console.log(layer);
	// 	return layer.feature.properties[selected_tableID].estimate[selected_tableKey];
	// });

	layer.bindPopup("<h3 class='f5 mb1 gray ttu'>Title</h3><p class='gray'>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p><a class='f7 fw6 link grow no-underline ba br2 w-100 tc ph3 pv1 mb2 dib ttu light-blue  href='#0'>Report</a>");
}

legend.onAdd = function (map) {

	var div = L.DomUtil.create('div', 'info legend'),
		grades = [0, 5000, 12500, 25000, 50000, 75000, 100000, 250000],
		labels = [];

	// loop through our density intervals and generate a label with a colored square for each interval
	for (var i = 0; i < grades.length; i++) {
		div.innerHTML +=
			'<i style="background:' + getColor(grades[i] + 1) + '"></i> $' +
			grades[i] + (grades[i + 1] ? ' &ndash; $' + grades[i + 1] + '<br>' : '+');
	}

	return div;
};

// listeners
$('#geography-select').on('change', function (e) {
	removeGeojson();
	selected_sl = this.value;
	updateGeography();
});

$('.topic').click(function() {
	$('#intro-text-and-buttons').hide("slow");
	$('#controls').show("slow");
	// set dropdown based on clicked button
	$("#issue-select").val($(this).text());
	$("#issue-select").trigger("change");
	//TO DO: set up options based on selected category
});

$("#issue-select").on('change', function (e) {
	// TO DO assign default layer for each issue
	if (this.value == "Housing") {
		selected_tableID = 'B25071';
		selected_tableKey = 'B25071001';
	}

	// join data to geographies
	removeGeojson();
	updateGeography();

});




// initialize
window.onload = initMap;

// utility functions
function isEmpty(obj) {
	return Object.keys(obj).length === 0;
}


/* maps TO DO: build map of issues, tables*/
let metadata = {'Justice':{}, 'Children and Youth':{}, 'Economics':{}, 'Housing':{}, 'Civic Participation':{}}
metadata['Housing'] = {'B25071': ''}
