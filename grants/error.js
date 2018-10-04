'use strict';

function normaliseError(error) {
    let errorCode = {
        status: 400,
        code: 'ERR-UNKNOWN',
        title: 'Unknown error'
    };

    switch (error.message) {
        case 'InvalidPostcode':
            errorCode = {
                status: 400,
                code: 'ERR-POSTCODE',
                title: 'Invalid postcode lookup'
            };
            break;
        case 'MongoConnect':
            errorCode = {
                status: 400,
                code: 'ERR-DB-CONN',
                title: 'Could not connect to Mongo'
            };
            break;
        default:
            break;
    }

    return errorCode;
}


module.exports = {
    normaliseError
};
