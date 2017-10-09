'use strict';

/**
 * Module dependencies.
 * @private
 */
const pino      = require('../lib/pino');
const authorize = require('./base/authenticator');
const Bot       = require('./base/Bot/Bot');
const accounts  = require('../config/accounts');

/**
 * Объект, хранящий экземпляры "Bot".
 * @type {Object}
 */
const bots = Object.create(null);

authorize(Object.keys(accounts).map(botId => accounts[botId].auth))
  .then(tokens => {
    for (const token of tokens) {
      bots[token.botId] = new Bot(token, accounts[token.botId].pattern);
    }
  })
  .catch(error => pino.error(error));

process.on('SIGINT', async () => {
  await require('../lib/redis').quit();

  process.exit(0);
});
