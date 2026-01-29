/*
Plotting EIS data with plotly.js
*/
function getLayoutColors() {
    const style = getComputedStyle(document.body);
    return {
        text: style.getPropertyValue('--pico-color').trim(),
        grid: style.getPropertyValue('--pico-muted-border-color').trim(),
        frame: style.getPropertyValue('--pico-contrast-border').trim(),
        accent: style.getPropertyValue('--pico-primary').trim(),
        background: style.getPropertyValue('--pico-background-color').trim(),
        fit: style.getPropertyValue('--pico-color-amber-200').trim()
    }
}

function getPlotColors(index) {
    const style = getComputedStyle(document.body);
    const colors = [
        style.getPropertyValue('--pico-color-indigo-650').trim(),
        style.getPropertyValue('--pico-color-amber-200').trim(),
        style.getPropertyValue('--pico-color-fuchsia-600').trim(),
        style.getPropertyValue('--pico-color-lime-200').trim(),
        style.getPropertyValue('--pico-color-pink-450').trim()
    ];
    return colors[index % colors.length];
}

function plotEISdata(impedanceData, impedanceBack, impedanceProcessList) {
    // Get colors of the website so the plot is nicer implemented
    const colors = getLayoutColors();
    
    // Setup list with peaks
    const processImpedanceDataList = [];
    let processImpedanceIndex = 0;

    for (const processImpedance of impedanceProcessList) {
        const processColor = colors.fit; // getPlotColors(peakIndex)
        processImpedanceDataList.push({
            x: processImpedance.re,
            y: processImpedance.im.map(x => -x),
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
    Plotly.newPlot('eisplot', [{
        x: impedanceData.re,
        y: impedanceData.im.map(x => -x),
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
        x: impedanceBack.re,
        y: impedanceBack.im.map(x => -x),
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
    }, ...processImpedanceDataList], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: colors.text },
        xaxis: { 
            title: "$Z' / \\Omega$", 
            gridcolor: colors.grid,
            zerolinecolor: colors.grid,
            showline: true,
            linecolor: colors.frame,
            linewidth: 1,
            ticks: 'inside',
            mirror: 'allticks',
        },
        yaxis: { 
            title: "y", 
            scaleanchor: 'x', 
            scaleratio: 1,
            gridcolor: colors.grid,
            zerolinecolor: colors.frame,
            showline: true,
            linecolor: colors.frame,
            linewidth: 1,
            ticks: 'inside',
            mirror: 'allticks',
        },
    }, { mathjax: 'cdn' })
}

function plotDRTdata(drt, drtPeakList) {
    // Get colors of the website so the plot is nicer implemented
    const colors = getLayoutColors();

    // Setup list with peaks
    const peakDataList = [];
    let peakIndex = 0;

    for (const peak of drtPeakList) {
        const processColor = colors.fit; // getPlotColors(peakIndex)
        peakDataList.push({
            x: drt.tau,
            y: peak.gammaHat,
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
    Plotly.newPlot('drtplot', [{
        x: drt.tau,
        y: drt.gammaHat, 
        mode: 'lines',
        line: {
            color: colors.accent,
            width: 2,
        },
        name: 'Full DRT'
    }, ...peakDataList], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: colors.text },
        xaxis: { 
            type: 'log',
            title: "Z' / Ohm",
            gridcolor: colors.grid,
            zerolinecolor: colors.grid,
            showline: true,
            linecolor: colors.frame,
            linewidth: 1,
            ticks: 'inside',
            mirror: 'allticks',
        },
        yaxis: { 
            title: "-Z'' / Ohm", 
            gridcolor: colors.grid,
            zerolinecolor: colors.frame,
            showline: true,
            linecolor: colors.frame,
            linewidth: 1,
            ticks: 'inside',
            mirror: 'allticks',
        },
    }, { mathjax: 'cdn' })
}


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
                eisData = { frequencyData, impedanceData, metadata: eisDataParsed.metadata, file: file };

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
configAlphaInputSlider.value = 0.92;
configAlphaOutput.textContent = 0.92;

configTauMinInputSlider.value = -6;
configTauMinOutput.textContent = formatExp(-6);

configTauMaxInputSlider.value = 6;
configTauMaxOutput.textContent = formatExp(6);

configPpdInputSlider.value = 30;
configPpdOutput.textContent = 30;

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

    plotEISdata(eisData.impedanceData, drt.impedanceCalculated, impedanceProcessList);
    plotDRTdata(drt, drtPeakList);
    updateMetadataDispaly(eisData.metadata, eisData.file);
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