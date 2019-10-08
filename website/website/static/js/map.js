
let geojson;
const legend = L.control({position: 'bottomright'});

function init() {
    createMap();
}

function createMap() {
    const geoAPI = "https://api.censusreporter.org/1.0/geo/show/tiger2018?geo_ids=140|05000US12103";
    console.log(geoAPI);
    d3.json(geoAPI).then(function(json, error) {
        if (error) return console.warn(error);
        const geoFeatures = json.features;

	    const map = L.map('map').setView([27.865129, -82.678459], 11);
	    L.tileLayer('https://{s}.basemaps.cartocdn.com/{style}/{z}/{x}/{y}' + (L.Browser.retina ? '@2x.png' : '.png'), {
	        attribution:'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
	        subdomains: 'abcd',
	        style: 'light_all',
	        maxZoom: 20,
	        minZoom: 0
	    }).addTo(map);

	    geojson = L.geoJSON(geoFeatures, {style: style, onEachFeature: onEachFeature});
	    geojson.addTo(map);


    	legend.addTo(map);

    })	

}



function getColor(d) {
	return d > 200000 ? '#800026' :
	       d > 100000  ? '#BD0026' :
	       d > 75000  ? '#E31A1C' :
	       d > 50000  ? '#FC4E2A' :
	       d > 25000   ? '#FD8D3C' :
	       d > 12500   ? '#FEB24C' :
	       d > 5000   ? '#FED976' :
	                    '#FFEDA0';
}

function style(feature) {
	return {
		fillColor: getColor(feature.properties.B19013001),
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
	geojson.resetStyle(e.target);
}

function onEachFeature(feature, layer) {
	layer.on({
		mouseover: highlightFeature,
		mouseout: resetHighlight
	});
	
	layer.bindPopup(function (layer) {
		console.log(layer);
		return layer.feature.properties.B19013001;
	});
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

// initialize
window.onload = init;