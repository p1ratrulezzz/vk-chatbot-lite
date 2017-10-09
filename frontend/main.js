(function () {
  var CAPTCHA_REGEXP = /[^a-zа-яё0-9]/i;

  var $captchaContainer  = document.getElementById('captcha-container');
  var $captchaBlock      = document.getElementById('captcha-block');
  var $captchaEmptyBlock = document.getElementById('captcha-empty-block');
  var $captchaImg        = document.getElementById('captcha-img');
  var $captchaInput      = document.getElementById('captcha-input');
  var $captchaSendButton = document.getElementById('captcha-send-button');

  var activeCaptchaList = [];
  var userInfo;

  main();

  /**
   * Точка входа.
   * @return {void}
   */
  function main () {
    // Парсим данные пользователя.
    parseUserInfo();

    // Устанавливаем обработчик на нажатие Enter в поле ввода капчи.
    $captchaInput.addEventListener('keyup', function (event) {
      if (event.key === 'Enter') {
        sendCaptchaKey();
      }
    });

    // Устанавливаем обработчик на клик по кнопке "Отправить".
    $captchaSendButton.addEventListener('click', sendCaptchaKey);

    // Получаем список активных капч.
    updateActiveCaptchaList();

    // Обновляем данные о наличии активных капч каждые 15 секунд.
    setInterval(updateActiveCaptchaList, 15000);
  }

  /**
   * Отправляет введённый код с картинки.
   * @return {void}
   */
  function sendCaptchaKey () {
    var captchaObj = activeCaptchaList.shift();
    var captchaKey = $captchaInput.value;

    // Если этой капчи уже нет в списке,
    // либо код не введён,
    // либо пользователь не авторизован,
    // либо пользователь ввёл некорреткный код,
    // то отправлять ничего не будем.
    if (
      !captchaObj ||
      !captchaKey ||
      !userInfo ||
      CAPTCHA_REGEXP.test(captchaKey)
    ) {
      return;
    }

    request('captcha.send', {
      auth_key:       userInfo.authKey,
      captcha_bot_id: captchaObj.botId,
      captcha_sid:    captchaObj.sid,
      captcha_key:    captchaKey,
      user_id:        userInfo.id
    }, function (_, response) {
      $captchaInput.value = '';

      updateCaptchaContainer();
    });
  }

  /**
   * Обновляет контейнер с капчей.
   * @return {void}
   */
  function updateCaptchaContainer () {
    // Если есть активные капчи, показываем блок с картинкой.
    // В обратном случае - скрываем его.
    if (activeCaptchaList.length) {
      toggleCaptchaBlock('show');

      $captchaImg.setAttribute('src', '/api/captcha.image?sid=' + activeCaptchaList[0].sid);
    } else {
      toggleCaptchaBlock('hide');
    }
  }

  /**
   * Показывает / скрывает блок с картинкой капчи и полем ввода.
   * @param  {String} act show / hide
   * @return {void}
   */
  function toggleCaptchaBlock (act) {
    $captchaContainer.classList[act === 'show' ? 'remove' : 'add']('is-empty');

    $captchaBlock.style.display      = act === 'show' ? 'table-cell' : 'none';
    $captchaEmptyBlock.style.display = act === 'show' ? 'none' : 'block';
  }

  /**
   * Обновляет список активных капч.
   * @return {void}
   */
  function updateActiveCaptchaList () {
    request('captcha.getAll', function (error, response) {
      if (error) {
        return;
      }

      activeCaptchaList = [];

      response.forEach(function (captchaArray) {
        captchaArray[1].forEach(function (captchaSid) {
          activeCaptchaList.push({
            botId: captchaArray[0],
            sid:   captchaSid
          });
        });
      });

      updateCaptchaContainer();
    });
  }

  /**
   * "Вытаскивает" "auth_key" и "viewer_id" из URL.
   * @return {void}
   */
  function parseUserInfo () {
    var search = location.search.slice(1);

    if (!search) {
      return;
    }

    // ID пользователя.
    var id = search.match(/viewer_id=([^&]+)/);
        id = id && id[1];

    // auth_key.
    var authKey = search.match(/auth_key=([^&]+)/);
        authKey = authKey && authKey[1];

    if (!id || !authKey) {
      return;
    }

    userInfo = {
      authKey: authKey,
      id:      id
    }
  }

  /**
   * XMLHttpRequest wrapper for API requests.
   * @param  {String}   method   API method
   * @param  {Object}   qs       Request querystring
   * @param  {Function} callback
   * @return {void}
   */
  function request (method, qs, callback) {
    var url = 'https://botsforchats.ru/api/' + method;

    if (typeof qs === 'function') {
      callback = qs;
      qs       = undefined;
    }

    var request = new XMLHttpRequest();

    // Parse querystring params.
    if (qs) {
      url += '?';

      Object.keys(qs).forEach(function (key) {
        url += key + '=' + encodeURIComponent(qs[key]) + '&';
      });

      if (url.endsWith('&')) {
        url = url.slice(0, -1);
      }
    }

    request.open('get', url, true);

    request.onload = function () {
      var status = request.status;

      if (status >= 200 && status <= 399) {
        try {
          var response = JSON.parse(request.responseText);

          if (response.ok === true) {
            return callback(null, response.response);
          }

          if (response.ok === false) {
            return callback(response.cause);
          }

          return callback(null, response);
        } catch (e) {
          return callback('JSON.parse Error');
        }
      } else {
        callback('Status Code Error');
      }
    }

    request.onerror = function () { callback('Network Error'); }

    request.send();
  }
})();
