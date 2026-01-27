/*
EIS Data handling
*/
function getDefaultMetadata() {
    return {
        label: 'N/A',
        date: 'N/A',
        time: 'N/A',
        testId: 'N/A',
        cellId: 'N/A',
        vac: 'N/A',
        ocp: 'N/A',
        freqInit: 'N/A',
        freqFinal: 'N/A',
    }
}

function parseFile(text, filename) {
    const defaultMetadata = getDefaultMetadata()
    let parsed; 
    if (filename.endsWith('.dta')) {
        parsed = parseGamryDTA(text);
    } else {
        parsed = parseStandardizedCSV(text);
    }

    return {
        metadata: { ...defaultMetadata, ...parsed.metadata },
        data: parsed.data
    };
}

function parseStandardizedCSV(text) {
    const lines = text.trim().split('\n');

    // 0th line is JSON metadata for the file
    const metaline = lines[0]
    const metadataRaw = JSON.parse(metaline.slice(1)); // Remove leading #
    const dt = splitStandardizedCSVDateTime(metadataRaw.date_testbegin_datetime);

    // 1st line is ignored, since structure is clear; after that, there should be data
    const data = [];
    for (let i = 2; i < lines.length; i++) {
        const values = lines[i].split(',');
        data.push({
            freq: parseFloat(values[0]),
            zreal: parseFloat(values[1]),
            zimag: parseFloat(values[2]),
        })
    }

    metadata = {
        cellId: metadataRaw.cell_id,
        testId: metadataRaw.test_id,
        label: metadataRaw.test_id,
        date: dt.date,
        time: dt.time,
    }

    return { metadata, data }
}

function parseGamryDTA(text) {
    // Soon.
    console.warn('Gamry parser yet to be implemented.');
    return { metadata: {}, data: {} };
}

function splitStandardizedCSVDateTime(str) {
    const [datePart, timePart] = str.split(' ');
    const [day, month, year] = datePart.split('.');

    return {
        date: `${year}-${month}-${day}`,
        time: timePart
    }
}