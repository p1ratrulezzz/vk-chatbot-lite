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
 * В беседу пригласили пользователя.
 * @param  {Bot}    bot     Экземпляр "Bot"
 * @param  {Object} message Объект сообщения
 * @public
 */
async function handler (bot, message) {
  // В беседу был приглашён ещё один наш бот.
  // Старый бот выходит, новый остаётся.
  if (OUR_BOTS_IDS.includes(message.attachments.source_mid.toString())) {
    return bot.api.call('messages.removeChatUser', {
        chat_id: message.conversation_id,
        user_id: bot.id
      })
      .then(() => null)
      .catch(error => {
        if (error.name === 'VkApiError') {

          // Нет доступа к чату. Значит, бот уже вышел из него.
          if (error.code === 15) {
            return;
          }
        }

        pino.error('Bot id%d unable to leave a chat.', bot.id, error);

        return;
      });
  }

  return;
}

module.exports = handler;
