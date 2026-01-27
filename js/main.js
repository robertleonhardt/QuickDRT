/*
EIS Data handling
*/

function parseFile(text, filename) {
    if (filename.endsWith('.dta')) {
        return parseGamryDTA(text);
    } else {
        return parseStandardizedCSV(text);
    }
}

function parseStandardizedCSV(text) {
    const lines = text.trim().split('\n');

    // 0th line is JSON metadata for the file
    const metaline = lines[0]
    const metadata = JSON.parse(metaline.slice(1)); // Remove leading #

    // 1st line is ignored, since structure is clear; after that, there should be data
    const data = [];
    for (let i = 2; i < lines.length; i++) {
        const values = lines[i].split(',');
        data.push({
            freq: parseFloat(values[0]),
            zreal: parseFloat(values[1]),
            zimag: parseFloat(values[2]),
            phi: parseFloat(values[3]),
        })
    }

    return { metadata, data }
}

function parseGamryDTA(text) {
    // Soon.
    console.warn('Gamry parser yet to be implemented.');
    return { metadata: {}, data: {} };
}

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
    }
}

function plotEISdata(data) {
    // Get colors of the website so the plot is nicer implemented
    const colors = getColors();

    // Setup EIS plot
    Plotly.newPlot('eisplot', [{
        x: data.map(d => d.zreal),
        y: data.map(d => -d.zimag),
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
                const result = parseFile(e.target.result, file.name);
                console.log(result);
                plotEISdata(result.data)
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