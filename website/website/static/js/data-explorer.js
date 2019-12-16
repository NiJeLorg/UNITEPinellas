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
let dataTableName;
let selected_tableID;
let selected_tableKey;
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
		// set data table name
		dataTableName = json.tables[selected_tableID].title;
		let values = [];
		for (let geoid in json.data) {
			for (let i = 0; i < geoFeatures[selected_sl].length; i++) {
				if (geoid == geoFeatures[selected_sl][i].properties.created_geoid) {
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
	layer.bindTooltip("<h3 class='f5 ma0 gray ttu'>"+ feature.properties.display_name + "</h3>", {sticky: true});
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
			let popupContent = "<h3 class='f5 mb1 gray ttu'>"+dataTableName+"</h3>";
			let display_value;

			// loop through parents and pull estimates
			for (let i = 0; i < json.parents.length; i++) {

				console.log(json.parents[i])
				// look up the estimate via geoid and table name
				console.log(parents_json.data[json.parents[i].geoid][selected_tableID].estimate[selected_tableKey])

				if (parents_json.data[json.parents[i].geoid][selected_tableID].estimate[selected_tableKey]){
					if (selected_data_type == 'pct') {
						display_value = percentify(parents_json.data[json.parents[i].geoid][selected_tableID].estimate[selected_tableKey]);
					} else if (selected_data_type == 'dollar') {
						display_value = dollarify(parents_json.data[json.parents[i].geoid][selected_tableID].estimate[selected_tableKey]);
					} else {
						display_value = numberWithCommas(parents_json.data[json.parents[i].geoid][selected_tableID].estimate[selected_tableKey]);
					}
				} else {
					display_value = "N/A";
				}


				popupContent += "<p class='gray'><span class='b'>"+json.parents[i].display_name+"</span>: "+display_value+"</p>";
			}		
			
			
			// popupContent += "<p class='gray'>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>";
			popupContent += "<a class='f7 fw6 link grow no-underline ba br2 w-100 tc ph3 pv1 mb2 dib ttu light-blue href='#0'>Report</a>";
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

	if (layer.feature.properties[selected_tableID].estimate[selected_tableKey]){
		if (selected_data_type == 'pct') {
			display_value = percentify(layer.feature.properties[selected_tableID].estimate[selected_tableKey]);
		} else if (selected_data_type == 'dollar') {
			display_value = dollarify(layer.feature.properties[selected_tableID].estimate[selected_tableKey]);
		} else {
			display_value = numberWithCommas(layer.feature.properties[selected_tableID].estimate[selected_tableKey]);
		}	
	} else {
		display_value = "N/A";
	}


	layer.bindTooltip("<h3 class='f5 ma0 gray ttu'>"+ feature.properties.display_name + "</h3><p class='gray ma0'>"+ display_value +"</p>", {sticky: true, className: 'housing-tooltip', permanent: false});

	//layer.bindPopup("<h3 class='f5 mb1 gray ttu'>Title</h3><p class='gray'>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p><a class='f7 fw6 link grow no-underline ba br2 w-100 tc ph3 pv1 mb2 dib ttu light-blue  href='#0'>Report</a>");

	layer.bindPopup("<h3 class='f5 mb1 gray ttu'>Loading Animation Here</h3>");
}

function percentify(value) {
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
		selected_data_type = 'pct';
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
metadata['Housing'] = {'B25071': 'B25071001'}
