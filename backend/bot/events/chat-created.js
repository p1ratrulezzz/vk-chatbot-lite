'use strict';

/**
 * Module dependencies.
 * @private
 */
const pino = require('../../lib/pino');

/**
 * Local constants.
 * @private
 */

/**
 * Список ID наших ботов.
 * @type {Array of String}
 */
const OUR_BOTS_IDS = Object.keys(require('../../config/accounts'));

/**
 * Беседа только что создана вместе с ботом.
 * @param  {Bot}    bot     Экземпляр "Bot"
 * @param  {Object} message Объект сообщения
 * @public
 */
async function handler (bot, message) {
  return bot.api.call('messages.getChatUsers', {
    chat_id: message.conversation_id
  })
    .then(response => {
      if (!response || !response.length) {
        return;
      }

      /**
       * Список ID участников беседы.
       * @type {Array of String}
       */
      const userIds = response.map(userId => userId.toString());

      let matchesCount = 0;

      for (const botId of OUR_BOTS_IDS) {
        if (userIds.includes(botId)) {
          matchesCount++;
        }

        if (matchesCount > 1) {
          break;
        }
      }

      if (matchesCount > 1) {
        return bot.api.call('messages.removeChatUser', {
            chat_id: message.conversation_id,
            user_id: bot.id
          })
          .then(() => null)
          .catch(error => pino.error(error));
      }

      return {
        message: 'Привет!\n' +
                 'Я — чат-бот от паблика <<Чат-боты>> — vk.com/dumbbot',
        forward: false
      }

    })
    .catch(error => pino.error(error));
}

module.exports = handler;
