'use strict';

/**
 * Бота пригласили в беседу.
 * @param  {Bot}    bot     Экземпляр "Bot"
 * @param  {Object} message Объект сообщения
 * @public
 */
async function handler (bot, message) {
  return {
    message: 'Привет!\n' +
             'Я — чат-бот от паблика <<Чат-боты>> — vk.com/dumbbot',
    forward: false
  }
}

module.exports = handler;
