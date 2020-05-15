'use strict';

/**
 * Match postcode
 * Matches UK postcodes only
 * @see https://github.com/chriso/validator.js/blob/master/lib/isPostalCode.js#L54
 * @param {string} input
 */
function matchPostcode(input) {
    return (
        input &&
        input.match(/(gir\s?0aa|[a-zA-Z]{1,2}\d[\da-zA-Z]?\s?(\d[a-zA-Z]{2})?)/)
    );
}

/**
 * Turns a number into a localised count
 * eg. 123456 => 123,456
 * @param {string} str
 */
function numberWithCommas(str = '') {
    const n = parseFloat(str);
    return n.toLocaleString();
}

module.exports = {
    matchPostcode,
    numberWithCommas,
};
