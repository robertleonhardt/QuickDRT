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

configPpdInputSlider.value = 70;
configPpdOutput.textContent = 70;

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

    plotEISdata(eisDataImpedance, drt.impedanceCalculated, impedanceProcessList);
    plotDRTdata(drt, drtPeakList);
    updateMetadataDispaly(eisData.metadata, eisData.file);
    console.log(eisData);
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