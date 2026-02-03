/*
Plotting EIS data with plotly.js
*/
function getLayoutColors() {
    const style = getComputedStyle(document.body);
    return {
        text: style.getPropertyValue('--pico-color').trim(),
        grid: style.getPropertyValue('--pico-muted-border-color').trim(),
        // frame: style.getPropertyValue('--pico-contrast-border').trim(),
        frame: style.getPropertyValue('--pico-color').trim(),
        accent: style.getPropertyValue('--pico-primary').trim(),
        background: style.getPropertyValue('--pico-background-color').trim(),
        fit: style.getPropertyValue('--pico-color-amber-200').trim()
    }
}

function getPlotColors(index) {
    const style = getComputedStyle(document.body);
    const picoColors = [
        style.getPropertyValue('--pico-color-indigo-650').trim(),
        style.getPropertyValue('--pico-color-amber-200').trim(),
        style.getPropertyValue('--pico-color-fuchsia-600').trim(),
        style.getPropertyValue('--pico-color-lime-200').trim(),
        style.getPropertyValue('--pico-color-pink-450').trim()
    ];
    const viridisColors = [
        '#440154', '#482878', '#3e4a89', '#31688e', '#26838f',
        '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'
    ];
    const colors = viridisColors;
    return colors[index % colors.length];
}

function getViridisPlotColors(n, alpha = 1) {
    // Some viridis colors
    const viridis = [
        [0.0, 68, 1, 84],
        [0.1, 72, 40, 120],
        [0.2, 62, 74, 137],
        [0.3, 49, 104, 142],
        [0.4, 38, 130, 142],
        [0.5, 31, 158, 137],
        [0.6, 53, 183, 121],
        [0.7, 110, 206, 88],
        [0.8, 181, 222, 43],
        [1.0, 253, 231, 37]
    ];

    function interpolate(t) {
        // Find surrounding control points
        let i = 0;
        while (i < viridis.length - 1 && viridis[i + 1][0] < t) {
            i++;
        }
        if (i >= viridis.length -1) {
            i = viridis.length - 2;
        }

        const [t0, r0, g0, b0] = viridis[i];
        const [t1, r1, g1, b1] = viridis[i+1];

        // Linear interpolation
        const f = (t - t0) / (t1 - t0);
        const r = Math.round(r0 + f * (r1 - r0));
        const g = Math.round(g0 + f * (g1 - g0));
        const b = Math.round(b0 + f * (b1 - b0));

        // return `rgba(${r},${g},${b},${alpha})`; // rgb

        const toHex = (x) => x.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    const colors = [];
    for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        colors.push(interpolate(t));
    }
    return colors;
}

function plotEISdata(impedanceData, impedanceBack, impedanceProcessList) {
    // Get colors of the website so the plot is nicer implemented
    const colors = getLayoutColors();
    
    // Setup list with peaks
    const processImpedanceDataList = [];
    let processImpedanceIndex = 0;

    const colorMap = getViridisPlotColors(impedanceProcessList.length, 0.3);

    for (const processImpedance of impedanceProcessList) {
        const processColor = colorMap[processImpedanceIndex]; // colors.fit
        processImpedanceDataList.push({
            x: processImpedance.re.map(x => 1000 * x),
            y: processImpedance.im.map(x => -1000 * x),
            mode: 'lines',
            fill: 'tozeroy',
            fillcolor: processColor + '40',
            hoveron: 'points+fills',
            line: {
                width: 1,
                color: processColor
            },
            name: `Process p${processImpedanceIndex + 1}`
        });

        processImpedanceIndex++;
    }

    // Setup EIS plot
    Plotly.newPlot('eisplot', [...processImpedanceDataList, {
        x: impedanceData.re.map(x => 1000 * x),
        y: impedanceData.im.map(x => -1000 * x),
        mode: 'lines+markers',
        line: {
            color: colors.accent,
            width: 1.5,
        },
        marker: {
            color: colors.background,
            size: 5,
            line: {
                color: colors.accent,
                width: 1.5,
            }
        },
        name: 'Data'
    }, {
        x: impedanceBack.re.map(x => 1000 * x),
        y: impedanceBack.im.map(x => -1000 * x),
        mode: 'lines+markers',
        line: {
            color: colors.fit,
            width: 1.5,
        },
        marker: {
            color: colors.fit,
            size: 5
        },
        name: 'DRT fit'
    }], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: colors.text },
        xaxis: { 
            title: { text: "Z' / mΩ" },
            gridcolor: colors.grid,
            zerolinecolor: colors.grid,
            showline: true,
            linecolor: colors.frame,
            linewidth: 1,
            ticks: 'inside',
            tickcolor: colors.frame,
            minor: { ticks: 'inside', tickcolor: colors.frame },
            mirror: 'allticks',
        },
        yaxis: { 
            title: { text: "-Z'' / mΩ" },
            scaleanchor: 'x', 
            scaleratio: 1,
            gridcolor: colors.grid,
            zerolinecolor: colors.frame,
            showline: true,
            linecolor: colors.frame,
            linewidth: 1,
            ticks: 'inside',
            tickcolor: colors.frame,
            minor: { ticks: 'inside', tickcolor: colors.frame },
            mirror: 'allticks',
        },
    }, { 
        responsive: true,
        toImageButtonOptions: {
            format: 'svg',
            filename: 'eisdata'
        }
    })
}

function plotDRTdata(drt, drtPeakList) {
    // Get colors of the website so the plot is nicer implemented
    const colors = getLayoutColors();

    // Setup list with peaks
    const peakDataList = [];
    let peakIndex = 0;

    const colorMap = getViridisPlotColors(drtPeakList.length, 1);

    for (const peak of drtPeakList) {
        const processColor = colorMap[peakIndex]; // colors.fit
        peakDataList.push({
            x: drt.tau,
            y: peak.gammaHat.map(x => 1000 * x),
            mode: 'lines',
            fill: 'tozeroy',
            fillcolor: processColor + '40',
            hoveron: 'points+fills',
            line: {
                width: 1,
                color: processColor
            },
            name: `Process p${peakIndex + 1}`
        });

        peakIndex++;
    }
    

    // Setup EIS plot
    Plotly.newPlot('drtplot', [...peakDataList, {
        x: drt.tau,
        y: drt.gammaHat.map(x => 1000 * x), 
        mode: 'lines',
        line: {
            color: colors.accent + '60',
            width: 2,
        },
        name: 'Full DRT'
    }], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: colors.text },
        xaxis: { 
            title: { text: "τ / s" },
            type: 'log',
            dtick: 1,
            exponentformat: 'power',
            gridcolor: colors.grid,
            zerolinecolor: colors.grid,
            showline: true,
            linecolor: colors.frame,
            linewidth: 1,
            ticks: 'inside',
            tickcolor: colors.frame,
            minor: { ticks: 'inside', tickcolor: colors.frame },
            mirror: 'allticks',
        },
        yaxis: { 
            title: { text: "R<sub>pol</sub>γ(ln(τ/τ<sub>0</sub>)) / mΩ" }, 
            gridcolor: colors.grid,
            zerolinecolor: colors.frame,
            showline: true,
            linecolor: colors.frame,
            linewidth: 1,
            ticks: 'inside',
            tickcolor: colors.frame,
            minor: { ticks: 'inside', tickcolor: colors.frame },
            mirror: 'allticks',
        },
    }, { 
        responsive: true,
        toImageButtonOptions: {
            format: 'svg',
            filename: 'eisdata'
        }
    })
}

// Fix potential issues with changed device color theme (dark mode -> light mode)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (eisData) {
        drtAnalysis();
    }
});


/*
Dropzone configuration for easy drag-and-drop EIS data upload
*/
let eisData = null;

Dropzone.options.eisupload = {
    // Config
    paramName: 'file',
    dictDefaultMessage: 'Drop your EIS file (Gamry) here to proceed',
    autoProcessQueue: false,
    // previewTemplate: document.getElementById('dz-template').innerHTML,
    previewsContainer: false,

    init: function() {
        this.on('addedfile', function(file) {
            while (this.files.length > 1) {
                this.removeFile(this.files[0])
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                // Load EIS data
                const eisDataParsed = parseFile(e.target.result, file.name);

                // Setup DRT
                const frequencyData = eisDataParsed.data.map(d => d.freq);
                const impedanceData = {
                    re: eisDataParsed.data.map(d => d.zreal),
                    im: eisDataParsed.data.map(d => d.zimag)
                };

                // Store data (so it is available outside)
                eisData = { frequencyData, impedanceData, metadata: eisDataParsed.metadata, transitionIndex: eisDataParsed.transitionIndex, file: file };

                // Run DRT once file is loaded
                drtAnalysis();
            };

            reader.readAsText(file)

            document.querySelector('details#testdetails').open = true;
        });

        // this.on('removedfile', function() {
        //     if (this.files.length === 0) {
        //         this.element.querySelector('.dz-default.dz-message span').textContent = 'Drop another file here to replace the existing one';
        //     }
        // });
    },

    accept: function(file, done) {
        if (file.name == 'biologic.csv') {
            done('Not yet');
        } else {
            done();
        }
    }
};

/**
 * Handle configurations
 */
const configTrimInductivePartToogle = document.getElementById('config-trimInductivePart');

const configAlphaInputSlider = document.getElementById('config-alpha');
const configAlphaOutput = document.getElementById('configval-alpha');

const configTauMinInputSlider = document.getElementById('config-tauMin');
const configTauMinOutput = document.getElementById('configval-tauMin');

const configTauMaxInputSlider = document.getElementById('config-tauMax');
const configTauMaxOutput = document.getElementById('configval-tauMax');

const tauWarningElement = document.getElementById('tau-warning');

const configPpdInputSlider = document.getElementById('config-ppd');
const configPpdOutput = document.getElementById('configval-ppd');

// Set defaults
configTrimInductivePartToogle.checked = true;

configAlphaInputSlider.value = 0.92;
configAlphaOutput.textContent = 0.92;

configTauMinInputSlider.value = -6;
configTauMinOutput.textContent = formatExp(-6);

configTauMaxInputSlider.value = 6;
configTauMaxOutput.textContent = formatExp(6);

configPpdInputSlider.value = 40;
configPpdOutput.textContent = 40;

configTrimInductivePartToogle.addEventListener('input', (e) => {
    // Run DRT once value is changed
    drtAnalysis();
})

configAlphaInputSlider.addEventListener('input', (e) => {
    const alpha = parseFloat(e.target.value);
    configAlphaOutput.textContent = alpha;

    // Run DRT once value is changed
    drtAnalysis();
});

configTauMinInputSlider.addEventListener('input', (e) => {
    const tauMin = parseFloat(e.target.value);
    configTauMinOutput.textContent = formatExp(tauMin);

    validateTauRange();

    // Run DRT once value is changed
    drtAnalysis();
});

configTauMaxInputSlider.addEventListener('input', (e) => {
    const tauMax = parseFloat(e.target.value);
    configTauMaxOutput.textContent = formatExp(tauMax);

    validateTauRange();

    // Run DRT once value is changed
    drtAnalysis();
});

configPpdInputSlider.addEventListener('input', (e) => {
    const ppd = parseFloat(e.target.value);
    configPpdOutput.textContent = ppd;

    // Run DRT once value is changed
    drtAnalysis();
});

function validateTauRange() {
    const tauMinExp = parseFloat(configTauMinInputSlider.value);
    const tauMaxExp = parseFloat(configTauMaxInputSlider.value);
    const isValid = (tauMaxExp - tauMinExp) >= 1;

    tauWarningElement.hidden = isValid;
}

/**
 * Handle the DRT computations and stuff
 */
let lastDRTResult = null;

function drtAnalysis() {
    // Avoid running this without data being parsed
    if (!eisData) {
        return; 
    }

    const drt = new ColeColeDRT(eisData.frequencyData, eisData.impedanceData, option = {
        alpha: parseFloat(configAlphaInputSlider.value),
        tauMin: Math.pow(10, parseFloat(configTauMinInputSlider.value)),
        tauMax: Math.pow(10, parseFloat(configTauMaxInputSlider.value)),
        tauRangePointsPerDecade: parseFloat(configPpdInputSlider.value)
    });

    const drtPeakList = drt.getSeparatedPeakList();

    const impedanceProcessList = [];
    let i = 0;
    for (const peak of drtPeakList) {
        impedanceProcessList.push(drt.getSingleProcessImpedance(peak.tau, peak.R, peak.ROffset));
        i++;
    }

    // Trim inductive part of EIS data, if requested
    let eisDataImpedance = eisData.impedanceData;
    if (configTrimInductivePartToogle.checked === true && eisData.transitionIndex > 0) {
        // Sort data
        const paired = eisData.frequencyData.map((f, i) => ({
            freq: f,
            re: eisData.impedanceData.re[i],
            im: eisData.impedanceData.im[i],
        }));
        paired.sort((a, b) => b.freq - a.freq); // High to low frequency

        // Trim data
        const trimmed = paired.slice(eisData.transitionIndex - 3);
        eisDataImpedance = {
            re: trimmed.map(v => v.re),
            im: trimmed.map(v => v.im)
        };
    }

    // Store DRT results
    lastDRTResult = {
        drt: drt,
        drtPeakList: drtPeakList,
        impedanceProcessList: impedanceProcessList,
        eisDataImpedance: eisDataImpedance
    }

    // Plot and output data
    plotEISdata(eisDataImpedance, drt.impedanceCalculated, impedanceProcessList);
    plotDRTdata(drt, drtPeakList);
    updateMetadataDispaly(eisData.metadata, eisData.file);
    console.log(eisData);

    // Add hover details
    setupLinkedHoverEvents(drtPeakList, drt.alpha);

    // Activate export buttons
    document.getElementById('export-eis').disabled = false;
    document.getElementById('export-drt').disabled = false;
}

function highlightProcess(plotDiv, activeTraceIndex, numberOfProcesses, colorMap) {
    // Dim all process traces except the active one
    const opacities = [];
    const lineWidths = [];
    const fillColors = [];
    const fillPatterns = [];

    for (let i = 0; i < numberOfProcesses; i++) {
        if (i === activeTraceIndex) {
            opacities.push(1);
            lineWidths.push(3);
            fillColors.push(colorMap[i] + '80');
            fillPatterns.push({
                shape: '/',
                size: 8,
                solidity: '0.3',
                fgcolor: colorMap[i] + '80'
            });
        } else {
            opacities.push(0.05);
            lineWidths.push(0.5);
            fillColors.push(colorMap[i] + '10');
            fillPatterns.push({ shape: '' });
        }
    }

    Plotly.restyle(plotDiv, {
        'opacity': opacities,
        'line.width': lineWidths,
        'fillcolor': fillColors,
        'fillpattern': fillPatterns
    }, Array.from({length: numberOfProcesses}, (_, i) => i));
}

function resetHighlight(plotDiv, numberOfProcesses, colorMap) {
    const opacities = Array(numberOfProcesses).fill(1);
    const lineWidths = Array(numberOfProcesses).fill(1);
    const fillColors = colorMap.map(c => c + '40');
    const fillPatterns = Array(numberOfProcesses).fill({ shape: '' });

    Plotly.restyle(plotDiv, {
        'opacity': opacities,
        'line.width': lineWidths,
        'fillcolor': fillColors,
        'fillpattern': fillPatterns
    }, Array.from({length: numberOfProcesses}, (_, i) => i));
}

document.addEventListener('mousemove', (e) => {
    const tooltip = document.getElementById('drt-process-tooltip');
    if (tooltip && tooltip.style.display === 'block') {
        tooltip.style.left = (e.clientX + 10) + 'px';
        tooltip.style.top = (e.clientY + 10) + 'px';
    }
})

function setupLinkedHoverEvents(drtPeakList, alpha) {
    const eisPlotDiv = document.getElementById('eisplot');
    const drtPlotDiv = document.getElementById('drtplot');
    const tooltip = document.getElementById('drt-process-tooltip');

    const numberOfProcesses = drtPeakList.length;

    const colorMap = getViridisPlotColors(numberOfProcesses);

    // Helper to show tooltip
    function showTooltip(traceIndex) {
        const peak = drtPeakList[traceIndex];

        // Format values
        const tauFormatted = peak.tau.toExponential(2);
        const rFormatted = (1000 * peak.R).toPrecision(4);
        const cFormatted = peak.C.toPrecision(4);

        tooltip.innerHTML = `
            <strong style="color: ${colorMap[traceIndex]}$">Process p${traceIndex + 1}</strong>
            <table style="margin: 4px 0 0 0; border-collapse: collapse">
                <tr><td>τ<sub>p,${traceIndex + 1}</sub></td><td style="padding-left: 10px">${tauFormatted} s</td></tr>
                <tr><td>R<sub>p,${traceIndex + 1}</sub></td><td style="padding-left: 10px">${rFormatted} mΩ</td></tr>
                <tr><td>C<sub>eq,p,${traceIndex + 1}</sub></td><td style="padding-left: 10px">${cFormatted} F</td></tr>
                <tr><td>α</td><td style="padding-left: 10px">${alpha}</td></tr>
            </table>
        `;

        // Show tooltip
        tooltip.style.display = 'block';
    }

    // Helper to hide tooltip
    function hideTooltip() {
        tooltip.style.display = 'none';
    }

    // Remove old listeners
    eisPlotDiv.removeAllListeners('plotly_hover');
    eisPlotDiv.removeAllListeners('plotly_unhover');
    drtPlotDiv.removeAllListeners('plotly_hover');
    drtPlotDiv.removeAllListeners('plotly_unhover');

    // Attach new listeners
    eisPlotDiv.on('plotly_hover', function(eventData) {
        if (!eventData.points || eventData.points.length === 0){
            return;
        }
        const traceIndex = eventData.points[0].curveNumber;

        // Only react to process traces 
        if (traceIndex < numberOfProcesses) {
            highlightProcess(eisPlotDiv, traceIndex, numberOfProcesses, colorMap);
            highlightProcess(drtPlotDiv, traceIndex, numberOfProcesses, colorMap);
            showTooltip(traceIndex);
        }
    });

    eisPlotDiv.on('plotly_unhover', function(eventData) {
        resetHighlight(eisPlotDiv, numberOfProcesses, colorMap);
        resetHighlight(drtPlotDiv, numberOfProcesses, colorMap);
        hideTooltip();
    });

    drtPlotDiv.on('plotly_hover', function(eventData) {
        if (!eventData.points || eventData.points.length === 0){
            return;
        }
        const traceIndex = eventData.points[0].curveNumber;

        // Only react to process traces 
        if (traceIndex < numberOfProcesses) {
            highlightProcess(eisPlotDiv, traceIndex, numberOfProcesses, colorMap);
            highlightProcess(drtPlotDiv, traceIndex, numberOfProcesses, colorMap);
            showTooltip(traceIndex);
        }
    });

    drtPlotDiv.on('plotly_unhover', function(eventData) {
        resetHighlight(eisPlotDiv, numberOfProcesses, colorMap);
        resetHighlight(drtPlotDiv, numberOfProcesses, colorMap);
        hideTooltip();
    });
}

function updateMetadataDispaly(metadata, file) {
    document.getElementById('metadata-filename').textContent = file.name;
    document.getElementById('metadata-label').textContent = metadata.label;
    document.getElementById('metadata-date').textContent = metadata.date;
}

function formatExp(exp) {
    const value = Math.pow(10, exp);
    return value.toExponential(0).replace('+', '');
}

/**
 * Export functions
 */
function buildMetadataJSON() {
    const processes = lastDRTResult.drtPeakList.map((peak, index) => ({
        process: index + 1,
        tau_s: peak.tau,
        R_Ohm: peak.R,
        C_eq_F: peak.C
    }));

    return {
        label: eisData.metadata.label,
        date: eisData.metadata.date,
        filename: eisData.file.name,
        alpha: lastDRTResult.drt.alpha,
        tau_min_s: Math.pow(10, parseFloat(configTauMinInputSlider.value)),
        tau_max_s: Math.pow(10, parseFloat(configTauMaxInputSlider.value)),
        drt_resolution_ppd: parseFloat(configPpdInputSlider.value),
        process_list: processes
    }
}

function downloadCSV(filename, content) {
    // Setup data object
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });

    // Create a link and virtually download it
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function exportEISData() {
    if (!lastDRTResult || !eisData) {
        return;
    }

    const metadata = buildMetadataJSON();
    const { drt, drtPeakList, impedanceProcessList, eisDataImpedance } = lastDRTResult;
    
    // Build header row
    const headers = ['frequency_Hz', 'z_data_real_Ohm', 'z_data_imag_Ohm', 'z_fit_real_Ohm', 'z_fit_imag_Ohm'];
    for (let i = 0; i < drtPeakList.length; i++) {
        headers.push(`z_p${i + 1}_real_Ohm`, `z_p${i + 1}_imag_Ohm`);
    }

    // Build data rows
    const rows = [];
    const frequency = drt._origInputFrequencyData;
    const numberOfPoints = frequency.length;

    // Populate data stuff
    for (let i = 0; i < numberOfPoints; i++) {
        const row = [
            frequency[i],
            drt._origInputImpedanceData.re[i],
            drt._origInputImpedanceData.im[i],
            drt.impedanceCalculated.re[i],
            drt.impedanceCalculated.im[i],
        ];

        for (const processImpedance of impedanceProcessList) {
            row.push(processImpedance.re[i], processImpedance.im[i]);
        }

        // Add data to da list
        rows.push(row.join(','));
    }

    // Combine everything into CSV
    const csv = [
        '#' + JSON.stringify(metadata),
        headers.join(','),
        ...rows
    ].join('\n');

    // Generate filename and download the csv
    const baseName = eisData.file.name.replace(/\.[^.]+$/, '.');
    downloadCSV(`${baseName}_eis.csv`, csv);
}

function exportDRTData() {
    if (!lastDRTResult || !eisData) {
        return;
    }

    const metadata = buildMetadataJSON();
    const { drt, drtPeakList } = lastDRTResult;

    // Build header row
    const headers = ['tau_s', 'gamma_full_Ohm'];
    for (let i = 0; i < drtPeakList.length; i++) {
        headers.push(`gamma_p${i + 1}_Ohm`);
    }

    // Build data rows
    const rows = [];
    const tau = drt.tau;
    const numberOfPoints = tau.length;

    // Populate data again
    for (let i = 0; i < numberOfPoints; i++) {
        const row = [
            tau[i],
            drt.gammaHat[i]
        ];

        for (const peak of drtPeakList) {
            row.push(peak.gammaHat[i]);
        }

        // Add data to da list
        rows.push(row.join(','));
    }

    // Combine everything into CSV
    const csv = [
        '#' + JSON.stringify(metadata),
        headers.join(','),
        ...rows
    ].join('\n');

    // Generate filename and download the csv
    const baseName = eisData.file.name.replace(/\.[^.]+$/, '.');
    downloadCSV(`${baseName}_drt.csv`, csv);
}

// Setup download buttons
document.getElementById('export-eis').addEventListener('click', exportEISData);
document.getElementById('export-drt').addEventListener('click', exportDRTData);