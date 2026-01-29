/*
Plotting EIS data with plotly.js
*/
function getColors() {
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

function plotEISdata(impedanceData, impedanceBack) {
    // Get colors of the website so the plot is nicer implemented
    const colors = getColors();

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
        }
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
        }
    }], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: colors.text },
        xaxis: { 
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
    })
}

function plotDRTdata(data) {
    // Get colors of the website so the plot is nicer implemented
    const colors = getColors();

    // Setup EIS plot
    Plotly.newPlot('drtplot', [{
        x: data.tau, //data.map(d => d.tau_s),
        y: data.gammaHat, //data.map(d => d.gamma_hat_Ohm),
        mode: 'lines',
        line: {
            color: colors.accent,
            width: 1.5,
        },
    }], {
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
    })
}


/*
Dropzone configuration for easy drag-and-drop EIS data upload
*/
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
                const result = parseFile(e.target.result, file.name);

                // Setup DRT
                const frequencyData = result.data.map(d => d.freq);
                const impedanceData = {
                    re: result.data.map(d => d.zreal),
                    im: result.data.map(d => d.zimag)
                };

                const drt = new ColeColeDRT(frequencyData, impedanceData, option = {
                    alpha: 0.93,
                    tauMin: 1e-5,
                    // tauMax: 1e0
                });
                console.log(drt)

                // Show everything 
                // console.log(result);
                plotEISdata(impedanceData, drt.impedanceCalculated);
                plotDRTdata(drt);
                updateMetadataDispaly(result.metadata, file)
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

function updateMetadataDispaly(metadata, file) {
    document.getElementById('metadata-filename').textContent = file.name;
    document.getElementById('metadata-label').textContent = metadata.label;
    document.getElementById('metadata-date').textContent = metadata.date;
}
