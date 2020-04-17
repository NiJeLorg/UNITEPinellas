/* Simple data platform mapping app functions */

/* geographic constants */
const baseGeoAPI = "https://api.censusreporter.org/1.0/geo/show/tiger2018?geo_ids="
const pcgid = '05000US12103';
//const sl = {'block_group':'150', 'tract':'140', 'zip_code':'860', 'puma':'795', 'place': '160', 'state_house':'620', 'state_senate':'610', 'congressional_district':'500'}

/* data API constants */
const baseDataURL = 'https://api.censusreporter.org/1.0/data/show/latest?'
const baseParentsURL = 'https://api.censusreporter.org/1.0/geo/tiger2018/';

/* other constants */
const legend = L.control({position: 'bottomleft'});

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
let text_color;
let min;
let max;
let display_value_min;
let display_value_max;

// check to see which value is selected in the geography drop down
if ($('#geography-select').val()) {
	selected_sl = $('#geography-select').val();
} else {
	selected_sl = '860'; // default summary level is Zip Code
}


function initMap() {
	createMap();
	updateGeography();
}

function createMap() {
	map = L.map('map',{ zoomControl: false }).setView([27.9, -82.7], 11);
	new L.Control.Zoom({ position: 'bottomright' }).addTo(map);
	new L.Control.geocoder({
		placeholder: 'Address Search',
		showResultIcons: true,
		geocoder: new L.Control.Geocoder.Nominatim({geocodingQueryParams: {viewbox:'-83.0,28.3,-82.3,27.5',bounded:1}})
	  }).addTo(map);
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
	// strip out '-x' from selected_tableID before passing to API
	const strip_selected_tableID = selected_tableID.split('-')[0];
	dataAPICall = baseDataURL + "table_ids=" + strip_selected_tableID + "&geo_ids=" + selected_sl + '|' + pcgid;
	console.log("data API call: ", dataAPICall);
	d3.json(dataAPICall).then(function(json, error) {
		if (error) return console.warn(error);
		let values = [];
		let value;
		let properties;
		for (let geoid in json.data) {
			for (let i = 0; i < geoFeatures[selected_sl].length; i++) {
				value == 0;
				if (geoid == geoFeatures[selected_sl][i].properties.created_geoid) {
					geoFeatures[selected_sl][i].properties[selected_tableID] = json.data[geoid][strip_selected_tableID];
					properties = geoFeatures[selected_sl][i].properties[selected_tableID]
					value = calcValue(properties);
					// set value for use later
					geoFeatures[selected_sl][i].properties[selected_tableID].value = value
					if (typeof value == 'number') {
						values.push(value);
					}
				}
			}

		}
		// create color scale
		const unique_values = values.filter(onlyUnique);
		color = d3.scaleSequentialQuantile(unique_values, d3.interpolateBlues)
		const sum = unique_values.reduce((a, b) => a + b, 0);
		const avg_times_1_25 = (sum / unique_values.length)*1 || 0;
		text_color = d3.scaleThreshold().domain([avg_times_1_25]).range(['#111', 'white'])

		// create geojson
		geoJsons[selected_sl] = L.geoJSON(geoFeatures[selected_sl], {style: style, onEachFeature: onEachFeature});
		geoJsons[selected_sl].addTo(map);

		// get min and max values
		min = d3.min(unique_values);
		max = d3.max(unique_values);

		if (selected_data_type == 'pct_format') {
			display_value_min = percentFormat(min);
			display_value_max = percentFormat(max);
		} else if (selected_data_type == 'pct') {
			display_value_min = percentify(min);
			display_value_max = percentify(max);
		} else if (selected_data_type == 'dollar') {
			display_value_min = dollarify(min);
			display_value_max = dollarify(max);
		} else if (selected_data_type == 'decimal') {
			display_value_min = min.toFixed(2);
			display_value_max = max.toFixed(2);			
		} else if (selected_data_type == 'date') {
			display_value_min = min;
			display_value_max = max;			
		} else {
			display_value_min = numberWithCommas(min);
			display_value_max = numberWithCommas(max);
		}
		
		// add legend
		legend.addTo(map);

		// add sourcing info
		$("#dataset-source").text("Source: Unites States Census Bureau, American Community Survey, " + json.release.years);


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
		if (denominator >= 50) {
			value = normalize(num, denominator)
		} else {
			value = 'Not enough data.'
		}
		
	} else {
		value = num;
	}
	return value;
}

function outlineStyle(feature) {
	return {
		fillColor: '#fde28e',
		weight: 1,
		opacity: 1,
		color: '#666',
		fillOpacity: 0.3
	};
}

function outlineOnEachFeature(feature, layer) {
	layer.bindTooltip("<h3 class='f5 ma0 gray ttu'>"+ feature.properties.display_name + "</h3>", {sticky: true});
}


function style(feature) {
	if (typeof feature.properties[selected_tableID].value == 'number') {
		return {
			fillColor: color(feature.properties[selected_tableID].value),
			weight: 1,
			opacity: 1,
			color: '#666',
			fillOpacity: 0.8
		};
	} else {
		return {
			fillColor: '#aaaaaa',
			weight: 1,
			opacity: 1,
			color: '#666',
			fillOpacity: 0.8
		};
	}

}

function highlightFeature(e) {
	let layer = e.target;

	layer.setStyle({
		weight: 2,
		color: '#666',
		dashArray: '',
		fillOpacity: 0.9
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
			// parentGeoIDs.push(json.parents[i].geoid)
			// remove national parent level
			if (json.parents[i].sumlevel != '010') {
				parentGeoIDs.push(json.parents[i].geoid)
			}
		}
		// array to comma sep string
		const pgeoid_string = parentGeoIDs.join(",")
		console.log(pgeoid_string);

		// set up data API call for parents
		// strip out '-x' from selected_tableID before passing to API
		const strip_selected_tableID = selected_tableID.split('-')[0];
		parentsDataAPICall = baseDataURL + "table_ids=" + strip_selected_tableID + "&geo_ids=" + pgeoid_string;
		console.log(parentsDataAPICall);
		d3.json(parentsDataAPICall).then(function(parents_json, parents_error) {
			if (parents_error) return console.warn(parents_error);
			console.log(parents_json);

			// update the popup
			let popupContent = "<h3 class='f5 mb2 gray ttu'>" + metadata[selected_category][selected_tableID]['title'] + "</h3>";
			let display_value;
			let background_color_value;
			let text_color_value;
			let display_name_width;
			let display_value_padding;

			// loop through parents and pull estimates
			for (let i = 0; i < json.parents.length; i++) {
				// remove national parent level
				if (json.parents[i].sumlevel != '010') {
					properties = parents_json.data[json.parents[i].geoid][strip_selected_tableID]
					value = calcValue(properties);
					background_color_value = '#aaa';
					text_color_value = '#111';
					display_name_width = 'w-70';
					display_value_padding = 'pl1';
					display_value_font = 'f5';

					if (typeof value == 'number'){
						if (selected_data_type == 'pct_format') {
							display_value = percentFormat(value);
						} else if (selected_data_type == 'pct') {
							display_value = percentify(value);
						} else if (selected_data_type == 'dollar') {
							display_value = dollarify(value);
						} else if (selected_data_type == 'decimal') {
							display_value = value.toFixed(2);
						} else if (selected_data_type == 'date') {
							display_value = value;
						} else {
							display_value = numberWithCommas(value);
						}
						background_color_value = color(value);
						text_color_value = text_color(value);
						if (display_value.length >= 8) {
							display_value_padding = 'pl1';
							display_value_font = 'f6';
						}

					} else if (value == 'Not enough data.') {
						display_value = value;
						display_name_width = 'w-50';
						display_value_padding = 'pl2 pr1';
					} else {
						display_value = "N/A";
					}
	
					popupContent += "<p class='pt2 pb2' style='background-color:"+ background_color_value +"; color:"+ text_color_value +"'><span class='"+display_name_width+" dib v-mid f5 pl2'>"+json.parents[i].display_name+"</span><span class='dib "+display_value_padding+" "+display_value_font+" v-mid'>"+display_value+"</span></p>";

				}

			}


			// popupContent += "<p class='gray'>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>";
			//popupContent += "<a class='f7 fw6 link grow no-underline b--light-blue ba br2 w-75 center tc ph3 pv1 mb2 mt3 db ttu gray href='#0'>Report</a>";
			popup.setContent( popupContent );
        	popup.update();


		});


	});

}

function onEachFeature(feature, layer) {
	display_value = '';

	layer.on({
		mouseover: highlightFeature,
		mouseout: resetHighlight,
		click: onLayerClick
	});

	if (typeof layer.feature.properties[selected_tableID].value == 'number'){
		if (selected_data_type == 'pct_format') {
			display_value = percentFormat(layer.feature.properties[selected_tableID].value);
		} else if (selected_data_type == 'pct') {
			display_value = percentify(layer.feature.properties[selected_tableID].value);
		} else if (selected_data_type == 'dollar') {
			display_value = dollarify(layer.feature.properties[selected_tableID].value);
		} else if (selected_data_type == 'decimal') {
			display_value = layer.feature.properties[selected_tableID].value.toFixed(2);
		} else if (selected_data_type == 'date') {
			display_value = layer.feature.properties[selected_tableID].value;
		} else {
			display_value = numberWithCommas(layer.feature.properties[selected_tableID].value);
		}
	} else if (layer.feature.properties[selected_tableID].value == 'Not enough data.') {
		display_value = layer.feature.properties[selected_tableID].value;
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

	if (selected_category == "Economics") {
		selected_tableID = 'B23025-1';
	}

	if (selected_category == "Children and Youth") {
		selected_tableID = 'B17001';
	}

	if (selected_category == "Demographics") {
		selected_tableID = 'B03002';
	}

	// print list of variables
	$('#sub-nav-data-links').html('');
	let link;
	let padding;
	for (let key in metadata[this.value]) {
		if (metadata[this.value][key]['indent'] == true) {
			padding = 'pl2';
		} else {
			padding = '';
		}
		link = '<a class="data-link mb3 db link light-blue dim '+ padding +' " href="#' + key + '">' + metadata[this.value][key]['title'] + '</a>'
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

function onlyUnique(value, index, self) { 
    return self.indexOf(value) === index;
}	


legend.onAdd = function (map) {

	var div = L.DomUtil.create('div', 'info legend');

	// loop through our density intervals and generate a label with a colored square for each interval
	div.innerHTML += 
		'<div class="legend-child">' + display_value_min + '</div><div class="legend-child"><img src="https://raw.githubusercontent.com/d3/d3-scale-chromatic/master/img/Blues.png" alt="Blues" style="max-width:100%;" width="100%" height="14"></div><div class="legend-child">' + display_value_max + '</div>';

	return div;
};


/* maps TO DO: build map of issues, tables*/
let metadata = {'Demographics':{}, 'Justice':{}, 'Children and Youth':{}, 'Economics':{}, 'Housing':{}, 'Civic Participation':{}}

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

// Economics variables
metadata['Economics']['B23025-1'] = {
	'numerator': ['B23025005'],
	'denominator': 'B23025001',
	'data_type': 'pct',
	'title': 'Unemployment Rate',
	'description': lorem
}

metadata['Economics']['C23002D-1'] = {
	'numerator': ['C23002D008', 'C23002D013', 'C23002D021', 'C23002D026'],
	'denominator': 'C23002D001',
	'data_type': 'pct',
	'title': 'Unemployment Rate (Asian Alone)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['C23002B'] = {
	'numerator': ['C23002B008', 'C23002B013', 'C23002B021', 'C23002B026'],
	'denominator': 'C23002B001',
	'data_type': 'pct',
	'title': 'Unemployment Rate (Black or African American Alone)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['C23002I'] = {
	'numerator': ['C23002I008', 'C23002I013', 'C23002I021', 'C23002I026'],
	'denominator': 'C23002I001',
	'data_type': 'pct',
	'title': 'Unemployment Rate (Hispanic or Latino)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['C23002H'] = {
	'numerator': ['C23002H008', 'C23002H013', 'C23002H021', 'C23002H026'],
	'denominator': 'C23002H001',
	'data_type': 'pct',
	'title': 'Unemployment Rate (White Alone, Not Hispanic or Latino)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['B23025-2'] = {
	'numerator': ['B23025007'],
	'denominator': 'B23025001',
	'data_type': 'pct',
	'title': 'Percent Not in Labor Force',
	'description': lorem
}

metadata['Economics']['C23002D-2'] = {
	'numerator': ['C23002D009', 'C23002D014', 'C23002D022', 'C23002D027'],
	'denominator': 'C23002D001',
	'data_type': 'pct',
	'title': 'Percent Not in Labor Force (Asian Alone)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['C23002B-2'] = {
	'numerator': ['C23002B009', 'C23002B014', 'C23002B022', 'C23002B027'],
	'denominator': 'C23002B001',
	'data_type': 'pct',
	'title': 'Percent Not in Labor Force (Black or African American Alone)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['C23002I-2'] = {
	'numerator': ['C23002I009', 'C23002I014', 'C23002I022', 'C23002I027'],
	'denominator': 'C23002I001',
	'data_type': 'pct',
	'title': 'Percent Not in Labor Force (Hispanic or Latino)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['C23002H-2'] = {
	'numerator': ['C23002H009', 'C23002H014', 'C23002H022', 'C23002H027'],
	'denominator': 'C23002H001',
	'data_type': 'pct',
	'title': 'Percent Not in Labor Force (White Alone, Not Hispanic or Latino)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['B19013'] = {
	'numerator': ['B19013001'],
	'denominator': null,
	'data_type': 'dollar',
	'title': 'Median Household Income',
	'description': lorem
}

metadata['Economics']['B19013D'] = {
	'numerator': ['B19013D001'],
	'denominator': null,
	'data_type': 'dollar',
	'title': 'Median Household Income (Asian Alone Householders)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['B19013B'] = {
	'numerator': ['B19013B001'],
	'denominator': null,
	'data_type': 'dollar',
	'title': 'Median Household Income (Black or African American Alone Householder)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['B19013I'] = {
	'numerator': ['B19013I001'],
	'denominator': null,
	'data_type': 'dollar',
	'title': 'Median Household Income (Hispanic or Latino Householder)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['B19013H'] = {
	'numerator': ['B19013H001'],
	'denominator': null,
	'data_type': 'dollar',
	'title': 'Median Household Income (White Alone, Not Hispanic or Latino Householder)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['B19083'] = {
	'numerator': ['B19083001'],
	'denominator': null,
	'data_type': 'decimal',
	'title': 'Gini Index of Income Inequality',
	'description': lorem
}


metadata['Economics']['B17001'] = {
	'numerator': ['B17001002'],
	'denominator': 'B17001001',
	'data_type': 'pct',
	'title': 'Percent Below Poverty Level',
	'description': lorem
}

metadata['Economics']['B17001D'] = {
	'numerator': ['B17001D002'],
	'denominator': 'B17001D001',
	'data_type': 'pct',
	'title': 'Percent Below Poverty Level (Asian Alone)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['B17001B'] = {
	'numerator': ['B17001B002'],
	'denominator': 'B17001B001',
	'data_type': 'pct',
	'title': 'Percent Below Poverty Level (Black or African American Alone)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['B17001I'] = {
	'numerator': ['B17001I002'],
	'denominator': 'B17001I001',
	'data_type': 'pct',
	'title': 'Percent Below Poverty Level (Hispanic or Latino)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['B17001H'] = {
	'numerator': ['B17001H002'],
	'denominator': 'B17001H001',
	'data_type': 'pct',
	'title': 'Percent Below Poverty Level (White Alone, Not Hispanic or Latino)',
	'indent': true,
	'description': lorem
}

metadata['Economics']['B15002'] = {
	'numerator': ['B15002015', 'B15002016', 'B15002017', 'B15002018', 'B15002032', 'B15002033', 'B15002034', 'B15002035'],
	'denominator': 'B15002001',
	'data_type': 'pct',
	'title': 'Percent Bachelor\'s Degree or Higher',
	'description': lorem
}

metadata['Economics']['B08134'] = {
	'numerator': ['B08134009', 'B08134010'],
	'denominator': 'B08134001',
	'data_type': 'pct',
	'title': 'Percent Workers with 45+ Minute Commute',
	'description': lorem
}

metadata['Economics']['B08134-1'] = {
	'numerator': ['B08134019', 'B08134020'],
	'denominator': 'B08134001',
	'data_type': 'pct',
	'title': 'Percent Workers with 45+ Minute Car, Truck or Van Commute',
	'indent': true,
	'description': lorem
}

metadata['Economics']['B08134-2'] = {
	'numerator': ['B08134069', 'B08134070'],
	'denominator': 'B08134001',
	'data_type': 'pct',
	'title': 'Percent Workers with 45+ Minute Public Transit Commute',
	'indent': true,
	'description': lorem
}


metadata['Children and Youth']['B17001'] = {
	'numerator': ['B17001004', 'B17001005', 'B17001006', 'B17001007', 'B17001008', 'B17001018', 'B17001019', 'B17001020', 'B17001021', 'B17001022', 'B17001023'],
	'denominator': 'B17001001',
	'data_type': 'pct',
	'title': 'Percent Children Under 18 Years Below Poverty Level',
	'description': lorem
}

metadata['Children and Youth']['B17001D'] = {
	'numerator': ['B17001D004', 'B17001D005', 'B17001D006', 'B17001D007', 'B17001D008', 'B17001D018', 'B17001D019', 'B17001D020', 'B17001D021', 'B17001D022', 'B17001D023'],
	'denominator': 'B17001D001',
	'data_type': 'pct',
	'title': 'Percent Children Under 18 Years Below Poverty Level (Asian Alone)',
	'indent': true,
	'description': lorem
}

metadata['Children and Youth']['B17001B'] = {
	'numerator': ['B17001B004', 'B17001B005', 'B17001B006', 'B17001B007', 'B17001B008', 'B17001B018', 'B17001B019', 'B17001B020', 'B17001B021', 'B17001B022', 'B17001B023'],
	'denominator': 'B17001B001',
	'data_type': 'pct',
	'title': 'Percent Children Under 18 Years Below Poverty Level (Black or African American Alone)',
	'indent': true,
	'description': lorem
}

metadata['Children and Youth']['B17001I'] = {
	'numerator': ['B17001I004', 'B17001I005', 'B17001I006', 'B17001I007', 'B17001I008', 'B17001I018', 'B17001I019', 'B17001I020', 'B17001I021', 'B17001I022', 'B17001I023'],
	'denominator': 'B17001I001',
	'data_type': 'pct',
	'title': 'Percent Children Under 18 Years Below Poverty Level (Hispanic or Latino)',
	'indent': true,
	'description': lorem
}

metadata['Children and Youth']['B17001H'] = {
	'numerator': ['B17001H004', 'B17001H005', 'B17001H006', 'B17001H007', 'B17001H008', 'B17001H018', 'B17001H019', 'B17001H020', 'B17001H021', 'B17001H022', 'B17001H023'],
	'denominator': 'B17001H001',
	'data_type': 'pct',
	'title': 'Percent Children Under 18 Years Below Poverty Level (White Alone, Not Hispanic or Latino)',
	'indent': true,
	'description': lorem
}

metadata['Children and Youth']['B14005'] = {
	'numerator': ['B14005013', 'B14005014', 'B14005015', 'B14005027','B14005028', 'B14005029'],
	'denominator': 'B14005001',
	'data_type': 'pct',
	'title': 'Percent Children 16-19 Years Not Enrolled or Graduated High School',
	'description': lorem
}

metadata['Children and Youth']['B14005-1'] = {
	'numerator': ['B14005013', 'B14005027'],
	'denominator': 'B14005001',
	'data_type': 'pct',
	'indent': true,
	'title': 'Percent Children 16-19 Years Not Enrolled or Graduated High School, but Employed',
	'description': lorem
}

metadata['Children and Youth']['B14005-2'] = {
	'numerator': ['B14005014', 'B14005015', 'B14005028','B14005029'],
	'denominator': 'B14005001',
	'data_type': 'pct',
	'indent': true,
	'title': 'Percent Children 16-19 Years Not Enrolled or Graduated High School, and Unemployed or Not in Labor Force',
	'description': lorem
}

//TO DO: Add Child Opportunity Index
//query: http://data.diversitydatakids.org/api/3/action/datastore_search_sql?sql=SELECT%20*%20from%20%22080cfe52-90aa-4925-beaa-90efb04ab7fb%22%20WHERE%20statefips%20=%20%2712%27%20AND%20countyfips%20=%20%2712103%27%20AND%20year%20=%20%272015%27


// Demographic variables
metadata['Demographics']['B03002'] = {
	'numerator': ['B03002001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Total Population',
	'description': lorem
}

metadata['Demographics']['B03002-1'] = {
	'numerator': ['B03002006'],
	'denominator': 'B03002001',
	'data_type': 'pct',
	'title': 'Percent of Total Population Asian Alone',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B03002-2'] = {
	'numerator': ['B03002004'],
	'denominator': 'B03002001',
	'data_type': 'pct',
	'title': 'Percent of Total Population Black or African American Alone',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B03002-3'] = {
	'numerator': ['B03002012'],
	'denominator': 'B03002001',
	'data_type': 'pct',
	'title': 'Percent of Total Population Hispanic or Latino',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B03002-4'] = {
	'numerator': ['B03002003'],
	'denominator': 'B03002001',
	'data_type': 'pct',
	'title': 'Percent of Total Population White Alone, Not Hispanic or Latino',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01001'] = {
	'numerator': ['B01001003', 'B01001004', 'B01001005', 'B01001006', 'B01001027', 'B01001028', 'B01001029', 'B01001030'],
	'denominator': 'B01001001',
	'data_type': 'pct',
	'title': 'Percent of Population Under 18 Years Old',
	'description': lorem
}

metadata['Demographics']['B01001D'] = {
	'numerator': ['B01001D003', 'B01001D004', 'B01001D005', 'B01001D006', 'B01001D027', 'B01001D028', 'B01001D029', 'B01001D030'],
	'denominator': 'B01001D001',
	'data_type': 'pct',
	'title': 'Percent of Asian Alone Population Under 18 Years Old',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01001B'] = {
	'numerator': ['B01001B003', 'B01001B004', 'B01001B005', 'B01001B006', 'B01001B027', 'B01001B028', 'B01001B029', 'B01001B030'],
	'denominator': 'B01001B001',
	'data_type': 'pct',
	'title': 'Percent of Black or African American Alone Population Under 18 Years Old',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01001I'] = {
	'numerator': ['B01001I003', 'B01001I004', 'B01001I005', 'B01001I006', 'B01001I027', 'B01001I028', 'B01001I029', 'B01001I030'],
	'denominator': 'B01001I001',
	'data_type': 'pct',
	'title': 'Percent of Hispanic or Latino Population Under 18 Years Old',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01001H'] = {
	'numerator': ['B01001H003', 'B01001H004', 'B01001H005', 'B01001H006', 'B01001H027', 'B01001H028', 'B01001H029', 'B01001H030'],
	'denominator': 'B01001H001',
	'data_type': 'pct',
	'title': 'Percent of White Alone, Not Hispanic or Latino Population Under 18 Years Old',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01001-1'] = {
	'numerator': ['B01001020', 'B01001021', 'B01001022', 'B01001023', 'B01001024', 'B01001025', 'B01001044', 'B01001045', 'B01001046', 'B01001047', 'B01001048', 'B01001049'],
	'denominator': 'B01001001',
	'data_type': 'pct',
	'title': 'Percent of Population 65 Years and Older',
	'description': lorem
}

metadata['Demographics']['B01001D-1'] = {
	'numerator': ['B01001D014', 'B01001D015', 'B01001D016', 'B01001D029', 'B01001D030', 'B01001D031'],
	'denominator': 'B01001D001',
	'data_type': 'pct',
	'title': 'Percent of Asian Alone Population 65 Years and Older',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01001B-1'] = {
	'numerator': ['B01001B014', 'B01001B015', 'B01001B016', 'B01001B029', 'B01001B030', 'B01001B031'],
	'denominator': 'B01001B001',
	'data_type': 'pct',
	'title': 'Percent of Black or African American Alone Population 65 Years and Older',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01001I-1'] = {
	'numerator': ['B01001I014', 'B01001I015', 'B01001I016', 'B01001I029', 'B01001I030', 'B01001I031'],
	'denominator': 'B01001I001',
	'data_type': 'pct',
	'title': 'Percent of Hispanic or Latino Population 65 Years and Older',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01001H-1'] = {
	'numerator': ['B01001H014', 'B01001H015', 'B01001H016', 'B01001H029', 'B01001H030', 'B01001H031'],
	'denominator': 'B01001H001',
	'data_type': 'pct',
	'title': 'Percent of White Alone, Not Hispanic or Latino Population 65 Years and Older',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01002'] = {
	'numerator': ['B01002001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Median Age',
	'description': lorem
}

metadata['Demographics']['B01002D'] = {
	'numerator': ['B01002D001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Median Age (Asian Alone)',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01002B'] = {
	'numerator': ['B01002B001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Median Age (Black or African American Alone)',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01002I'] = {
	'numerator': ['B01002I001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Median Age (Hispanic or Latino)',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B01002H'] = {
	'numerator': ['B01002H001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Median Age (White Alone, Not Hispanic or Latino)',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B16005'] = {
	'numerator': ['B16005003', 'B16005005', 'B16005010', 'B16005015', 'B16005020', 'B16005025', 'B16005027', 'B16005032', 'B16005037', 'B16005042'],
	'denominator': 'B16005001',
	'data_type': 'pct',
	'title': 'Percent of Population with High English Proficiency',
	'description': lorem
}

metadata['Demographics']['B16005D'] = {
	'numerator': ['B16005D003', 'B16005D005', 'B16005D008'],
	'denominator': 'B16005D001',
	'data_type': 'pct',
	'title': 'Percent of Asian Alone Population with High English Proficiency',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B16005B'] = {
	'numerator': ['B16005B003', 'B16005B005', 'B16005B008'],
	'denominator': 'B16005B001',
	'data_type': 'pct',
	'title': 'Percent of Black or African American Alone Population with High English Proficiency',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B16005I'] = {
	'numerator': ['B16005I003', 'B16005I005', 'B16005I008'],
	'denominator': 'B16005I001',
	'data_type': 'pct',
	'title': 'Percent of Hispanic or Latino Population with High English Proficiency',
	'indent': true,
	'description': lorem
}

metadata['Demographics']['B16005H'] = {
	'numerator': ['B16005H003', 'B16005H005', 'B16005H008'],
	'denominator': 'B16005H001',
	'data_type': 'pct',
	'title': 'Percent of White Alone, Not Hispanic or Latino Population with High English Proficiency',
	'indent': true,
	'description': lorem
}


// initialize
initMap();
