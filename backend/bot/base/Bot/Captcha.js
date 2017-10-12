'use strict';

/**
 * Module dependencies.
 * @private
 */
const redis = require('../../../lib/redis');

/**
 * Local variables.
 * @private
 */
const waitingList = Object.create(null);

/**
 * Определяет новую команду Redis, которая будет
 * возвращать список активных капч для всех ботов.
 */
redis.client.defineCommand('captchaGetAll', {
  numberOfKeys: 0,
  lua: `
local matches = redis.call('KEYS', 'captcha:*')
local captcha = {}

for _,key in ipairs(matches) do
  local bot_id  = string.sub(key, 9)
  local captchs = redis.call('SMEMBERS', key)

  table.insert(captcha, { bot_id, captchs })
end

return captcha
`
});

/**
 * Подписывается на канал Redis для получения капчи.
 * @return  {void}
 * @private
 */
function _subscribe () {
  // Подписываемся на канал, куда будут приходить разгаданные капчи.
  redis.pubsub.psubscribe(
    // captcha:recognized:<bot_id>:<captcha_sid>
    'captcha:recognized:*'
  );

  /**
   * Обрабатывает приходящие сообщения (сообщение = разгаданная капча).
   */
  redis.pubsub.on('pmessage', (pattern, channel, message) => {
    if (waitingList[channel]) {
      // Resolving Promise with captcha_key.
      waitingList[channel](message);

      clearTimeout(waitingList[channel + '_timer']);

      waitingList[channel] = undefined;
      waitingList[channel + '_timer'] = undefined;
    }
  });
}

/**
 * Возвращает все активные капчи для всех ботов.
 * @return {Promise => Array of BotCaptcha}
 * @public
 *
 * BotCaptcha:
 *   [
 *     bot_id,
 *     [
 *       captcha_sid,
 *       captcha_sid,
 *       ...
 *     ]
 *   ]
 */
async function getAll () {
  return redis.client.captchaGetAll();
}

/**
 * Добавляет активную капчу и ждёт, пока она будет распознана.
 * @param {Object}
 *   @property {Number} botId      ID бота
 *   @property {String} captchaSid Captcha SID
 * @return {Promise}
 * @public
 */
async function addAndWait (botId, captchaSid) {
  await redis.call('SADD', `captcha:${botId}`, captchaSid);

  return new Promise(resolve => {
    let waitKey = `captcha:recognized:${botId}:${captchaSid}`;

    waitingList[waitKey] = resolve;

    // Подождём 10 минут и попробуем отправить сообщение,
    // если капча до сих пор не разгадана.
    waitingList[waitKey + '_timer'] = setTimeout(() => {
      // Значение переменной до сих пор хранится здесь.
      // Капча всё ещё не разгадана.
      if (waitingList[waitKey]) {
        // Удаляем капчу из активных.
        remove(botId, captchaSid);

        clearTimeout(waitingList[waitKey + '_timer']);

        waitingList[waitKey] = undefined;
        waitingList[waitKey + '_timer'] = undefined;

        resolve(null);
      }

      waitKey = null;
    }, 10 * 60 * 1000);
  });
}

/**
 * Удаляет активную капчу.
 * @param {Object}
 *   @property {Number} botId      ID бота
 *   @property {String} captchaSid Captcha SID
 * @return {Promise}
 * @public
 */
async function remove (botId, captchaSid) {
  return redis.call('SREM', `captcha:${botId}`, captchaSid);
}

module.exports = {
  getAll,
  addAndWait,
  remove,

  _subscribe
}
