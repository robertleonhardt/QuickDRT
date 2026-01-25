/*
EIS Data handling
*/

function parseFile(text, filename) {
    if (filename.endWith('.dta')) {
        return parseGamryDTA(text);
    } else {
        return parseStandardizedCSV(text);
    }
}

function parseStandardizedCSV(text) {
    const lines = text.trim().split('\n');

    // 0th line is JSON metadata for the file
    const metaLine = lines[0]
    const metadata = JSON.parse(metaLine.slice(1)); // Remove leading #

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
Dropzone configuration for easy drag-and-drop EIS data upload
*/
Dropzone.options.eisupload = {
    // Config
    paramName: 'file',
    maxFileSize: 2,
    maxFiles: 1,

    dictDefaultMessage: 'Drop your EIS file (Gamry) here to proceed',

    init: function() {
        this.on('addedFile', function(file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const result = parseFile(e.target.result, file.name);
                console.log(result);
            }
        })
    },

    accept: function(file, done) {
        if (file.name == 'biologic.csv') {
            done('Not yet');
        } else {
            done();
        }
    }
};