'use strict';

/**
 * Module dependencies.
 * @private
 */
const Redis = require('ioredis');
const pino  = require('../lib/pino');

// Клиенты Redis.
const client = new Redis();
const pubsub = new Redis();

client.on('error', error => {
  if (error.code === 'ECONNREFUSED') {
    console.log('Redis Server is not running!');
    process.exit(0);
  }

  pino.error(error);
});
pubsub.on('error', error => pino.error(error));

/**
 * Вызывает команду Redis.
 * @param  {String}  command Название команды
 * @param  {Any}     params  Параметры
 * @return {Promise}
 * @public
 */
async function call (command, ...params) {
  if (!command) {
    return;
  }

  command = command.toLowerCase();

  // Такой команды не существует.
  if (client[command] === undefined) {
    return;
  }

  return client[command](...params)
    .then(result => {
      if (
        command === 'hgetall' &&
        (!result || !Object.keys(result).length)
      ) {
        return null;
      }

      return result;
    })
    .catch(error => pino.error(error));
}

/**
 * Обёртка для Redis.pipeline.
 * @param  {Array}   args Аргументы, как для Redis.pipeline
 * @return {Promise}
 * @public
 */
async function pipeline (args) {
  // Переменная "args" должна быть массивом аргументов.
  if (!args || !Array.isArray(args)) {
    return;
  }

  return client.pipeline(args).exec()
    .then(results => {
      const onlyResults = [];

      // Проверим, все ли команды успешно выполнились.
      for (const result of results) {
        if (result[0] !== null) {
          pino.error(result[0]);

          return;
        }

        onlyResults.push(result[1]);
      }

      return onlyResults;
    })
    .catch(error => pino.error(error));
}

/**
 * Обрывает соединения с сервером Redis.
 * @return {Promise}
 * @public
 */
async function quit () {
  return Promise.all([
    client.quit(),
    pubsub.quit()
  ]);
}

module.exports = {
  call,
  pipeline,
  quit,

  client,
  pubsub
}
