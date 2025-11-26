// Event Study Visualization using D3.js

// Configuration
const margin = { top: 40, right: 80, bottom: 60, left: 80 };
const width = 1200 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

// Color palette
const colorPalette = ['#d73027', '#f46d43', '#fdae61', '#74add1', '#4575b4', '#313695'];

// Rank group order for consistent coloring
const rankOrder = ['Top 1-10', '11-20', '21-30', '31-40', '41-50', '51+'];

// Create color scale - use extremes first if fewer groups
function getColorForRankGroup(rankGroup, availableGroups) {
    const sortedGroups = availableGroups.sort((a, b) => {
        const order = ['Top 1-10', '11-20', '21-30', '31-40', '41-50', '51+'];
        return order.indexOf(a) - order.indexOf(b);
    });
    const index = sortedGroups.indexOf(rankGroup);
    const numGroups = sortedGroups.length;
    return colorPalette[index];
}

// Global variables
let data = null;
let svg = null;
let xScale = null;
let yScale = null;
let currentEvent = 'all';

// Load data and initialize
d3.json('event_study_data.json')
    .then(loadedData => {
        data = loadedData;
        initializeVisualization();
    })
    .catch(error => {
        console.error('Error loading data:', error);
        document.getElementById('chart-container').innerHTML = 
            '<p style="color: red;">Error loading data. Please run the preprocessing cell in the notebook first.</p>';
    });

function initializeVisualization() {
    // Populate event selector
    const eventSelect = d3.select('#event-select');
    data.events.forEach(event => {
        eventSelect.append('option')
            .attr('value', event.id)
            .text(event.name);
    });
    
    // Set up event listener
    eventSelect.on('change', function() {
        currentEvent = this.value;
        updateVisualization();
    });
    
    // Create SVG
    svg = d3.select('#chart-container')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create tooltip
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    
    // Initial render
    updateVisualization();
}

function updateVisualization() {
    // Clear previous content
    svg.selectAll('*').remove();
    
    // Get data for current selection
    let displayData = [];
    if (currentEvent === 'all') {
        // Show all events, but we'll need to handle this differently
        // For now, show first event as default
        displayData = data.events.length > 0 ? [data.events[0]] : [];
    } else {
        displayData = data.events.filter(e => e.id === currentEvent);
    }
    
    if (displayData.length === 0) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .text('No data available for selected event');
        return;
    }
    
    const event = displayData[0];
    
    // Calculate domain for all series
    let allDays = [];
    let allReturns = [];
    
    event.series.forEach(series => {
        series.data.forEach(d => {
            allDays.push(d[0]); // Days from event
            allReturns.push(d[1]); // Cumulative return
        });
    });
    
    // Set up scales
    xScale = d3.scaleLinear()
        .domain(d3.extent(allDays))
        .range([0, width])
        .nice();
    
    const maxAbs = d3.max(allReturns, d => Math.abs(d));
    const padding = maxAbs * 0.1;
    const domainMax = maxAbs + padding;

    yScale = d3.scaleLinear()
        .domain([-domainMax, domainMax])  // symmetric → zero centered
        .range([height, 0])
        .nice();
    
    // Create line generator
    const line = d3.line()
        .x(d => xScale(d[0]))
        .y(d => yScale(d[1]))
        .curve(d3.curveMonotoneX);
    
    // Add grid lines
    const xAxisGrid = d3.axisBottom(xScale)
        .ticks(10)
        .tickSize(-height)
        .tickFormat('');
    
    const yAxisGrid = d3.axisLeft(yScale)
        .ticks(10)
        .tickSize(-width)
        .tickFormat('');
    
    svg.append('g')
        .attr('class', 'grid-line')
        .attr('transform', `translate(0,${height})`)
        .call(xAxisGrid);
    
    svg.append('g')
        .attr('class', 'grid-line')
        .call(yAxisGrid);
    
    // Add event line (Day 0)
    svg.append('line')
        .attr('class', 'event-line')
        .attr('x1', xScale(0))
        .attr('x2', xScale(0))
        .attr('y1', 0)
        .attr('y2', height);
    
    // Add event label
    svg.append('text')
        .attr('class', 'axis-label')
        .attr('x', xScale(0))
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('font-weight', 'bold')
        .text('Event Start');
    
    // Draw lines for each rank group
    const availableGroups = event.series.map(s => s.name);
    event.series.forEach((series, index) => {
        const color = getColorForRankGroup(series.name, availableGroups);
        
        // Create path
        const path = svg.append('path')
            .datum(series.data)
            .attr('class', 'line')
            .attr('d', line)
            .attr('stroke', color)
            .attr('fill', 'none')
            .style('opacity', 0.8);
        
        // Add circles for data points (optional, can be toggled)
        const circles = svg.selectAll(`.dot-${index}`)
            .data(series.data)
            .enter()
            .append('circle')
            .attr('class', `dot-${index}`)
            .attr('cx', d => xScale(d[0]))
            .attr('cy', d => yScale(d[1]))
            .attr('r', 3)
            .attr('fill', color)
            .style('opacity', 0.6)
            .on('mouseover', function(event, d) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0.9);
                tooltip.html(`
                    <div class="tooltip-title">${series.name}</div>
                    <div>Days from event: ${d[0]}</div>
                    <div>Cumulative return: ${d[1].toFixed(2)}%</div>
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0);
            });
    });
    
    // Add axes
    const xAxis = d3.axisBottom(xScale)
        .ticks(10)
        .tickFormat(d => d);
    
    const yAxis = d3.axisLeft(yScale)
        .ticks(10)
        .tickFormat(d => d + '%');
    
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .append('text')
        .attr('class', 'axis-label')
        .attr('x', width / 2)
        .attr('y', 45)
        .attr('text-anchor', 'middle')
        .text('Days from Event Start');
    
    svg.append('g')
        .call(yAxis)
        .append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('y', -50)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .text('Cumulative Return (%)');
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -25)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('font-weight', 'bold')
        .text(event.name);
    
    // Update legend
    updateLegend(event.series);
}

function updateLegend(series) {
    const legend = d3.select('#legend');
    legend.selectAll('*').remove();
    
    series.forEach(s => {
        const item = legend.append('div')
            .attr('class', 'legend-item');
        
        const availableGroups = series.map(s => s.name);
        item.append('div')
            .attr('class', 'legend-color')
            .style('background-color', getColorForRankGroup(s.name, availableGroups));
        
        item.append('div')
            .attr('class', 'legend-label')
            .text(s.name);
    });
}

