'use strict';

/**
 * Module dependencies.
 * @private
 */
const pino     = require('../../../lib/pino');
const VkApi    = require('./VkApi');
const Messages = require('./Messages')
const Queue    = require('./Queue');
const config   = require('../../../config');

class Bot {
  /**
   * Constructor.
   * @param  {Object} token
   *   @property {Number} botId ID бота
   *   @property {String} token Access token
   * @param  {RegExp} pattern Паттерн обращения к боту
   * @return {this}
   */
  constructor (token, pattern) {
    /**
     * ID бота.
     * @type {Number}
     */
    this.id = token.botId;

    /**
     * Паттерн обращения к боту.
     * @type {RegExp}
     */
    this.pattern = pattern;

    /**
     * Экземпляр "VkApi" для взаимодействия с API ВКонтакте через бота.
     * @type {VkApi}
     */
    this.api = new VkApi({ accessToken: token.token }, this.id);

    /**
     * Очередь сообщений бота.
     * @type {Queue}
     */
    this.queue = new Queue({
      limit: 25
    });

    // Запускаем бота.
    this._start();
  }

  /**
   * Запускает бота.
   * @return  {void}
   * @private
   */
  _start () {
    this._startMessageProcessing();
    this._startMessageSending();
    this._startStatusUpdating();
    this._startFriendRequestsAccepting();
  }

  /**
   * Запускает процесс получения и обработки сообщений.
   * @return  {Promise => void}
   * @private
   */
  async _startMessageProcessing () {
    // Начинаем получение сообщений с использованием long-poll запросов.
    Messages.startLongPolling(this);

    // Обрабатываем входящие сообщения.
    Messages.emitter.on(`message:${this.id}`, async messageObject => {
      pino.info('Bot id%d has received a new message.', this.id);

      // Очередь заполнена на максимум, новые сообщения обрабатываться не будут.
      if (this.queue.isFull()) {
        pino.info('Bot id%d message queue is full, message will not be processed.', this.id);

        return;
      }

      const messageProcessed = await Messages.process(this, messageObject);

      if (!messageProcessed) {
        return;
      }

      this.queue.enqueue(messageProcessed);
    });
  }

  /**
   * Запускает процесс отправки сообщений из очереди.
   * @return  {void}
   * @private
   */
  _startMessageSending () {
    // Очередь сообщений пуста.
    if (this.queue.isEmpty()) {
      return setTimeout(() => this._startMessageSending(), config['messages-delay']);
    }

    const message = this.queue.dequeue();

    // Это условие выполняется в случаях, когда
    // message === null / undefined, что случается при
    // покидании ботом беседы.
    //
    // В таких случаях сразу же переходим к следующему
    // сообщению в очереди.
    if (!message) {
      return this._startMessageSending();
    }

    // Если при отправке сообщения появилась капча, то
    // отправка следующего сообщения из очереди откладывается до тех пор,
    // пока не будет разгадана капча и отправлено текущее сообщение.
    //
    // При этом, обработка входящих сообщений не прекращается. Однако,
    // размер очереди сообщений ограничен. После достижения этого кол-ва
    // последующие сообщения обрабатываться не будут.
    Messages.send(this, message)
      .then(response => {
        pino.info('Bot id%d has sent a reply to a message.', this.id);

        return setTimeout(() => this._startMessageSending(), config['messages-delay']);
      });
  }

  /**
   * Запускает процесс обновления статуса "Онлайн".
   * @return  {void}
   * @private
   */
  _startStatusUpdating () {
    this.api.call('account.setOnline')
      .then(response => setTimeout(() => this._startStatusUpdating(), config['status-delay']))
      .catch(error => {
        pino.error('Bot id%d unable to update an online status.', this.id, error);

        return setTimeout(() => this._startStatusUpdating(), config['status-delay']);
      });
  }

  /**
   * Запускает процесс принятия входящих заявок в друзья, а также
   * отклонения исходящих.
   * @return  {void}
   * @private
   */
  _startFriendRequestsAccepting () {
    this.api.call('execute', {
      code: 'var rc = 12;' +
            'var fc = API.friends.get({ count: 1 }).count;' +
            'var ro = API.friends.getRequests({ count: 10, out: 1 }).items;' +
            'if (ro.length < 10) { rc = rc + (10 - ro.length); }' +
            'var ri = API.friends.getRequests({ count: rc, sort: 0 }).items;' +
            'var ac = 10000 + ro.length - fc;' +
            'while (ro.length > 0) { API.friends.delete({ user_id: ro.shift() }); }' +
            'while (ac > 0 && ri.length > 0) { API.friends.add({ user_id: ri.shift() }); ac = ac - 1; }' +
            'return "ok";'

    })
      .then(response => setTimeout(() => this._startFriendRequestsAccepting(), config['friends-delay']))
      .catch(error => {
        pino.error('Bot id%d unable to accept friend requests.', this.id, error);

        return setTimeout(() => this._startFriendRequestsAccepting(), config['friends-delay']);
      });
  }
}

module.exports = Bot;
