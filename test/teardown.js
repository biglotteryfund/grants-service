/* eslint-env jest */
'use strict';
module.exports = async function() {
    console.log('Teardown mongod');
    await global.__MONGOD__.stop();
};
