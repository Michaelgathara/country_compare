let width = window.innerWidth;
let height = window.innerHeight;
let svg, projection, path, worldData;
let zoom = d3.zoom();

let selectedCountries = [];
let draggedCountries = new Map();
let isDragging = false;
let currentDragElement = null;

const tooltip = d3.select("#tooltip");

window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;

    if (svg) {
        svg.attr("width", width).attr("height", height);
        projection.scale(Math.min(width, height) / 6).translate([width / 2, height / 2]);
        if (svg.select('.map-group').node()) {
            svg.select('.map-group').selectAll("path").attr("d", path);
        }
    }
});

async function initializeMap() {
    try {
        const response = await fetch('https://michaelgathara.com/files/countries.json');
        const world = await response.json();

        worldData = topojson.feature(world, world.objects.countries);

        document.getElementById('loading').style.display = 'none';

        svg = d3.select("#map-container")
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        projection = d3.geoNaturalEarth1()
            .scale(Math.min(width, height) / 6)
            .translate([width / 2, height / 2]);

        path = d3.geoPath().projection(projection);

        const mapGroup = svg.append("g")
            .attr("class", "map-group");

        zoom = d3.zoom()
            .scaleExtent([1, 20])
            .on("zoom", function (event) {
                mapGroup.attr("transform", event.transform);
            });

        svg.call(zoom);

        const graticule = d3.geoGraticule();
        mapGroup.append("path")
            .datum(graticule)
            .attr("class", "graticule")
            .attr("d", path);

        const countries = mapGroup.selectAll("path.country")
            .data(worldData.features)
            .enter()
            .append("path")
            .attr("class", "country")
            .attr("d", path)
            .attr("data-name", d => d.properties.NAME || d.properties.name || "Unknown")
            .style("transform-origin", d => {
                const centroid = path.centroid(d);
                return `${centroid[0]}px ${centroid[1]}px`;
            })
            .on("mouseover", function (event, d) {
                if (!d3.select(this).classed("selected")) {
                    d3.select(this).style("fill", "#98fb98");
                }
                const countryName = d.properties.NAME || d.properties.name || "Unknown";
                tooltip
                    .style("opacity", 1)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px")
                    .text(countryName);
            })
            .on("mouseout", function (event, d) {
                if (!d3.select(this).classed("selected")) {
                    d3.select(this).style("fill", "#90ee90");
                }
                tooltip.style("opacity", 0);
            })
            .on("click", function (event, d) {
                event.stopPropagation();
                selectCountry(this, d);
            });

        const drag = d3.drag()
            .on("start", function (event, d) {
                if (!d3.select(this).classed("selected")) return;

                isDragging = true;
                currentDragElement = this;
                d3.select(this).classed("dragging", true);
                tooltip.style("opacity", 0);

                this.parentNode.appendChild(this);

                svg.on('.zoom', null);
            })
            .on("drag", function (event, d) {
                if (!d3.select(this).classed("selected")) return;

                const currentTransform = d3.zoomTransform(svg.node());

                const [x, y] = d3.pointer(event, mapGroup.node());
                const centroid = path.centroid(d);
                const dx = x - centroid[0];
                const dy = y - centroid[1];

                d3.select(this).attr("transform", `translate(${dx}, ${dy})`);

                const countryName = d.properties.NAME || d.properties.name || "Unknown";
                draggedCountries.set(countryName, { dx, dy });
            })
            .on("end", function (event, d) {
                if (!d3.select(this).classed("selected")) return;

                isDragging = false;
                d3.select(this).classed("dragging", false);
                const countryName = d.properties.NAME || d.properties.name || "Unknown";
                updateStatus(`${countryName} moved! Click another country to compare sizes.`);
                currentDragElement = null;

                svg.call(zoom);
            });

        countries.call(drag);

        updateStatus("Click on a country to start comparing sizes!");

        document.getElementById('resetBtn').disabled = false;
        document.getElementById('clearBtn').disabled = false;
        document.getElementById('randomBtn').disabled = false;

    } catch (error) {
        console.error('Error loading map data:', error);
        document.getElementById('loading').innerHTML = 'Error loading map data. Using simplified version...';

        createFallbackMap();
    }
}

function zoomIn() {
    svg.transition().duration(300).call(
        zoom.scaleBy, 1.5
    );
}

function zoomOut() {
    svg.transition().duration(300).call(
        zoom.scaleBy, 1 / 1.5
    );
}

function resetZoom() {
    svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity
    );
}

function createFallbackMap() {
    svg = d3.select("#map-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const fallbackCountries = [
        { name: "United States", x: width * 0.15, y: height * 0.35, width: width * 0.22, height: height * 0.15 },
        { name: "Canada", x: width * 0.12, y: height * 0.18, width: width * 0.28, height: height * 0.12 },
        { name: "Brazil", x: width * 0.25, y: height * 0.58, width: width * 0.15, height: height * 0.18 },
        { name: "Russia", x: width * 0.45, y: height * 0.22, width: width * 0.26, height: height * 0.14 },
        { name: "China", x: width * 0.60, y: height * 0.35, width: width * 0.15, height: height * 0.15 },
        { name: "Australia", x: width * 0.67, y: height * 0.75, width: width * 0.13, height: height * 0.10 },
        { name: "India", x: width * 0.56, y: height * 0.47, width: width * 0.09, height: height * 0.12 },
        { name: "Argentina", x: width * 0.22, y: height * 0.80, width: width * 0.07, height: height * 0.12 },
        { name: "Greenland", x: width * 0.28, y: height * 0.15, width: width * 0.09, height: height * 0.16 }
    ];

    fallbackCountries.forEach(country => {
        const rect = svg.append("rect")
            .attr("x", country.x)
            .attr("y", country.y)
            .attr("width", country.width)
            .attr("height", country.height)
            .attr("rx", 5)
            .attr("class", "country")
            .attr("data-name", country.name)
            .style("transform-origin", `${country.x + country.width / 2}px ${country.y + country.height / 2}px`)
            .on("mouseover", function (event) {
                if (!d3.select(this).classed("selected")) {
                    d3.select(this).style("fill", "#98fb98");
                }
                tooltip
                    .style("opacity", 1)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px")
                    .text(country.name);
            })
            .on("mouseout", function () {
                if (!d3.select(this).classed("selected")) {
                    d3.select(this).style("fill", "#90ee90");
                }
                tooltip.style("opacity", 0);
            })
            .on("click", function (event) {
                event.stopPropagation();
                selectCountryFallback(this, country);
            });

        const fallbackDrag = d3.drag()
            .on("start", function (event) {
                if (!d3.select(this).classed("selected")) return;
                d3.select(this).classed("dragging", true);
                this.parentNode.appendChild(this);
                tooltip.style("opacity", 0);
            })
            .on("drag", function (event) {
                if (!d3.select(this).classed("selected")) return;
                const [x, y] = d3.pointer(event, svg.node());
                d3.select(this).attr("transform", `translate(${x - country.x - country.width / 2}, ${y - country.y - country.height / 2})`);
            })
            .on("end", function (event) {
                if (!d3.select(this).classed("selected")) return;
                d3.select(this).classed("dragging", false);
                updateStatus(`${country.name} moved! Click another country to compare sizes.`);
            });

        rect.call(fallbackDrag);
    });

    updateStatus("Click on a country to start comparing sizes!");

    document.getElementById('resetBtn').disabled = false;
    document.getElementById('clearBtn').disabled = false;
    document.getElementById('randomBtn').disabled = false;
}

function selectCountry(element, data) {
    const country = d3.select(element);
    const isSelected = country.classed("selected");
    const countryName = data.properties.NAME || data.properties.name || "Unknown";

    if (isSelected) {
        country.classed("selected", false);
        selectedCountries = selectedCountries.filter(c => c !== countryName);
        updateStatus(selectedCountries.length > 0 ?
            `${selectedCountries.join(", ")} selected. Click and drag to move them around!` :
            "Click on a country to start comparing sizes!");
    } else {
        country.classed("selected", true);
        selectedCountries.push(countryName);

        element.parentNode.appendChild(element);

        updateStatus(`${countryName} selected! Drag it around to compare with other regions.`);
    }
}

function selectCountryFallback(element, country) {
    const countryElement = d3.select(element);
    const isSelected = countryElement.classed("selected");

    if (isSelected) {
        countryElement.classed("selected", false);
        selectedCountries = selectedCountries.filter(c => c !== country.name);
        updateStatus(selectedCountries.length > 0 ?
            `${selectedCountries.join(", ")} selected. Click and drag to move them around!` :
            "Click on a country to start comparing sizes!");
    } else {
        countryElement.classed("selected", true);
        selectedCountries.push(country.name);

        element.parentNode.appendChild(element);

        updateStatus(`${country.name} selected! Drag it around to compare with other regions.`);
    }
}

function updateStatus(message) {
    document.getElementById("status").textContent = message;
}

function resetMap() {
    if (!svg) return;

    const mapGroup = svg.select('.map-group');
    if (mapGroup.node()) {
        mapGroup.selectAll(".country")
            .classed("selected", false)
            .classed("dragging", false)
            .attr("transform", null);
    }

    selectedCountries = [];
    draggedCountries.clear();
    resetZoom();
    updateStatus("Map reset! Click on a country to start comparing sizes.");
}

function clearSelection() {
    if (!svg) return;

    const mapGroup = svg.select('.map-group');
    if (mapGroup.node()) {
        mapGroup.selectAll(".country")
            .classed("selected", false);
    }

    selectedCountries = [];
    updateStatus("Selection cleared! Click on a country to start comparing sizes.");
}

function randomComparison() {
    if (!svg) return;

    resetMap();

    const mapGroup = svg.select('.map-group');
    const countryElements = mapGroup.selectAll(".country").nodes();
    if (countryElements.length === 0) return;

    const randomCount = Math.floor(Math.random() * 2) + 2;
    const selectedElements = [];

    while (selectedElements.length < randomCount && selectedElements.length < countryElements.length) {
        const randomIndex = Math.floor(Math.random() * countryElements.length);
        const element = countryElements[randomIndex];
        if (!selectedElements.includes(element)) {
            selectedElements.push(element);
        }
    }

    selectedElements.forEach(element => {
        const countryName = element.getAttribute('data-name');
        d3.select(element).classed("selected", true);
        selectedCountries.push(countryName);
    });

    updateStatus(`Random comparison ready! Try dragging ${selectedCountries.join(" and ")} around the map.`);
}

document.addEventListener('keydown', function (event) {
    if (event.key === 'r' || event.key === 'R') {
        resetMap();
    } else if (event.key === 'c' || event.key === 'C') {
        clearSelection();
    } else if (event.key === ' ') {
        event.preventDefault();
        randomComparison();
    } else if (event.key === '+' || event.key === '=') {
        zoomIn();
    } else if (event.key === '-') {
        zoomOut();
    } else if (event.key === '0') {
        resetZoom();
    }
});

const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js';
script.onload = initializeMap;
script.onerror = createFallbackMap;
document.head.appendChild(script);

document.getElementById('resetBtn').disabled = true;
document.getElementById('clearBtn').disabled = true;
document.getElementById('randomBtn').disabled = true;