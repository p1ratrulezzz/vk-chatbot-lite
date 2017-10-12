'use strict';

/**
 * Module dependencies.
 * @private
 */
const EventEmitter = require('events');
const path         = require('path');
const fetch        = require('../../../lib/fetch');
const pino         = require('../../../lib/pino');
const config       = require('../../../config');

/**
 * Local constants.
 * @private
 */
const HTML_ENTITIES = [[/&lt;/g, '<'], [/&gt;/g, '>'], [/&amp;/g, '&'], [/&quot;/g, '"'], [/<br>/g, '. ']];

/**
 * Собирает объект сообщения из массива LongPoll-обновлений.
 * @param   {Array}  item Update item
 * @return  {Object}
 * @private
 */
function assembleMessage (item) {
  const attachments = item[7] || Object.create(null);
  const messageId   = item[1];
  let   message     = item[6] || '';

  const mchatSenderId = parseInt(attachments.from);
  const isMultichat   = mchatSenderId && true || false;

  const conversationId = isMultichat ? (item[3] - 2000000000) : item[3];
  const senderId       = isMultichat ? mchatSenderId : conversationId;

  // Decode HTML entities.
  for (const [replaceWhat, replaceWith] of HTML_ENTITIES) {
    message = message.replace(replaceWhat, replaceWith);
  }

  return {
    attachments,                     // <Object>  Прикрепления к сообщению
    body:            message,        // <String>  Текст сообщения
    message_id:      messageId,      // <Number>  ID сообщения
    conversation_id: conversationId, // <Number>  ID диалога
    sender_id:       senderId,       // <Number>  ID отправителя сообщения
    is_multichat:    isMultichat     // <Boolean> true, если сообщение отправлено в беседу
  }
}

/**
 * Собирает объект сообщения к отправке.
 * @param   {Object/String} resultObject  Объект, который вернул парсер
 * @param   {Object}        messageObject Исходный объект сообщения
 * @return  {Object}
 * @private
 */
function buildMessage (resultObject = {}, messageObject = {}) {
  if (typeof resultObject === 'string') {
    resultObject = {
      message: resultObject
    }
  }

  const conversationType = messageObject.is_multichat ? 'chat_id' : 'user_id';
  const conversationId   = messageObject.conversation_id;

  const message = resultObject.message || '';

  let forwards = resultObject.forward_messages || '';

  if (forwards && Array.isArray(forwards)) {
    forwards = forwards.join(',');
  }

  if (!forwards) {
    if (resultObject.forward === true) {
      forwards = messageObject.message_id;
    }

    if (resultObject.forward === undefined) {
      forwards = messageObject.is_multichat ? messageObject.message_id : '';
    }
  }

  // Нечего отправлять.
  if (!message && !forwards) {
    return;
  }

  return {
    message,
    [conversationType]: conversationId,
    forward_messages:   forwards
  }
}

/**
 * Обрабатывает переданное сообщение.
 * @param {Object}
 *   @property {Bot}           bot           Экземпляр "Bot"
 *   @property {Object}        messageObject Объект сообщения
 * @return {Promise => Object}
 * @public
 */
async function processMessage (bot, messageObject) {
  const eventType = getEventTypeForMessage(bot, messageObject);

  if (!eventType) {
    return;
  }

  const eventHandler = require(path.join(config['events-path'], eventType));

  // eventHandler should not throw an error.
  const handleResult = await eventHandler(bot, messageObject);

  if (!handleResult) {
    return;
  }

  return buildMessage(handleResult, messageObject);
}

/**
 * Отправляет сообщение.
 * @param  {Bot}     bot           Экземпляр "Bot"
 * @param  {Object}  messageObject Объект сообщения, готовый к отправке
 * @return {Promise}
 * @public
 */
function sendMessage (bot, messageObject) {
  return bot.api.call('messages.send', messageObject)
    .catch(error => {
      if (error.name === 'VkApiError') {
        // Флуд-контроль. Добавляем в конец сообщения смайлик и отправляем запрос снова.
        if (error.code === 9) {
          messageObject.message = messageObject.message + ' 😊';

          return sendMessage(bot, messageObject);
        }

        // Внутрення серверная ошибка, отправлять по-новой ничего не будем.
        if (error.code === 10) {
          return;
        }

        // Доступ запрещён. Скорее всего, бота кикнули из беседы и
        // он не может отправить в неё сообщение из очереди.
        if (error.code === 7) {
          return;
        }

        // Скорее всего, пользователь внёс бота в ЧС, потому как
        // код ошибки 902 говорит о том, что бот не может отправить
        // сообщение в связи с настройками приватности.
        if (error.code === 902) {
          return;
        }
      }

      pino.error('Bot id%d unable to send a message.', bot.id, error);

      return;
    });
}

/**
 * Определяет тип события для входящего сообщения.
 * @param   {Bot}         bot     Экземпляр "Bot"
 * @param   {Object}      message Объект сообщения
 * @return  {String/null}
 * @private
 *
 * Возможные события:
 *   appeal           Пользователь обратился к боту
 *   bot-invited      В беседу был приглашён бот
 *   bot-kicked       Из беседы был исключён бот
 *   bot-left         Из беседы бот вышел сам
 *   chat-created     Была создана беседа вместе с ботом
 *   gift             Боту прислали подарок
 *   user-invited     В беседу был приглашён пользователь
 */
function getEventTypeForMessage (bot, message) {
  const attachments = message.attachments;

  if (attachments) {
    if (attachments.attach1_type === 'gift') {
      return 'gift';
    }

    if (attachments.source_act === 'chat_create') {
      return 'chat-created';
    }

    if (attachments.source_act === 'chat_invite_user') {
      if (parseInt(attachments.source_mid) !== bot.id) {
        return 'user-invited';
      }

      if (message.sender_id !== bot.id) {
        return 'bot-invited';
      }
    }

    if (attachments.source_act === 'chat_kick_user') {
      if (message.sender_id !== bot.id) {
        return 'bot-kicked';
      }

      return 'bot-left';
    }
  }

  if (message.is_multichat) {
    const pattern = bot.pattern || config['default-pattern'];

    if (pattern && pattern.test(message.body)) {
      return 'appeal';
    }

    return null;
  }

  return 'appeal';
}

/**
 * Отправляет LongPoll-запрос.
 * @param  {Bot}     bot  Экземпляр "Bot"
 * @param  {String}  link LongPoll Server URL
 * @return {Promise}
 * @public
 */
function makeALongPollRequest (bot, link = '') {
  if (!link) {
    return bot.api.call('messages.getLongPollServer', { lp_version: 2 })
      .then(response => {
        return makeALongPollRequest(
          bot,
          `https://${response.server}?act=a_check&wait=25&mode=2&key=${response.key}&ts=${response.ts}`
        );
      })
      .catch(error => {
        // Не пишем в лог серверные ошибки ВКонтакте.
        if (!(error.name === 'VkApiError' && error.code === 10)) {
          pino.error('Unable to get LongPoll server info.', error);
        }

        return makeALongPollRequest(bot);
      });
  }

  return fetch(link)
    .then(response => {
      if (response.status !== 200) {
        // LongPoll Server ВКонтакте очень часто возвращает 404, 500-504 и прочие ошибки.
        // Повторим запрос через 1,5 секунды.
        return setTimeout(() => makeALongPollRequest(bot), 1500);
      }

      return response.json()
        .then(resJson => {
          // Параметр "key" устарел, нужно запросить новые "key" и "ts".
          if (resJson.failed && resJson.failed !== 1) {
            return makeALongPollRequest(bot);
          }

          // Обновляем "ts" для следующего запроса.
          link = link.replace(/ts=.*/, 'ts=' + resJson.ts);

          // Обновлений нет.
          if (!resJson.updates || !resJson.updates.length) {
            return makeALongPollRequest(bot, link);
          }

          // Отправляем новый запрос.
          makeALongPollRequest(bot, link);

          // Обрабатываем полученные обновления.
          processUpdates(bot.id, resJson.updates);

          return;
        });
    })
    .catch(error => setTimeout(() => makeALongPollRequest(bot), 1500));
}

/**
 * Обрабатывает LongPoll-обновления.
 * @param   {Number}         id      ID бота
 * @param   {Array of Array} updates Массив обновлений [vk.com/dev/using_longpoll]
 * @return  {void}
 * @private
 */
function processUpdates (id, updates) {
  for (const item of updates) {
    const mchatSenderId = item[7] && item[7].from && parseInt(item[7].from);
    const flags         = item[2];

    if (
      // Новое сообщение.
      item[0] === 4 &&

      // Сообщение не прочитано.
      (flags & 1) !== 0 &&

      // Сообщение является входящим.
      (flags & 2) === 0 &&

      // Сообщение прислал друг.
      // * Пользователи, отправляющие сообщения в беседу, автоматически
      // становятся "друзьями".
      (
        (flags & 32) !== 0 || mchatSenderId
      ) &&

      // Отправитель сообщения - не бот.
      (
        // Для сообщения из беседы.
        mchatSenderId && mchatSenderId !== id ||

        // Для сообщения из личного диалога.
        item[3] !== id
      )
    ) {
      module.exports.emitter.emit(`message:${id}`, assembleMessage(item));

      continue;
    }
  }
}

module.exports = {
  emitter: new EventEmitter(),

  process:          processMessage,
  send:             sendMessage,
  startLongPolling: makeALongPollRequest
}
