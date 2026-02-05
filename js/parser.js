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
    // Parse data
    const defaultMetadata = getDefaultMetadata()
    let parsed; 

    if (filename.endsWith('.dta') || filename.endsWith('.DTA')) {
        parsed = parseGamryDTA(text);
    } else {
        parsed = parseStandardizedCSV(text);
    }

    // Get index near R0 (for trimming)
    function findIndexOfFirstNegativeIm(freq, zimag) {
        // Create sorted pairs
        const paired = freq.map((f, i) => ({ freq: f, zimag: zimag[i] }));
        paired.sort((a, b) => b.freq - a.freq); // High f to low f

        for (let i = 0; i < paired.length; i++) {
            if (paired[i].zimag < 0) {
                return i;
            }
        }

        return -1;
    }

    return {
        metadata: { ...defaultMetadata, ...parsed.metadata },
        data: parsed.data,
        transitionIndex: findIndexOfFirstNegativeIm(
            parsed.data.map(d => d.freq), 
            parsed.data.map(d => d.zimag)
        )
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
    // Handle this 3,82 V -> 3.82 stuff first and split the file into lines
    text = text.replace(/(\d),(\d)/g, '$1.$2');
    const lines = text.split('\n');

    const metadata = {};
    let lineIndex = 1;

    // First step: Header stuff (until OCVCURVE or ZCURVE)
    while (lineIndex < lines.length) {
        const line = lines[lineIndex];

        if (line.startsWith('OCVCURVE\tTABLE') || line.startsWith('ZCURVE\tTABLE')) {
            break;
        }

        // Get parts of the metadata information (keyword \t type \t value \t description)
        const parts = line.split('\t');
        const keyword = parts[0];

        // If keyword is empty, we have an empty row
        if (!keyword || keyword.trim() === '') {
            lineIndex++;
            continue;
        }

        // Check if its a two-column row
        const value = (parts.length > 2) ? parts[2] : parts[1];

        // Extract metadata
        switch (keyword) {
            case 'TAG':
                if (value.includes('HYBRID')) {
                    mode = 'heis'; // Holy hybrid eis
                } else if (value.includes('POT')) {
                    mode = 'peis'; // potentiostatic
                } else {
                    mode = 'geis'; // Probably galvanostatic
                }
                metadata.mode = mode;
                break;
            case 'TITLE':
                metadata.label = value;
                break;
            case 'DATE':
                metadata.date = formatGamryDate(value);
                break;
            case 'TIME':
                metadata.time = value;
                break;
            case 'PSTAT':
                metadata.device = value;
                break;
            case 'VAC':
                metadata.vac_mV = parseFloat(value);
                break;
            case 'FREQINIT':
                metadata.frequencyInit_Hz = parseFloat(value);
                break;
            case 'FREQFINAL':
                metadata.frequencyFinal_Hz = parseFloat(value);
                break;
            case 'PTSPERDEC':
                metadata.ppd = parseFloat(value);
                break;
            case 'DRIFTCOR':
                metadata.driftCorrection = value == 1;
                break;
            case 'EOC':
                metadata.preTestOCP_V = parseFloat(value);
                break;
            default: 
        }

        lineIndex++;
    }

    // Add some stuff we don't have in the data
    metadata.cellId = 'N/A';
    metadata.testId = 'N/A';

    const ocpTime = [];
    const ocpVoltage = [];
    const ocpTemp = [];

    // Second step: Get OCV (if we have that)
    if (lines[lineIndex]?.startsWith('OCVCURVE')) {
        lineIndex++;

        // Get headers
        const columns = lines[lineIndex].split('\t');
        const timeIndex = columns.indexOf('T');
        const voltageIndex = columns.indexOf('Vf');
        const tempIndex = columns.indexOf('Temp\r');
        lineIndex++;
        lineIndex++; // No need for units
        
        // Parse data
        while (lineIndex < lines.length && lines[lineIndex].startsWith('\t')) {
            lineColumns = lines[lineIndex].split('\t');

            ocpTime.push(parseFloat(lineColumns[timeIndex]));
            ocpVoltage.push(parseFloat(lineColumns[voltageIndex]));
            ocpTemp.push(parseFloat(lineColumns[tempIndex]));

            lineIndex++;
        }
    }

    // Store some more information
    if (ocpVoltage.length > 5) {
        // Only consider last 5 values
        lastOcpVoltagePoints = ocpVoltage.slice(-5);
        lastOcpTempPoints = ocpTemp.slice(-5);
        metadata.meanPreTestOCP_V = lastOcpVoltagePoints.reduce((a, b) => a + b) / lastOcpVoltagePoints.length;
        metadata.meanPreTestTemp_degC = lastOcpTempPoints.reduce((a, b) => a + b) / lastOcpTempPoints.length;
    } else {
        metadata.meanPreTestOCP_V = -1;
        metadata.meanPreTestTemp_degC = -1;
    }

    const zFrequency = [];
    const zReal = [];
    const zImag = [];
    const zTemp = [];

    // Skip to EIS data
    while (lineIndex < lines.length && !lines[lineIndex]?.startsWith('ZCURVE')) {
        lineIndex++;
    }
    
    // Third and last main step: Lets bother with impedance
    if (lines[lineIndex]?.startsWith('ZCURVE')) {
        lineIndex++;

        // Get headers
        const columns = lines[lineIndex].split('\t');
        const frequencyIndex = columns.indexOf('Freq');
        const zRealIndex = columns.indexOf('Zreal');
        const zImagIndex = columns.indexOf('Zimag');
        const tempIndex = columns.indexOf('Temp\r');
        lineIndex++;
        lineIndex++; // No need for units again
        
        // Parse data
        while (lineIndex < lines.length && lines[lineIndex].startsWith('\t')) {
            lineColumns = lines[lineIndex].split('\t');

            zFrequency.push(parseFloat(lineColumns[frequencyIndex]));
            zReal.push(parseFloat(lineColumns[zRealIndex]));
            zImag.push(parseFloat(lineColumns[zImagIndex]));
            zTemp.push(parseFloat(lineColumns[tempIndex]));

            lineIndex++;
        }
    }

    // Compile data
    const data = zFrequency.map((freq, i) => ({
        freq: freq,
        zreal: zReal[i],
        zimag: zImag[i],
        temp: zTemp[i]
    }));    

    return { metadata, data };
}

// Some helper functions
function splitStandardizedCSVDateTime(str) {
    const [datePart, timePart] = str.split(' ');
    const [day, month, year] = datePart.split('.');

    return {
        date: `${year}-${month}-${day}`,
        time: timePart
    }
}

function formatGamryDate(dateStr) {
    // Split the various different Gamry date formats (thanks Gamry)
    let parts;
    if (dateStr.includes('.')) {
        parts = dateStr.split('.');
    } else if (dateStr.includes('/')) {
        parts = dateStr.split('/');
    } else if (dateStr.includes('-')) {
        parts = dateStr.split('-');
    } else {
        return dateStr; // At this point, we either have what we want (YYYY-MM-DD) or we give up
    }

    let [day, month, year] = parts;

    // Pad with zeros
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');

    return `${year}-${month}-${day}`;
}

