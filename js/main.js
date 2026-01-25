Dropzone.options.eisupload = {
    // Config
    paramName: 'file',
    maxFileSize: 2,
    maxFiles: 1,

    dictDefaultMessage: 'Drop your EIS file (Gamry) here to proceed',

    accept: function(file, done) {
        if (file.name == 'biologic.csv') {
            done('Not yet');
        } else {
            done();
        }
    }
};