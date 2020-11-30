/* Simple data platform mapping app functions */

/* geographic constants */
const baseGeoAPI = "https://api.censusreporter.org/1.0/geo/show/tiger2019?geo_ids="
const pcgid = '05000US12103';
//const sl = {'block_group':'150', 'tract':'140', 'zip_code':'860', 'puma':'795', 'place': '160', 'state_house':'620', 'state_senate':'610', 'congressional_district':'500'}

/* data API constants */
const baseDataURL = 'https://api.censusreporter.org/1.0/data/show/latest?'
const baseParentsURL = 'https://api.censusreporter.org/1.0/geo/tiger2019/';

/* COI data API constants */
const COIBaseDataURL = 'http://data.diversitydatakids.org/api/3/action/datastore_search_sql?sql='

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
let background_map;

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
	background_map = L.tileLayer('https://{s}.basemaps.cartocdn.com/{style}/{z}/{x}/{y}' + (L.Browser.retina ? '@2x.png' : '.png'), {
		attribution:'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
		subdomains: 'abcd',
		style: 'light_all',
		maxZoom: 15,
		minZoom: 10
	});
	background_map.addTo(map);


}

function updateGeography() {
	// for non-ACS cases, let's ensure that we're on the correct geography
	if (selected_tableID == 'COI') { // Child Opportunity Index
		selected_sl = '140';
		$('#geography-select').val('140');
		$('#geography-select').prop("disabled", true);
	}

	if (selected_tableID == 'EVI' || selected_tableID == 'EVI-FIL') { // Eviction data
		const options = [
			{text: "Census Block Groups", value: 150},
			{text: "Census Tracts", value: 140},
			{text: "Cities and Towns", value: 160},
		];
		$('#geography-select').replaceOptions(options);
		if (selected_sl == '140' || selected_sl == '150' || selected_sl == '160') {
			selected_sl = selected_sl;
			$('#geography-select').val(selected_sl);
		} else {
			selected_sl = '140';
			$('#geography-select').val('140');
		}

	} else {
		const options = [
			{text: "Census Block Groups", value: 150},
			{text: "Census Tracts", value: 140},
			{text: "Zip Codes", value: 860},
			{text: "Cities and Towns", value: 160},
			{text: "State House", value: 620},
			{text: "State Senate", value: 610},
			{text: "Congressional District", value: 500},
		];
		$('#geography-select').replaceOptions(options);
		$('#geography-select').val(selected_sl);
	}
	

	//console.log(selected_sl);
	//console.log(geoFeatures[selected_sl]);

	// if geography is empty, make API call and store in geojsons dictionary
	if (isEmpty(geoFeatures[selected_sl])) {
		// **** pull from local files ****//
		geoFile = static_url + 'data/' + selected_sl + '.geojson';
		console.log(geoFile);
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
	// is non-ACS case table selected?
	if (selected_tableID == 'COI') {  // Child Opportunity Index
		COIMergeDataWGeoFeatures();
	}
	else if (selected_tableID == 'EVI' || selected_tableID == 'EVI-FIL') {
		EVIMergeDataWGeoFeatures();
	}
	// is table selected?
	else if (selected_tableID) {
		mergeDataWGeoFeatures();
	}
	// check for existence of geojson
	else if (!map.hasLayer(geoJsons[selected_sl])) {
		console.log(geoFeatures[selected_sl]);
		geoJsons[selected_sl] = L.geoJSON(geoFeatures[selected_sl], {style: outlineStyle, onEachFeature: outlineOnEachFeature});
		console.log(geoJsons[selected_sl]);
		geoJsons[selected_sl].addTo(map);
	}

}

function removeGeojson() {
	if (map.hasLayer(geoJsons[selected_sl])) {
		map.eachLayer(function(layer){
			map.removeLayer(layer);
		});
		background_map.addTo(map);
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
		$("#dataset-source").text("Source: United States Census Bureau, American Community Survey, " + json.release.years);


	});

}

function COIMergeDataWGeoFeatures() {

	dataAPICall = COIBaseDataURL + "SELECT * FROM \"080cfe52-90aa-4925-beaa-90efb04ab7fb\" WHERE statefips = '12' AND countyfips = '12103' AND year = '2015'";
	//console.log("data API call: ", dataAPICall);
	$.ajax({
		url: dataAPICall,
		dataType: 'jsonp',
		success: function(json) {
		  	//console.log(json);
			let values = [];
			let value;
			//let properties;
			let geoid;
			for (let i = 0; i < json.result.records.length; i++) {
				//console.log(json.result.records[i]);
				geoid = json.result.records[i].geoid;
				for (let j = 0; j < geoFeatures[selected_sl].length; j++) {
					if (geoid == geoFeatures[selected_sl][j].properties.name) {
						geoFeatures[selected_sl][j].properties[selected_tableID] = {}
						geoFeatures[selected_sl][j].properties[selected_tableID].value = parseFloat(json.result.records[i].z_COI_nat);
						//console.log(geoFeatures[selected_sl]);
						value = geoFeatures[selected_sl][j].properties[selected_tableID].value
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
			$("#dataset-source").text("Source: Institute for Child, Youth and Family Policy; The Heller School for Social Policy and Management; Brandeis University, 2015");


		}
	});


}

function EVIMergeDataWGeoFeatures() {
	// function to merge eviction data with geojsons

	//console.log("selected_sl: ", selected_sl);
	d3.csv(static_url + 'data/' + selected_sl + '_evictions.csv').then(function(data, error) {
		if (error) return console.warn(error);
		let values = [];
		let value;
		let properties;
		let full_geoid;
		//console.log(data);
		for (let j = 0; j < data.length; j++) {
			full_geoid = selected_sl + '00US' + data[j].GEOID;
			//console.log(full_geoid);
			// move varibles into an "estimate" property
			data[j].estimate = data[j];
			if (data[j].year == '2016') {
				for (let i = 0; i < geoFeatures[selected_sl].length; i++) {
					value == 0;
					if (full_geoid == geoFeatures[selected_sl][i].properties.created_geoid) {
						geoFeatures[selected_sl][i].properties[selected_tableID] = data[j];
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

		// // add sourcing info
		$("#dataset-source").text("Source: The Eviction Lab, 2016. This research uses data from The Eviction Lab at Princeton University, a project directed by Matthew Desmond and designed by Ashley Gromis, Lavar Edmonds, James Hendrickson, Katie Krywokulski, Lillian Leung, and Adam Porton. The Eviction Lab is funded by the JPB, Gates, and Ford Foundations as well as the Chan Zuckerberg Initiative. More information is found at evictionlab.org.");


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
	// special case for dates -- if date = 0, replace value with 'Not enough data.'
	if (selected_data_type == 'date') {
		if (num < 1800) {
			value = 'Not enough data.'
		}
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
	//console.log(feature);
	if (feature.properties[selected_tableID] && typeof feature.properties[selected_tableID].value == 'number') {
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
	//console.log(parentsAPICall)

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
		//console.log(pgeoid_string);

		// set up data API call for parents
		// strip out '-x' from selected_tableID before passing to API
		const strip_selected_tableID = selected_tableID.split('-')[0];
		parentsDataAPICall = baseDataURL + "table_ids=" + strip_selected_tableID + "&geo_ids=" + pgeoid_string;
		//console.log(parentsDataAPICall);
		d3.json(parentsDataAPICall).then(function(parents_json, parents_error) {
			if (parents_error) return console.warn(parents_error);
			//console.log(parents_json);

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

	if (selected_tableID == 'COI' || selected_tableID == 'EVI' || selected_tableID == 'EVI-FIL') {
		console.log('mouseover')
		layer.on({
			mouseover: highlightFeature,
			mouseout: resetHighlight
		});
	} else {
		console.log('mouseover')
		layer.on({
			// mouseover: highlightFeature,
			// mouseout: resetHighlight,
			click: onLayerClick
		});
	}



	if (layer.feature.properties[selected_tableID] && typeof layer.feature.properties[selected_tableID].value == 'number') {
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
	} else if (layer.feature.properties[selected_tableID] && layer.feature.properties[selected_tableID].value == 'Not enough data.') {
		display_value = layer.feature.properties[selected_tableID].value;
	} else {
		display_value = "N/A";
	}


	layer.bindTooltip("<h3 class='f5 ma0 gray ttu'>"+ feature.properties.display_name + "</h3><p class='gray ma0'>"+ display_value +"</p>", {sticky: true, className: 'housing-tooltip', permanent: false});

	//layer.bindPopup("<h3 class='f5 mb1 gray ttu'>Title</h3><p class='gray'>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p><a class='f7 fw6 link grow no-underline ba br2 w-100 tc ph3 pv1 mb2 dib ttu light-blue  href='#0'>Report</a>");
	if (selected_tableID != 'COI' && selected_tableID != 'EVI' && selected_tableID != 'EVI-FIL') {
		layer.bindPopup("<img src='/static/img/loading.gif'>");
	}
}

// populate dataset
function populateDataset() {
	selected_data_type = metadata[selected_category][selected_tableID]['data_type'];
	$("#dataset-title").text(metadata[selected_category][selected_tableID]['title']);
	$("#dataset-description").text(metadata[selected_category][selected_tableID]['description']);
	if (metadata[selected_category][selected_tableID]['whymatters']) {
		// show and populate why matters
		$("#dataset-whymatters-title").addClass('db');
		$("#dataset-whymatters-title").removeClass('dn');
		$("#dataset-whymatters").addClass('db');
		$("#dataset-whymatters").removeClass('dn');
		$("#dataset-whymatters").text(metadata[selected_category][selected_tableID]['whymatters']);
	} else {
		// hide why matters
		$("#dataset-whymatters-title").addClass('dn');
		$("#dataset-whymatters-title").removeClass('db');
		$("#dataset-whymatters").addClass('dn');
		$("#dataset-whymatters").removeClass('db');		
	}
	
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
	$('#geography-select').prop("disabled", false);

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
	$('#geography-select').prop("disabled", false);
	selected_tableID = $(this).attr('href').substring(1);
	//console.log(selected_tableID);

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

(function($, window) {
	$.fn.replaceOptions = function(options) {
	  var self, $option;
  
	  this.empty();
	  self = this;
  
	  $.each(options, function(index, option) {
		$option = $("<option></option>")
		  .attr("value", option.value)
		  .text(option.text);
		self.append($option);
	  });
	};
  })(jQuery, window);


legend.onAdd = function (map) {

	var div = L.DomUtil.create('div', 'info legend');

	// loop through our density intervals and generate a label with a colored square for each interval
	div.innerHTML += 
		'<div class="legend-child">' + display_value_min + '</div><div class="legend-child"><img src="https://raw.githubusercontent.com/d3/d3-scale-chromatic/master/img/Blues.png" alt="Blues" style="max-width:100%;" width="100%" height="14"></div><div class="legend-child">' + display_value_max + '</div>';
		//'<div class="legend-child">' + display_value_min + '</div><div class="legend-child"><img src="' + static_url + 'img/blues.png" alt="Blues" style="max-width:100%;" width="100%" height="14"></div><div class="legend-child">' + display_value_max + '</div>';
		
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
	'description': 'Percentage of housing units which are renter-occupied. All occupied housing units which are not owner-occupied, whether they are rented or occupied without payment of rent, are classified as renter-occupied.',
	'whymatters': ''
}

metadata['Housing']['B25123'] = {
	'numerator': ['B25123009','B25123010','B25123011','B25123012'],
	'denominator': 'B25123008',
	'data_type': 'pct',
	'title': 'Percentage of Occupied Rental Units with Substandard Conditions',
	'description': 'Substandard housing isn\'t just housing that\'s unattractive or outdated. It\'s housing that poses a risk to the health, safety or physical well-being of occupants, neighbors, or visitors.',
	'whymatters': 'Substandard housing increases risk of disease, crime, social isolation and poor mental health.'
}

metadata['Housing']['B25035'] = {
	'numerator': ['B25035001'],
	'denominator': null,
	'data_type': 'date',
	'title': 'Median Year of Housing Unit Construction',
	'description': 'This indicator considers the age of the housing stock and calculates the median age for all houses in an area.',
	'whymatters': 'This is helpful in understanding the compliance with current housing construction standards and the likely need for maintenance costs.'
}

metadata['Housing']['B25071'] = {
	'numerator': ['B25071001'],
	'denominator': null,
	'data_type': 'pct_format',
	'title': 'Median Gross Rent as a Percentage of Household Income',
	'description': 'This indicator reflects the percentage of household income spent on rent in an area. It is a measure of private rental housing affordability in an area.',
	'whymatters': 'Gross rent as a percent of income is an indicator of housing affordability. Thirty percent of household income is the maximum standard people should be paying for their housing costs, leaving enough for food and other items. This 30% mark is a standard indicator used nationally to understand whether housing is affordable.'
}

metadata['Housing']['B25070'] = {
	'numerator': ['B25070007', 'B25070008', 'B25070009', 'B25070010'],
	'denominator': 'B25070001',
	'data_type': 'pct',
	'title': 'Percentage of Cost Burdened Renter-Occupied Units (>30% Income Spent on Housing)',
	'description': 'This indicator reflects the percentage of renter-occupied housing where more than 30% of income is spent on rent including utilities, real estate taxes, and insurance costs that are passed on to renters in increased rents.',
	'whymatters': 'The cost of basic needs matters for financial security and housing is often one of the largest expenses families face.1 Low-income households are more likely to have larger portions of their income spent on housing, which can make it difficult to meet other basic needs.'
}

metadata['Housing']['B25091'] = {
	'numerator': ['B25091008', 'B25091009', 'B25091010', 'B25091011', 'B25091019', 'B25091020', 'B25091021', 'B25091022'],
	'denominator': 'B25091001',
	'data_type': 'pct',
	'title': 'Percentage of Cost Burdened Owner-Occupied Units (>30% Income Spent on Housing)',
	'description': 'This indicator reflects the percentage of owner-occupied housing where more than 30% of income is spent on housing costs including utilities, real estate taxes, and insurance costs.',
	'whymatters': 'The cost of basic needs matters for financial security and housing is often one of the largest expenses families face.1 Low-income households are more likely to have larger portions of their income spent on housing, which can make it difficult to meet other basic needs.'
}

metadata['Housing']['EVI'] = {
	'numerator': ['evictions'],
	'denominator': 'population',
	'data_type': 'pct',
	'title': 'Eviction Rate',
	'description': 'An eviction rate is the number of evictions per 100 renter homes in an area. An eviction rate of 5% means that 5 of every 100 renter homes faced eviction in the selected area that year.',
	'whymatters': 'The lack of affordable housing sits at the root of a host of social problems, from poverty and homelessness to educational disparities and health care. That means understanding the eviction crisis is critical to effectively addressing these problems and reducing inequality.'

}

metadata['Housing']['EVI-FIL'] = {
	'numerator': ['eviction-filings'],
	'denominator': 'population',
	'data_type': 'pct',
	'title': 'Eviction Filing Rate',
	'description': 'The number of eviction filings per 100 renter homes. An eviction is a legal process in which a landlord submits a filing to the local Clerk of Courts to remove a tenant from a rental property. Evictions happen because the tenant has not paid rent, or because the tenant is habitually late on the rent. A lease may outline other reasons one can be evicted.',
	'whymatters': ''
}

// Economics variables
metadata['Economics']['B23025-1'] = {
	'numerator': ['B23025005'],
	'denominator': 'B23025001',
	'data_type': 'pct',
	'title': 'Unemployment Rate',
	'description': 'The unemployment rate is the percent of the labor force that is jobless. It is a lagging indicator, meaning that it generally rises or falls in the wake of changing economic conditions, rather than anticipating them.',
	'whymatters': 'Unemployment adversely affects the disposable income of families, erodes purchasing power, diminishes morale, and reduces an economy\'s output. It is a gross measure of economic challenges.'
}

metadata['Economics']['C23002D-1'] = {
	'numerator': ['C23002D008', 'C23002D013', 'C23002D021', 'C23002D026'],
	'denominator': 'C23002D001',
	'data_type': 'pct',
	'title': 'Unemployment Rate (Asian Alone)',
	'indent': true,
	'description': 'The unemployment rate is the percent of the labor force that is jobless. It is a lagging indicator, meaning that it generally rises or falls in the wake of changing economic conditions, rather than anticipating them.',
	'whymatters': 'Unemployment adversely affects the disposable income of families, erodes purchasing power, diminishes morale, and reduces an economy\'s output. It is a gross measure of economic challenges.'
}

metadata['Economics']['C23002B'] = {
	'numerator': ['C23002B008', 'C23002B013', 'C23002B021', 'C23002B026'],
	'denominator': 'C23002B001',
	'data_type': 'pct',
	'title': 'Unemployment Rate (Black or African American Alone)',
	'indent': true,
	'description': 'The unemployment rate is the percent of the labor force that is jobless. It is a lagging indicator, meaning that it generally rises or falls in the wake of changing economic conditions, rather than anticipating them.',
	'whymatters': 'Unemployment adversely affects the disposable income of families, erodes purchasing power, diminishes morale, and reduces an economy\'s output. It is a gross measure of economic challenges.'
}

metadata['Economics']['C23002I'] = {
	'numerator': ['C23002I008', 'C23002I013', 'C23002I021', 'C23002I026'],
	'denominator': 'C23002I001',
	'data_type': 'pct',
	'title': 'Unemployment Rate (Hispanic or Latino)',
	'indent': true,
	'description': 'The unemployment rate is the percent of the labor force that is jobless. It is a lagging indicator, meaning that it generally rises or falls in the wake of changing economic conditions, rather than anticipating them.',
	'whymatters': 'Unemployment adversely affects the disposable income of families, erodes purchasing power, diminishes morale, and reduces an economy\'s output. It is a gross measure of economic challenges.'
}

metadata['Economics']['C23002H'] = {
	'numerator': ['C23002H008', 'C23002H013', 'C23002H021', 'C23002H026'],
	'denominator': 'C23002H001',
	'data_type': 'pct',
	'title': 'Unemployment Rate (White Alone, Not Hispanic or Latino)',
	'indent': true,
	'description': 'The unemployment rate is the percent of the labor force that is jobless. It is a lagging indicator, meaning that it generally rises or falls in the wake of changing economic conditions, rather than anticipating them.',
	'whymatters': 'Unemployment adversely affects the disposable income of families, erodes purchasing power, diminishes morale, and reduces an economy\'s output. It is a gross measure of economic challenges.'
}

metadata['Economics']['B23025-2'] = {
	'numerator': ['B23025007'],
	'denominator': 'B23025001',
	'data_type': 'pct',
	'title': 'Percent Not in Labor Force',
	'description': 'Persons who are neither employed nor unemployed are not in the labor force. This category includes retired persons, students, those taking care of children or other family members, and others who are neither working nor seeking work. People who are neither employed nor unemployed are not in the labor force.',
	'whymatters': 'This data helps identify the degree to which people are discouraged or disaffected from the economic system.'
}

metadata['Economics']['C23002D-2'] = {
	'numerator': ['C23002D009', 'C23002D014', 'C23002D022', 'C23002D027'],
	'denominator': 'C23002D001',
	'data_type': 'pct',
	'title': 'Percent Not in Labor Force (Asian Alone)',
	'indent': true,
	'description': 'Persons who are neither employed nor unemployed are not in the labor force. This category includes retired persons, students, those taking care of children or other family members, and others who are neither working nor seeking work. People who are neither employed nor unemployed are not in the labor force.',
	'whymatters': 'This data helps identify the degree to which people are discouraged or disaffected from the economic system.'
}

metadata['Economics']['C23002B-2'] = {
	'numerator': ['C23002B009', 'C23002B014', 'C23002B022', 'C23002B027'],
	'denominator': 'C23002B001',
	'data_type': 'pct',
	'title': 'Percent Not in Labor Force (Black or African American Alone)',
	'indent': true,
	'description': 'Persons who are neither employed nor unemployed are not in the labor force. This category includes retired persons, students, those taking care of children or other family members, and others who are neither working nor seeking work. People who are neither employed nor unemployed are not in the labor force.',
	'whymatters': 'This data helps identify the degree to which people are discouraged or disaffected from the economic system.'
}

metadata['Economics']['C23002I-2'] = {
	'numerator': ['C23002I009', 'C23002I014', 'C23002I022', 'C23002I027'],
	'denominator': 'C23002I001',
	'data_type': 'pct',
	'title': 'Percent Not in Labor Force (Hispanic or Latino)',
	'indent': true,
	'description': 'Persons who are neither employed nor unemployed are not in the labor force. This category includes retired persons, students, those taking care of children or other family members, and others who are neither working nor seeking work. People who are neither employed nor unemployed are not in the labor force.',
	'whymatters': 'This data helps identify the degree to which people are discouraged or disaffected from the economic system.'
}

metadata['Economics']['C23002H-2'] = {
	'numerator': ['C23002H009', 'C23002H014', 'C23002H022', 'C23002H027'],
	'denominator': 'C23002H001',
	'data_type': 'pct',
	'title': 'Percent Not in Labor Force (White Alone, Not Hispanic or Latino)',
	'indent': true,
	'description': 'Persons who are neither employed nor unemployed are not in the labor force. This category includes retired persons, students, those taking care of children or other family members, and others who are neither working nor seeking work. People who are neither employed nor unemployed are not in the labor force.',
	'whymatters': 'This data helps identify the degree to which people are discouraged or disaffected from the economic system.'
}

metadata['Economics']['B19013'] = {
	'numerator': ['B19013001'],
	'denominator': null,
	'data_type': 'dollar',
	'title': 'Median Household Income',
	'description': 'Median household income is the income cut-off where half of the households earn more, and half earn less.',
	'whymatters': 'The median household income is a strong indicator for a residents spending power and the economic wellbeing of the residents in an area.'
}

metadata['Economics']['B19013D'] = {
	'numerator': ['B19013D001'],
	'denominator': null,
	'data_type': 'dollar',
	'title': 'Median Household Income (Asian Alone Householders)',
	'indent': true,
	'description': 'Median household income is the income cut-off where half of the households earn more, and half earn less.',
	'whymatters': 'The median household income is a strong indicator for a residents spending power and the economic wellbeing of the residents in an area.'
}

metadata['Economics']['B19013B'] = {
	'numerator': ['B19013B001'],
	'denominator': null,
	'data_type': 'dollar',
	'title': 'Median Household Income (Black or African American Alone Householder)',
	'indent': true,
	'description': 'Median household income is the income cut-off where half of the households earn more, and half earn less.',
	'whymatters': 'The median household income is a strong indicator for a residents spending power and the economic wellbeing of the residents in an area.'
}

metadata['Economics']['B19013I'] = {
	'numerator': ['B19013I001'],
	'denominator': null,
	'data_type': 'dollar',
	'title': 'Median Household Income (Hispanic or Latino Householder)',
	'indent': true,
	'description': 'Median household income is the income cut-off where half of the households earn more, and half earn less.',
	'whymatters': 'The median household income is a strong indicator for a residents spending power and the economic wellbeing of the residents in an area.'
}

metadata['Economics']['B19013H'] = {
	'numerator': ['B19013H001'],
	'denominator': null,
	'data_type': 'dollar',
	'title': 'Median Household Income (White Alone, Not Hispanic or Latino Householder)',
	'indent': true,
	'description': 'Median household income is the income cut-off where half of the households earn more, and half earn less.',
	'whymatters': 'The median household income is a strong indicator for a residents spending power and the economic wellbeing of the residents in an area.'
}

metadata['Economics']['B19083'] = {
	'numerator': ['B19083001'],
	'denominator': null,
	'data_type': 'decimal',
	'title': 'Gini Index of Income Inequality',
	'description': 'The Gini index is a simple measure of the distribution of income across income percentiles in a population. A higher Gini index indicates greater inequality, with high income individuals receiving much larger percentages of the total income of the population.',
	'whymatters': 'This is a quick measure of how fairly income is distributed across families in an area.'
}


metadata['Economics']['B17001'] = {
	'numerator': ['B17001002'],
	'denominator': 'B17001001',
	'data_type': 'pct',
	'title': 'Percent Below Poverty Level',
	'description': 'To calculate percentage of poverty level, divide income by the poverty guideline and multiply by 100.',
	'whymatters': 'The U.S. federal poverty level is a measure of income used by the U.S. government to determine who is eligible for subsidies, programs, and benefits.'
}

metadata['Economics']['B17001D'] = {
	'numerator': ['B17001D002'],
	'denominator': 'B17001D001',
	'data_type': 'pct',
	'title': 'Percent Below Poverty Level (Asian Alone)',
	'indent': true,
	'description': 'To calculate percentage of poverty level, divide income by the poverty guideline and multiply by 100.',
	'whymatters': 'The U.S. federal poverty level is a measure of income used by the U.S. government to determine who is eligible for subsidies, programs, and benefits.'
}

metadata['Economics']['B17001B'] = {
	'numerator': ['B17001B002'],
	'denominator': 'B17001B001',
	'data_type': 'pct',
	'title': 'Percent Below Poverty Level (Black or African American Alone)',
	'indent': true,
	'description': 'To calculate percentage of poverty level, divide income by the poverty guideline and multiply by 100.',
	'whymatters': 'The U.S. federal poverty level is a measure of income used by the U.S. government to determine who is eligible for subsidies, programs, and benefits.'
}

metadata['Economics']['B17001I'] = {
	'numerator': ['B17001I002'],
	'denominator': 'B17001I001',
	'data_type': 'pct',
	'title': 'Percent Below Poverty Level (Hispanic or Latino)',
	'indent': true,
	'description': 'To calculate percentage of poverty level, divide income by the poverty guideline and multiply by 100.',
	'whymatters': 'The U.S. federal poverty level is a measure of income used by the U.S. government to determine who is eligible for subsidies, programs, and benefits.'
}

metadata['Economics']['B17001H'] = {
	'numerator': ['B17001H002'],
	'denominator': 'B17001H001',
	'data_type': 'pct',
	'title': 'Percent Below Poverty Level (White Alone, Not Hispanic or Latino)',
	'indent': true,
	'description': 'To calculate percentage of poverty level, divide income by the poverty guideline and multiply by 100.',
	'whymatters': 'The U.S. federal poverty level is a measure of income used by the U.S. government to determine who is eligible for subsidies, programs, and benefits.'
}

metadata['Economics']['B15002'] = {
	'numerator': ['B15002015', 'B15002016', 'B15002017', 'B15002018', 'B15002032', 'B15002033', 'B15002034', 'B15002035'],
	'denominator': 'B15002001',
	'data_type': 'pct',
	'title': 'Percent Bachelor\'s Degree or Higher',
	'description': 'The percentage residents aged 25 and older who have a Bachelor’s degree or higher.',
	'whymatters': 'Access to educational opportunities provide a foundation for a strong and skilled work force. Equitable access to education is crucial for all residents to participate and contribute to a thriving economy.'
}

metadata['Economics']['B08134'] = {
	'numerator': ['B08134009', 'B08134010'],
	'denominator': 'B08134001',
	'data_type': 'pct',
	'title': 'Percent Workers with 45+ Minute Commute',
	'description': 'The percentage of people who are employed who have a commute time of 45 minutes or longer regardless of the mode of travel.',
	'whymatters': 'A commute time of 45 minutes or longer is linked to reduced overall wellbeing including increased depression, increased obesity and increases in sleep disorders.'
}

metadata['Economics']['B08134-1'] = {
	'numerator': ['B08134019', 'B08134020'],
	'denominator': 'B08134001',
	'data_type': 'pct',
	'title': 'Percent Workers with 45+ Minute Car, Truck or Van Commute',
	'indent': true,
	'description': 'The percentage of people who are employed who have a commute time of 45 minutes or longer and the mode of transportation is car, truck or van (not public transit).',
	'whymatters': 'A commute time of 45 minutes or longer is linked to reduced overall wellbeing including increased depression, increased obesity and increases in sleep disorders.'
}

metadata['Economics']['B08134-2'] = {
	'numerator': ['B08134069', 'B08134070'],
	'denominator': 'B08134001',
	'data_type': 'pct',
	'title': 'Percent Workers with 45+ Minute Public Transit Commute',
	'indent': true,
	'description': 'The percentage of people who are employed who have a commute time of 45 minutes or longer and public transit is the mode of travel.',
	'whymatters': 'A commute time of 45 minutes or longer is linked to reduced overall wellbeing including increased depression, increased obesity and increases in sleep disorders.'
}


metadata['Children and Youth']['B17001'] = {
	'numerator': ['B17001004', 'B17001005', 'B17001006', 'B17001007', 'B17001008', 'B17001009', 'B17001018', 'B17001019', 'B17001020', 'B17001021', 'B17001022', 'B17001023'],
	'denominator': 'B17001001',
	'data_type': 'pct',
	'title': 'Percent Children Under 18 Years Below Poverty Level',
	'description': 'Percent of children by race and ethnicity under 18 years old in families with incomes below 100% of the federal poverty level.',
	'whymatters': 'Poverty and the associated financial stress can harm child development and limit learning opportunities. Research shows that families need income at least twice the poverty level to cover basic living expenses like food, housing, transportation and childcare.'
}

metadata['Children and Youth']['B17001D'] = {
	'numerator': ['B17001D004', 'B17001D005', 'B17001D006', 'B17001D007', 'B17001D008', 'B17001D009', 'B17001D018', 'B17001D019', 'B17001D020', 'B17001D021', 'B17001D022', 'B17001D023'],
	'denominator': 'B17001D001',
	'data_type': 'pct',
	'title': 'Percent Children Under 18 Years Below Poverty Level (Asian Alone)',
	'indent': true,
	'description': 'Percent of children by race and ethnicity under 18 years old in families with incomes below 100% of the federal poverty level.',
	'whymatters': 'Poverty and the associated financial stress can harm child development and limit learning opportunities. Research shows that families need income at least twice the poverty level to cover basic living expenses like food, housing, transportation and childcare.'
}

metadata['Children and Youth']['B17001B'] = {
	'numerator': ['B17001B004', 'B17001B005', 'B17001B006', 'B17001B007', 'B17001B008', 'B17001B009', 'B17001B018', 'B17001B019', 'B17001B020', 'B17001B021', 'B17001B022', 'B17001B023'],
	'denominator': 'B17001B001',
	'data_type': 'pct',
	'title': 'Percent Children Under 18 Years Below Poverty Level (Black or African American Alone)',
	'indent': true,
	'description': 'Percent of children by race and ethnicity under 18 years old in families with incomes below 100% of the federal poverty level.',
	'whymatters': 'Poverty and the associated financial stress can harm child development and limit learning opportunities. Research shows that families need income at least twice the poverty level to cover basic living expenses like food, housing, transportation and childcare.'
}

metadata['Children and Youth']['B17001I'] = {
	'numerator': ['B17001I004', 'B17001I005', 'B17001I006', 'B17001I007', 'B17001I008', 'B17001I009', 'B17001I018', 'B17001I019', 'B17001I020', 'B17001I021', 'B17001I022', 'B17001I023'],
	'denominator': 'B17001I001',
	'data_type': 'pct',
	'title': 'Percent Children Under 18 Years Below Poverty Level (Hispanic or Latino)',
	'indent': true,
	'description': 'Percent of children by race and ethnicity under 18 years old in families with incomes below 100% of the federal poverty level.',
	'whymatters': 'Poverty and the associated financial stress can harm child development and limit learning opportunities. Research shows that families need income at least twice the poverty level to cover basic living expenses like food, housing, transportation and childcare.'
}

metadata['Children and Youth']['B17001H'] = {
	'numerator': ['B17001H004', 'B17001H005', 'B17001H006', 'B17001H007', 'B17001H008', 'B17001H009', 'B17001H018', 'B17001H019', 'B17001H020', 'B17001H021', 'B17001H022', 'B17001H023'],
	'denominator': 'B17001H001',
	'data_type': 'pct',
	'title': 'Percent Children Under 18 Years Below Poverty Level (White Alone, Not Hispanic or Latino)',
	'indent': true,
	'description': 'Percent of children by race and ethnicity under 18 years old in families with incomes below 100% of the federal poverty level.',
	'whymatters': 'Poverty and the associated financial stress can harm child development and limit learning opportunities. Research shows that families need income at least twice the poverty level to cover basic living expenses like food, housing, transportation and childcare.'
}

metadata['Children and Youth']['B14005'] = {
	'numerator': ['B14005013', 'B14005014', 'B14005015', 'B14005027','B14005028', 'B14005029'],
	'denominator': 'B14005001',
	'data_type': 'pct',
	'title': 'Percent Children 16-19 Years Not Enrolled or Graduated High School',
	'description': 'Of all people in the population age 16-19, the percentage who are not enrolled in school and not high school graduates.',
	'whymatters': 'This is one of several measures often described as "disconnected youth" or "opportunity youth."  Emphasis is placed upon this group because the years between the late teens and the mid-twenties are believed to be a critical period during which young people form adult identities and move toward independence.'
}

metadata['Children and Youth']['B14005-1'] = {
	'numerator': ['B14005013', 'B14005027'],
	'denominator': 'B14005001',
	'data_type': 'pct',
	'indent': true,
	'title': 'Percent Children 16-19 Years Not Enrolled or Graduated High School, but Employed',
	'description': 'Of all people in the population age 16-19, the percentage who are not enrolled in school and not high school graduates but have employment.',
	'whymatters': 'This is one of several measures often described as "disconnected youth" or "opportunity youth."  Emphasis is placed upon this group because the years between the late teens and the mid-twenties are believed to be a critical period during which young people form adult identities and move toward independence.'
}

metadata['Children and Youth']['B14005-2'] = {
	'numerator': ['B14005014', 'B14005015', 'B14005028','B14005029'],
	'denominator': 'B14005001',
	'data_type': 'pct',
	'indent': true,
	'title': 'Percent Children 16-19 Years Not Enrolled or Graduated High School, and Unemployed or Not in Labor Force',
	'description': 'Of all people in the population age 16-19, the percentage who are not enrolled in school and not high school graduates and do not have employment.',
	'whymatters': 'This is one of several measures often described as "disconnected youth" or "opportunity youth."  Emphasis is placed upon this group because the years between the late teens and the mid-twenties are believed to be a critical period during which young people form adult identities and move toward independence.'
}

//Add Child Opportunity Index
//query: http://data.diversitydatakids.org/api/3/action/datastore_search_sql?sql=SELECT%20*%20from%20%22080cfe52-90aa-4925-beaa-90efb04ab7fb%22%20WHERE%20statefips%20=%20%2712%27%20AND%20countyfips%20=%20%2712103%27%20AND%20year%20=%20%272015%27

metadata['Children and Youth']['COI'] = {
	'numerator': ['z_COI_nat'],
	'denominator': null,
	'data_type': 'decimal',
	'title': 'Child Opportunity Index',
	'description': 'An index of neighborhood resources and conditions that help children develop in a healthy way. It combines data from 29 neighborhood-level indicators into a single composite measure.',
	'whymatters': 'The Child Opportunity Index is a tool that describes and quantifies the neighborhood conditions U.S. children experience today. The higher numbers indicate that there are more neighborhood resources and conditions that tend to increase childhood opportunity. (An index has a tendency to reduce nuance and may perpetuate certain narratives.)'
}


// Demographic variables
metadata['Demographics']['B03002'] = {
	'numerator': ['B03002001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Total Population',
	'description': 'The actual count of the total population of an area by racial and ethnic group. This count uses the racial and ethnic labels, categories, and definitions provided by the U.S. Census Bureau.',
	'whymatters': 'When changes in race and ethnicity are measured over time, this can influence issues and policies related to securing the overall social and economic well-being.'
}

metadata['Demographics']['B03002-1'] = {
	'numerator': ['B03002006'],
	'denominator': 'B03002001',
	'data_type': 'pct',
	'title': 'Percent of Total Population Asian Alone',
	'indent': true,
	'description': 'The percent of the total population of an area by racial and ethnic group. This count uses the racial and ethnic labels, categories, and definitions provided by the U.S. Census Bureau.',
	'whymatters': 'When changes in race and ethnicity are measured over time, this can influence issues and policies related to securing the overall social and economic well-being.'
}

metadata['Demographics']['B03002-2'] = {
	'numerator': ['B03002004'],
	'denominator': 'B03002001',
	'data_type': 'pct',
	'title': 'Percent of Total Population Black or African American Alone',
	'indent': true,
	'description': 'The percent of the total population of an area by racial and ethnic group. This count uses the racial and ethnic labels, categories, and definitions provided by the U.S. Census Bureau.',
	'whymatters': 'When changes in race and ethnicity are measured over time, this can influence issues and policies related to securing the overall social and economic well-being.'
}

metadata['Demographics']['B03002-3'] = {
	'numerator': ['B03002012'],
	'denominator': 'B03002001',
	'data_type': 'pct',
	'title': 'Percent of Total Population Hispanic or Latino',
	'indent': true,
	'description': 'The percent of the total population of an area by racial and ethnic group. This count uses the racial and ethnic labels, categories, and definitions provided by the U.S. Census Bureau.',
	'whymatters': 'When changes in race and ethnicity are measured over time, this can influence issues and policies related to securing the overall social and economic well-being.'
}

metadata['Demographics']['B03002-4'] = {
	'numerator': ['B03002003'],
	'denominator': 'B03002001',
	'data_type': 'pct',
	'title': 'Percent of Total Population White Alone, Not Hispanic or Latino',
	'indent': true,
	'description': 'The percent of the total population of an area by racial and ethnic group. This count uses the racial and ethnic labels, categories, and definitions provided by the U.S. Census Bureau.',
	'whymatters': 'When changes in race and ethnicity are measured over time, this can influence issues and policies related to securing the overall social and economic well-being.'
}

metadata['Demographics']['B01001'] = {
	'numerator': ['B01001003', 'B01001004', 'B01001005', 'B01001006', 'B01001027', 'B01001028', 'B01001029', 'B01001030'],
	'denominator': 'B01001001',
	'data_type': 'pct',
	'title': 'Percent of Population Under 18 Years Old',
	'description': 'Of the total count of the population, the percentage who are children younger than age 18 by race and ethnicity.',
	'whymatters': 'Measuring population growth and diversity is important for anticipating how best to support youth as community assets and contributors to wellbeing and the ways that education can respond to the changes in population diversity of youth in the county.'
}

metadata['Demographics']['B01001D'] = {
	'numerator': ['B01001D003', 'B01001D004', 'B01001D005', 'B01001D006', 'B01001D018', 'B01001D019', 'B01001D020', 'B01001D021'],
	'denominator': 'B01001D001',
	'data_type': 'pct',
	'title': 'Percent of Asian Alone Population Under 18 Years Old',
	'indent': true,
	'description': 'Of the total count of the population that is Asian, the percentage who are children younger than age 18.',
	'whymatters': 'Measuring population growth and diversity is important for anticipating how best to support youth as community assets and contributors to wellbeing and the ways that education can respond to the changes in population diversity of youth in the county.'
}

metadata['Demographics']['B01001B'] = {
	'numerator': ['B01001B003', 'B01001B004', 'B01001B005', 'B01001B006', 'B01001B018', 'B01001B019', 'B01001B020', 'B01001B021'],
	'denominator': 'B01001B001',
	'data_type': 'pct',
	'title': 'Percent of Black or African American Alone Population Under 18 Years Old',
	'indent': true,
	'description': 'Of the total count of the population that is Black, the percentage who are children younger than age 18.',
	'whymatters': 'Measuring population growth and diversity is important for anticipating how best to support youth as community assets and contributors to wellbeing and the ways that education can respond to the changes in population diversity of youth in the county.'
}

metadata['Demographics']['B01001I'] = {
	'numerator': ['B01001I003', 'B01001I004', 'B01001I005', 'B01001I006', 'B01001I018', 'B01001I019', 'B01001I020', 'B01001I021'],
	'denominator': 'B01001I001',
	'data_type': 'pct',
	'title': 'Percent of Hispanic or Latino Population Under 18 Years Old',
	'indent': true,
	'description': 'Of the total count of the population that is Hispanic or Latino, the percentage who are children younger than age 18.',
	'whymatters': 'Measuring population growth and diversity is important for anticipating how best to support youth as community assets and contributors to wellbeing and the ways that education can respond to the changes in population diversity of youth in the county.'
}

metadata['Demographics']['B01001H'] = {
	'numerator': ['B01001H003', 'B01001H004', 'B01001H005', 'B01001H006', 'B01001H018', 'B01001H019', 'B01001H020', 'B01001H021'],
	'denominator': 'B01001H001',
	'data_type': 'pct',
	'title': 'Percent of White Alone, Not Hispanic or Latino Population Under 18 Years Old',
	'indent': true,
	'description': 'Of the total count of the population that is White, the percentage who are children younger than age 18.',
	'whymatters': 'Measuring population growth and diversity is important for anticipating how best to support youth as community assets and contributors to wellbeing and the ways that education can respond to the changes in population diversity of youth in the county.'
}

metadata['Demographics']['B01001-1'] = {
	'numerator': ['B01001020', 'B01001021', 'B01001022', 'B01001023', 'B01001024', 'B01001025', 'B01001044', 'B01001045', 'B01001046', 'B01001047', 'B01001048', 'B01001049'],
	'denominator': 'B01001001',
	'data_type': 'pct',
	'title': 'Percent of Population 65 Years and Older',
	'description': 'Of the total count of the population, the percentage who are adults aged 65 and older by race and ethnicity.',
	'whymatters': 'Measuring population growth and diversity is important for anticipating the needs of an aging population and its cultural nuances and the development of older adults as resources and assets for community thriving.'
}

metadata['Demographics']['B01001D-1'] = {
	'numerator': ['B01001D014', 'B01001D015', 'B01001D016', 'B01001D029', 'B01001D030', 'B01001D031'],
	'denominator': 'B01001D001',
	'data_type': 'pct',
	'title': 'Percent of Asian Alone Population 65 Years and Older',
	'indent': true,
	'description': 'Of the total count of the population that is Asian, the percentage who are adults aged 65 and older.',
	'whymatters': 'Measuring population growth and diversity is important for anticipating the needs of an aging population and its cultural nuances and the development of older adults as resources and assets for community thriving.'
}

metadata['Demographics']['B01001B-1'] = {
	'numerator': ['B01001B014', 'B01001B015', 'B01001B016', 'B01001B029', 'B01001B030', 'B01001B031'],
	'denominator': 'B01001B001',
	'data_type': 'pct',
	'title': 'Percent of Black or African American Alone Population 65 Years and Older',
	'indent': true,
	'description': 'Of the total count of the population that is Black or African American, the percentage who are adults aged 65 and older.',
	'whymatters': 'Measuring population growth and diversity is important for anticipating the needs of an aging population and its cultural nuances and the development of older adults as resources and assets for community thriving.'
}

metadata['Demographics']['B01001I-1'] = {
	'numerator': ['B01001I014', 'B01001I015', 'B01001I016', 'B01001I029', 'B01001I030', 'B01001I031'],
	'denominator': 'B01001I001',
	'data_type': 'pct',
	'title': 'Percent of Hispanic or Latino Population 65 Years and Older',
	'indent': true,
	'description': 'Of the total count of the population that is Hispanic or Latino, the percentage who are adults aged 65 and older.',
	'whymatters': 'Measuring population growth and diversity is important for anticipating the needs of an aging population and its cultural nuances and the development of older adults as resources and assets for community thriving.'
}

metadata['Demographics']['B01001H-1'] = {
	'numerator': ['B01001H014', 'B01001H015', 'B01001H016', 'B01001H029', 'B01001H030', 'B01001H031'],
	'denominator': 'B01001H001',
	'data_type': 'pct',
	'title': 'Percent of White Alone, Not Hispanic or Latino Population 65 Years and Older',
	'indent': true,
	'description': 'Of the total count of the population that is White alone, the percentage who are adults aged 65 and older.',
	'whymatters': 'Measuring population growth and diversity is important for anticipating the needs of an aging population and its cultural nuances and the development of older adults as resources and assets for community thriving.'
}

metadata['Demographics']['B01002'] = {
	'numerator': ['B01002001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Median Age',
	'description': 'The age that divides a population into two numerically equally sized groups - that is, half the people are younger than this age and half are older. It is a single index that summarizes the age distribution of a population. This number is calculated by race and ethnicity as well.',
	'whymatters': 'Median age provides an important single indicator of the age distribution of a population. When race and ethnicity are factored in the median age difference has important implications for policies related labor force, education healthcare and more.'
}

metadata['Demographics']['B01002D'] = {
	'numerator': ['B01002D001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Median Age (Asian Alone)',
	'indent': true,
	'description': 'The age that divides a population into two numerically equally sized groups - that is, half the people are younger than this age and half are older. It is a single index that summarizes the age distribution of a population. This number is calculated by race and ethnicity as well.',
	'whymatters': 'Median age provides an important single indicator of the age distribution of a population. When race and ethnicity are factored in the median age difference has important implications for policies related labor force, education healthcare and more.'
}

metadata['Demographics']['B01002B'] = {
	'numerator': ['B01002B001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Median Age (Black or African American Alone)',
	'indent': true,
	'description': 'The age that divides a population into two numerically equally sized groups - that is, half the people are younger than this age and half are older. It is a single index that summarizes the age distribution of a population. This number is calculated by race and ethnicity as well.',
	'whymatters': 'Median age provides an important single indicator of the age distribution of a population. When race and ethnicity are factored in the median age difference has important implications for policies related labor force, education healthcare and more.'
}

metadata['Demographics']['B01002I'] = {
	'numerator': ['B01002I001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Median Age (Hispanic or Latino)',
	'indent': true,
	'description': 'The age that divides a population into two numerically equally sized groups - that is, half the people are younger than this age and half are older. It is a single index that summarizes the age distribution of a population. This number is calculated by race and ethnicity as well.',
	'whymatters': 'Median age provides an important single indicator of the age distribution of a population. When race and ethnicity are factored in the median age difference has important implications for policies related labor force, education healthcare and more.'
}

metadata['Demographics']['B01002H'] = {
	'numerator': ['B01002H001'],
	'denominator': null,
	'data_type': 'number',
	'title': 'Median Age (White Alone, Not Hispanic or Latino)',
	'indent': true,
	'description': 'The age that divides a population into two numerically equally sized groups - that is, half the people are younger than this age and half are older. It is a single index that summarizes the age distribution of a population. This number is calculated by race and ethnicity as well.',
	'whymatters': 'Median age provides an important single indicator of the age distribution of a population. When race and ethnicity are factored in the median age difference has important implications for policies related labor force, education healthcare and more.'
}

metadata['Demographics']['B16005'] = {
	'numerator': ['B16005003', 'B16005005', 'B16005010', 'B16005015', 'B16005020', 'B16005025', 'B16005027', 'B16005032', 'B16005037', 'B16005042'],
	'denominator': 'B16005001',
	'data_type': 'pct',
	'title': 'Percent of Population with High English Proficiency',
	'description': 'The percentage of the total population who have high English language proficiency.',
	'whymatters': 'An inclusive place fosters a supportive environment for immigrants to thrive economically and socially. Investing in community resources and infrastructure that support immigrants with different linguistic backgrounds will help to integrate the county’s new Americans and grow the economy for everyone.'
}

metadata['Demographics']['B16005D'] = {
	'numerator': ['B16005D003', 'B16005D005', 'B16005D008'],
	'denominator': 'B16005D001',
	'data_type': 'pct',
	'title': 'Percent of Asian Alone Population with High English Proficiency',
	'indent': true,
	'description': 'Of the total population that is Asian, the percentage by race and ethnicity who have high English language proficiency.',
	'whymatters': 'An inclusive place fosters a supportive environment for immigrants to thrive economically and socially. Investing in community resources and infrastructure that support immigrants with different linguistic backgrounds will help to integrate the county’s new Americans and grow the economy for everyone.'
}

metadata['Demographics']['B16005B'] = {
	'numerator': ['B16005B003', 'B16005B005', 'B16005B008'],
	'denominator': 'B16005B001',
	'data_type': 'pct',
	'title': 'Percent of Black or African American Alone Population with High English Proficiency',
	'indent': true,
	'description': 'Of the total population that is Black or African American, the percentage by race and ethnicity who have high English language proficiency.',
	'whymatters': 'An inclusive place fosters a supportive environment for immigrants to thrive economically and socially. Investing in community resources and infrastructure that support immigrants with different linguistic backgrounds will help to integrate the county’s new Americans and grow the economy for everyone.'
}

metadata['Demographics']['B16005I'] = {
	'numerator': ['B16005I003', 'B16005I005', 'B16005I008'],
	'denominator': 'B16005I001',
	'data_type': 'pct',
	'title': 'Percent of Hispanic or Latino Population with High English Proficiency',
	'indent': true,
	'description': 'Of the total population that is Hispanic or Latino, the percentage by race and ethnicity who have high English language proficiency.',
	'whymatters': 'An inclusive place fosters a supportive environment for immigrants to thrive economically and socially. Investing in community resources and infrastructure that support immigrants with different linguistic backgrounds will help to integrate the county’s new Americans and grow the economy for everyone.'
}

metadata['Demographics']['B16005H'] = {
	'numerator': ['B16005H003', 'B16005H005', 'B16005H008'],
	'denominator': 'B16005H001',
	'data_type': 'pct',
	'title': 'Percent of White Alone, Not Hispanic or Latino Population with High English Proficiency',
	'indent': true,
	'description': 'Of the total population White alone, the percentage by race and ethnicity who have high English language proficiency.',
	'whymatters': 'An inclusive place fosters a supportive environment for immigrants to thrive economically and socially. Investing in community resources and infrastructure that support immigrants with different linguistic backgrounds will help to integrate the county’s new Americans and grow the economy for everyone.'
}


// initialize
window.onload = initMap();
