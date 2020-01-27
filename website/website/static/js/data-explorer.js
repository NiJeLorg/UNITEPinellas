/* Simple data platform mapping app functions */

/* geographic constants */
const baseGeoAPI = "https://api.censusreporter.org/1.0/geo/show/tiger2018?geo_ids="
const pcgid = '05000US12103';
//const sl = {'block_group':'150', 'tract':'140', 'zip_code':'860', 'puma':'795', 'place': '160', 'state_house':'620', 'state_senate':'610', 'congressional_district':'500'}

/* data API constants */
const baseDataURL = 'https://api.censusreporter.org/1.0/data/show/latest?'
const baseParentsURL = 'https://api.censusreporter.org/1.0/geo/tiger2018/';

/* other constants */
const legend = L.control({position: 'bottomright'});

/* variables */
let map;
let selected_sl;
let geoFeatures = {'150':{}, '140':{}, '860':{}, '795':{}, '160':{}, '620':{}, '610':{}, '500':{}};
let geoJsons = {'150':{}, '140':{}, '860':{}, '795':{}, '160':{}, '620':{}, '610':{}, '500':{}};
let dataAPICall;
let selected_category;
let selected_tableID;
let selected_numerator;
let selected_denominator;
let selected_data_type;
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
		maxZoom: 15,
		minZoom: 10
	}).addTo(map);
}

function updateGeography() {
	// if geography is empty, make API call and store in geojsons dictionary
	if (isEmpty(geoFeatures[selected_sl])) {
		// **** pull from local files ****//
		geoFile = static_url + 'data/' + selected_sl + '.geojson';
		d3.json(geoFile).then(function(json, error) {
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
	// if the summary level is not city
	// select data from a specific table and merge with geoFeatures
	dataAPICall = baseDataURL + "table_ids=" + selected_tableID + "&geo_ids=" + selected_sl + '|' + pcgid;
	console.log(dataAPICall);
	d3.json(dataAPICall).then(function(json, error) {
		if (error) return console.warn(error);
		let values = [];
		let value;
		let properties;
		for (let geoid in json.data) {
			for (let i = 0; i < geoFeatures[selected_sl].length; i++) {
				if (geoid == geoFeatures[selected_sl][i].properties.created_geoid) {
					geoFeatures[selected_sl][i].properties[selected_tableID] = json.data[geoid][selected_tableID];
					properties = geoFeatures[selected_sl][i].properties[selected_tableID]
					value = calcValue(properties);
					// set value for use later
					geoFeatures[selected_sl][i].properties[selected_tableID].value = value
					values.push(value);
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

function calcValue(properties) {
	let numerators = [];
	let denominator;
	let num = 0;
	let value = 0;
	// loop through numerators and sum
	let key;
	for (let j = 0; j < metadata[selected_category][selected_tableID]['numerator'].length; j++) {
		key = metadata[selected_category][selected_tableID]['numerator'][j];
		numerators.push(properties.estimate[key])
	}
	num = sumNumerator(numerators);
	// normalize if denom
	let denom_key = metadata[selected_category][selected_tableID]['denominator']
	if (denom_key) {
		denominator = properties.estimate[denom_key]
		value = normalize(num, denominator)
	} else {
		value = num;
	}
	return value;
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
	layer.bindTooltip("<h3 class='f5 ma0 gray ttu'>"+ feature.properties.display_name + "</h3>", {sticky: true});
}


function style(feature) {
	return {
		fillColor: color(feature.properties[selected_tableID].value),
		weight: 0.5,
		opacity: 1,
		color: 'white',
		fillOpacity: 0.5
	};
}

function highlightFeature(e) {
	let layer = e.target;

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

function onLayerClick(e) {
	let popup = e.target.getPopup();
	let parentGeoIDs = []
	let parentData = []

	// call parents API
	parentsAPICall = baseParentsURL + e.target.feature.properties.created_geoid + '/parents'
	console.log(parentsAPICall)

	d3.json(parentsAPICall).then(function(json, error) {
		if (error) return console.warn(error);
		// take only one parent if geography if [1] is county level
		for (let i = 0; i < json.parents.length; i++) {
			parentGeoIDs.push(json.parents[i].geoid)
			// // remove national parent level
			// if (json.parents[i].sumlevel != '010') {
			// 	parentGeoIDs.push(json.parents[i].geoid)
			// }
		}
		// array to comma sep string
		const pgeoid_string = parentGeoIDs.join(",")

		console.log(pgeoid_string);

		// set up data API call for parents
		parentsDataAPICall = baseDataURL + "table_ids=" + selected_tableID + "&geo_ids=" + pgeoid_string;
		console.log(parentsDataAPICall);
		d3.json(parentsDataAPICall).then(function(parents_json, parents_error) {
			if (parents_error) return console.warn(parents_error);
			console.log(parents_json);

			// update the popup
			let popupContent = "<h3 class='f5 mb2 gray ttu'>" + metadata[selected_category][selected_tableID]['title'] + "</h3>";
			let display_value;

			// loop through parents and pull estimates
			for (let i = 0; i < json.parents.length; i++) {

				properties = parents_json.data[json.parents[i].geoid][selected_tableID]
				value = calcValue(properties);

				if (value){
					if (selected_data_type == 'pct_format') {
						display_value = percentFormat(value);
					} else if (selected_data_type == 'pct') {
						display_value = percentify(value);
					} else if (selected_data_type == 'dollar') {
						display_value = dollarify(value);
					} else if (selected_data_type == 'date') {
						display_value = value;
					} else {
						display_value = numberWithCommas(value);
					}
				} else {
					display_value = "N/A";
				}


				popupContent += "<p class='near-black bg-dark-blue pt2 pb2'><span class='w-70 dib v-mid f5 pl2'>"+json.parents[i].display_name+"</span><span class='dib pl3 f5 v-mid'>"+display_value+"</span></p>";
			}


			// popupContent += "<p class='gray'>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>";
			popupContent += "<a class='f7 fw6 link grow no-underline b--light-blue ba br2 w-75 center tc ph3 pv1 mb2 mt3 db ttu gray href='#0'>Report</a>";
			popup.setContent( popupContent );
        	popup.update();


		});


	});

}

function onEachFeature(feature, layer) {
	layer.on({
		mouseover: highlightFeature,
		mouseout: resetHighlight,
		click: onLayerClick
	});

	if (layer.feature.properties[selected_tableID].value){
		if (selected_data_type == 'pct_format') {
			display_value = percentFormat(layer.feature.properties[selected_tableID].value);
		} else if (selected_data_type == 'pct') {
			display_value = percentify(layer.feature.properties[selected_tableID].value);
		} else if (selected_data_type == 'dollar') {
			display_value = dollarify(layer.feature.properties[selected_tableID].value);
		} else if (selected_data_type == 'date') {
			display_value = layer.feature.properties[selected_tableID].value;
		} else {
			display_value = numberWithCommas(layer.feature.properties[selected_tableID].value);
		}
	} else {
		display_value = "N/A";
	}


	layer.bindTooltip("<h3 class='f5 ma0 gray ttu'>"+ feature.properties.display_name + "</h3><p class='gray ma0'>"+ display_value +"</p>", {sticky: true, className: 'housing-tooltip', permanent: false});

	//layer.bindPopup("<h3 class='f5 mb1 gray ttu'>Title</h3><p class='gray'>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p><a class='f7 fw6 link grow no-underline ba br2 w-100 tc ph3 pv1 mb2 dib ttu light-blue  href='#0'>Report</a>");

	layer.bindPopup("<img src='/static/img/loading.gif'>");
}

// populate dataset
function populateDataset() {
	selected_data_type = metadata[selected_category][selected_tableID]['data_type'];
	$("#dataset-title").text(metadata[selected_category][selected_tableID]['title']);
	$("#dataset-description").text(metadata[selected_category][selected_tableID]['description']);

	// join data to geographies
	removeGeojson();
	updateGeography();
}


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
	// TO DO assign default layer for each category
	selected_category = this.value
	if (selected_category == "Housing") {
		selected_tableID = 'B25003';
	}

	// print list of variables
	$('#sub-nav-data-links').html('');
	let link;
	for (let key in metadata[this.value]) {
		link = '<a class="data-link mb3 db link light-blue dim" href="#' + key + '">' + metadata[this.value][key]['title'] + '</a>'
		$('#sub-nav-data-links').append(link);
	}

	populateDataset();


});

$('#sub-nav-data-links').on('click', '.data-link', function() {
	selected_tableID = $(this).attr('href').substring(1);
	console.log(selected_tableID);

	populateDataset();

});


// utility functions
function isEmpty(obj) {
	return Object.keys(obj).length === 0;
}

function sumNumerator(values) {
	let sum = 0;
	for (let i = 0; i < values.length; i++) {
		sum = values[i] + sum;
	}
	return sum;
}

function normalize(num, denom) {
	return num / denom;
}

function percentFormat(value) {
	return value.toFixed(1) + "%";
}

function percentify(value) {
	value = value * 100;
	return value.toFixed(1) + "%";
}

function dollarify(value) {
	return "$" + numberWithCommas(value.toFixed(0));
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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


/* maps TO DO: build map of issues, tables*/
let metadata = {'Justice':{}, 'Children and Youth':{}, 'Economics':{}, 'Housing':{}, 'Civic Participation':{}}

// Housing variables
metadata['Housing']['B25003'] = {
	'numerator': ['B25003002'],
	'denominator': 'B25003001',
	'data_type': 'pct',
	'title': 'Percentage Renter Occupied Housing Units',
	'description': lorem
}

metadata['Housing']['B25123'] = {
	'numerator': ['B25123009','B25123010','B25123011','B25123012'],
	'denominator': 'B25123008',
	'data_type': 'pct',
	'title': 'Percentage of Occupied Rental Units with Substandard Conditions',
	'description': lorem
}

metadata['Housing']['B25035'] = {
	'numerator': ['B25035001'],
	'denominator': null,
	'data_type': 'date',
	'title': 'Median Year of Housing Unit Construction',
	'description': lorem
}

metadata['Housing']['B25071'] = {
	'numerator': ['B25071001'],
	'denominator': null,
	'data_type': 'pct_format',
	'title': 'Median Gross Rent as a Percentage of Household Income',
	'description': lorem
}

metadata['Housing']['B25070'] = {
	'numerator': ['B25070007', 'B25070008', 'B25070009', 'B25070010'],
	'denominator': 'B25070001',
	'data_type': 'pct',
	'title': 'Percentage of Cost Burdened Renter-Occupied Units (>30% Income Spent on Housing)',
	'description': lorem
}

metadata['Housing']['B25091'] = {
	'numerator': ['B25091008', 'B25091009', 'B25091010', 'B25091011', 'B25091019', 'B25091020', 'B25091021', 'B25091022'],
	'denominator': 'B25091001',
	'data_type': 'pct',
	'title': 'Percentage of Cost Burdened Owner-Occupied Units (>30% Income Spent on Housing)',
	'description': lorem
}






// initialize
window.onload = initMap;
