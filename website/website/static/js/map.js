
let geojson;
const legend = L.control({position: 'bottomright'});

function init() {
    createMap();
}

function createMap() {
    const map = L.map('map').setView([27.865129, -82.678459], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/{style}/{z}/{x}/{y}' + (L.Browser.retina ? '@2x.png' : '.png'), {
        attribution:'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        style: 'light_all',
        maxZoom: 20,
        minZoom: 0
    }).addTo(map);

    geojson = L.geoJSON(mhhi, {style: style, onEachFeature: onEachFeature})
		.addTo(map);

    legend.addTo(map);
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

  layer.bindPopup("<h3 class='f5 mb1 gray ttu'>Title</h3><p class='gray'>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p><a class='f7 fw6 link grow no-underline ba br2 w-100 tc ph3 pv1 mb2 dib ttu light-blue  href='#0>Report</a>");
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
