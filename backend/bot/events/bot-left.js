'use strict';

/**
 * Бот вышел из беседы.
 * @param  {Bot}    bot     Экземпляр "Bot"
 * @param  {Object} message Объект сообщения
 * @public
 */
async function handler (bot, message) {
  // Удаляем сообщения из очереди для этой беседы.
  bot.queue.clearById(message.conversation_id);

  return;
}

module.exports = handler;
