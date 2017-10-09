'use strict';

/**
 * Module dependencies.
 * @private
 */
const VkApi   = require('node-vkapi');
const Captcha = require('./Captcha');

// Subscribe to channels.
Captcha._subscribe();

class Api {
  /**
   * Constructor
   * @param  {Object} params
   *   @property {String} accessToken Access token
   * @param  {Number} botId ID бота
   * @return {this}
   */
  constructor (params, botId) {
    this.botId    = botId;
    this.instance = new VkApi(params);

    /**
     * "Замороженные" методы: нужен ввод капчи.
     * @type {Set}
     */
    this.frozenMethods = new Set();
  }

  /**
   * "node-vkapi" .call() wrapper
   *
   * ## https://github.com/olnaz/node-vkapi/blob/master/lib/vkapi.js#L141
   */
  call (method, params = {}) {
    // Метод "заморожен" до ввода капчи.
    if (this.frozenMethods.has(method)) {
      return Promise.reject('This method is frozen for now.');
    }

    return this.instance.call(method, params)
      .catch(async error => {
        if (error.name === 'VkApiError' && error.code === 14) {
          // "Заморозим" метод на время, т.к. его всё равно нельзя
          // будет использовать до ввода капчи.
          this.frozenMethods.add(method);

          const captchaSid = error.captchaSid;
          const captchaKey = await Captcha.addAndWait(this.botId, captchaSid);

          // "Разморозим" метод, т.к. ввод капчи, скорее всего, больше не нужен.
          this.frozenMethods.delete(method);

          // Капчу не разгадали за 10 минут, попробуем выполнить запрос снова.
          if (!captchaKey) {
            return this.call(method, params);
          }

          // Капча была разгадана, отправляем запрос вместе с кодом с картинки.
          return this.call(
            method,
            Object.assign(
              params,
              {
                captcha_sid: captchaSid,
                captcha_key: captchaKey
              }
            )
          );
        }

        throw error;
      });
  }
}

module.exports = Api;
