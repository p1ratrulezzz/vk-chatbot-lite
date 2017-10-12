'use strict';

/**
 * Module dependencies.
 * @private
 */
const cleverbot = require('../../lib/cleverbot');
const pino      = require('../../lib/pino');

/**
 * Local constants.
 * @private
 */
const RUSSIAN_LANG_REGEXP = /[а-яё]/ig;

/**
 * Обращение к боту.
 * @param  {Bot}     bot     Экземпляр "Bot"
 * @param  {Object}  message Объект сообщения
 * @public
 */
async function handler (bot, message) {
  let messageReceived = message.body;

  // Для сообщений в беседах удаляем из текста обращение к боту.
  if (message.is_multichat) {
    messageReceived = messageReceived.replace(/^[^\s,]+/, '').trim();
  }

  // Сообщение не содержит ни одного русского символа. Ничего отвечать не будем.
  if (!RUSSIAN_LANG_REGEXP.test(messageReceived)) {
    return;
  }

  // Получаем ответ на сообщение от Cleverbot.
  return cleverbot.send(messageReceived.slice(0, 250))
    .then(response => {
      let reply = response;

      // Не пришло внятного ответа. Или от cleverbot.com пришло рекламное сообщение.
      if (!reply || /(?:botlike|clever|real person)/.test(reply.toLowerCase())) {
        return;
      }

      // Ответ пришёл и он нормальный.
      // Удаляем точку в конце предложения, ибо Cleverbot любит
      // ставить точки даже в конце вопросительных предложений.
      if (reply.endsWith('.')) {
        reply = reply.slice(0, -1);
      }

      return reply;
    })
    .catch(error => pino.error('Error getting answer from Cleverbot.', error));
}

module.exports = handler;
