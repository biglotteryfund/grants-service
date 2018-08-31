/* eslint-env jest */
'use strict';
module.exports = async function() {
    console.log('Teardown mongod');  // eslint-disable-line no-console
    await global.__MONGOD__.stop();
};
