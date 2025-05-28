/* eslint-disable */
// h5调试
var hostName = location.host;
var isProdEnv = true; // 是否线上环境
if (!(hostName.indexOf(configObj.productionEnvHost) > -1)) {
  isProdEnv = false;
  if (configObj.isDebug) {
    new window.VConsole();
  }
}
$(document).ready(function () {
  // 解决移动端300ms延迟
  FastClick.attach(document.body);
  // 跳转页面来源，wx pc 支付的时候需要跳转到该页面使用微信支付
  source = GetQueryString('source');
  pass_goods_desc = GetQueryString('goods_desc'); // 传值过来的商品描述
  mer_ord_id = GetQueryString('mer_ord_id');
  if (!mer_ord_id) {
    // 订单号
    mer_ord_id = dayjs().format('YYYYMMDDHHmmssSSS') + '' + randomNum(100, 999);
  }
  localStorage.setItem('mer_ord_id', mer_ord_id);
  $('#cashier_orderNumber').text(mer_ord_id);
  // 订单页面设置的金额
  var amount = decodeURIComponent(GetQueryString('price'));
  $('#cashier_priceNumber').text(amount);
  $('#pay_amount').text(amount);
  $('#cashier_priceNumber1').text(amount);
  $('#pay_amount1').text(amount);
  // 当前选中的支付方式
  var currentChosePayTypeIndex = 0;
  // 查询次数
  var timeCount = 30;
  var jumpURL = '';
  // 微信授权码
  var code = '',
    // 微信SDK的URL
    wxPaySDKURL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js',
    // 支付宝SDK的URL
    aliPaySDKURL =
      'https://gw.alipayobjects.com/as/g/h5-lib/alipayjsapi/3.1.1/alipayjsapi.inc.min.js',
    // 流水号
    hf_seq_id = '',
    // 轮训支付状态定时标识
    timer = null,
    // 银联授权码
    userAuthCode = '',
    // IP
    client_ip = '',
    // 银联userID
    union_user_id = '',
    // 银联授权码状态码
    respCode = '',
    // 倒计时时间
    effectTime = configObj.mobile.payTime * 60,
    pay_minute = '20',
    pay_second = '00',
    // 收银台展示样式 20220920 写死只有全屏，没有半屏支付
    pageShowType = 'fullScreen', // GetQueryString('pageShowType'),
    // 支付类型
    tradeType = '',
    continueAlipay = '', // 支付宝的继续支付
    continueQuickAndWAPpay = {}, // 手机网页或快捷支付的payinfo
    continueWxpay = {}, // 微信继续支付的payinfo
    continueUnionpay = '', // 银联继续支付的payinfo
    // websocket connection
    ws,
    wsMsg,
    beginTime, // 进页面创建订单时间
    pollDiffTime, // 轮询时间差
    wsDiffTime; // websocket收到消息的时间差

  // 订单倒计时,全屏幕版才会有倒计时
  if ($('#pay_minute') && $('#pay_minute').length) {
    startCountDown();
  }
  // 支付环境判断
  payEnvHandle();

  // 取消事件
  $('#cashierCancelBtn').click(function () {
    location.href = jumpLink('orderConfirm.html?price=' + amount);
  });
  // 支付点击事件
  $('#pay-button').click(function () {
    payType();
  });
  $('#pay-button1').click(function () {
    payType();
  });
  // 重新下单
  $('#continuePayBtn').click(function () {
    reOrder();
  });
  $('#continuePay').click(function () {
    if (jumpURL) {
      window.location.href = jumpURL;
    } else {
      $('#cancelMask').hide;
    }
  });
  // 切换支付类型
  var list = document.getElementsByTagName('li');
  for (let i = 0; i < list.length; i++) {
    list[i].onclick = function (e) {
      $(`#${list[i].id} input`).prop('checked', false);
      $(`#${e.target.id} input`).prop('checked', true);
      currentChosePayTypeIndex = i;
      tradeType = $(`#${e.target.id}`).attr('data-type');
      // 产品要求分期金额写死
      if (tradeType === 'FQ_ALIPAY') {
        amount = '100.00';
      } else if (tradeType === 'FQ_BANK') {
        amount = '600.00';
      } else {
        amount = decodeURIComponent(GetQueryString('price'));
      }
      $('#cashier_priceNumber').text(amount);
      $('#pay_amount').text(amount);
      $('#cashier_priceNumber1').text(amount);
      $('#pay_amount1').text(amount);
    };
  }

  /**
   * @Description: toast
   * @param {*} msg
   * @param {*} duration
   */
  function showToast(msg, duration) {
    clearTimeout(toastTimer);
    var ToastBox = document.getElementsByClassName('toastDiv-box')[0];
    if (ToastBox) document.body.removeChild(ToastBox); //防止重复弹出
    duration = isNaN(duration) ? 2000 : duration;
    var m = document.createElement('div');
    m.className = 'toastDiv-box';
    m.innerHTML = msg;
    m.style.cssText =
      'min-width: 6rem;max-width: 18rem;opacity: 0.7;color: #ffffff;text-align: center;padding: .5rem;border-radius: 5px;border-radius: 0.2rem;position: fixed;top: 15%;left: 50%; transform: translateX(-50%); -moz-transform: translateX(-50%);-ms-transform: translateX(-50%);-webkit-transform: translateX(-50%); z-index: 99;background: rgb(0, 0, 0);font-size: 15px;';
    document.body.appendChild(m);
    toastTimer = setTimeout(function () {
      var d = 0.3;
      m.style.transition =
        '-webkit-transform' + d + 's ease-in, opacity ' + d + 's ease-in' ||
        '--ms-transform' + d + 's ease-in, opacity ' + d + 's ease-in' ||
        '--moz-transform' + d + 's ease-in, opacity ' + d + 's ease-in';
      m.style.opacity = '0';
      setTimeout(function () {
        document.body.removeChild(m);
      }, d * 1000);
    }, duration);
  }
  // 环境判断，加载不同支付选项
  function payEnvHandle() {
    $('#fullScreenCashier').show();
    $('#alipayItem').show();
    $('#wxpayItem').show();
    $('#quickPayItem').show();
    $('#alipayInput').prop('checked', true);
    // 页面加载完，隐藏页面loading
    $('#pageLoadingMask').hide();
  }

  // 点击支付时，支付逻辑判断
  function payType() {
    beginTime = new Date().getTime();
    payHandle();
  }
  /**
   * @description: 上传埋点
   * @param {*} orderId 订单id
   * @param {*} pollDiffTime 轮询时间
   * @param {*} wsDiffTime ws时间
   * @param {*} diffTime  pollDiffTime-wsDiffTime时间差
   * @return {*}
   */
  function diffTimeMonitor(orderId, pollDiffTime, wsDiffTime, diffTime) {
    HuifuMonitor.track(
      '0090_00008128',
      {
        orderId,
        pollDiffTime,
        wsDiffTime,
        diffTime,
        tradeType,
      },
      true
    );
  }

  /**
   * @Description: 支付处理
   * @return {*}
   */
  function payHandle() {
    try {
      // 快捷支付
      if (currentChosePayTypeIndex === 2) {
        $('#quickPayModel').show();
      } else {
        // 3:微信小程序，2:支付宝小程序
        var preOrderType = currentChosePayTypeIndex === 1 ? '3' : '2';
        var goodsDesc =
          currentChosePayTypeIndex === 1 ? '微信测试商品-无线鼠标' : '支付宝测试商品-无线鼠标';
        var params = {
          huifu_id: isProdEnv ? configObj.prod.huifuId : configObj.test.huifuId,
          pre_order_type: preOrderType,
          req_date: dayjs().format('YYYYMMDD'),
          req_seq_id: mer_ord_id,
          trans_amt: amount,
          goods_desc: goodsDesc,
          delay_acct_flag: 'N',
        };
        // 支付宝
        if (currentChosePayTypeIndex === 0) {
          params.app_data = { app_schema: 'oppshosting://' };
        } else if (currentChosePayTypeIndex === 1) {
          // 微信
          params.miniapp_data = {};
          // params.miniapp_data = { seq_id: '' };
        }
        $('#loadingMask').show();
        var serviceUrl = configObj.prodMiniBaseURL
        axios
          .post(serviceUrl + configObj.miniOrderAPI, { data: params })
          .then((res) => {
            var data = res.data && res.data.data;
            console.log('-- ~ data:', data);
            $('#loadingMask').hide();
            if (data && data.resp_code === '00000000') {
              if (currentChosePayTypeIndex === 0) {
                jumpURL = data.jump_url;
              } else if (currentChosePayTypeIndex === 1) {
                const miniappData = JSON.parse(data.miniapp_data);
                jumpURL = miniappData.scheme_code;
              }
              // 订单状态查询
              const { huifu_id, req_seq_id, req_date } = data;
              if (!timer) {
                timer = setInterval(() => {
                  queryOrder({ serviceUrl, huifu_id, req_seq_id, req_date });
                }, 2000);
              }
              window.location.href = jumpURL;
            } else {
              alert(data.resp_desc);
            }
          })
          .catch(() => {
            $('#loadingMask').hide();
          });
      }
    } catch (error) {
      console.log('-- ~ error:', error);
    }
  }
  // 查询订单详情
  function queryOrder({ serviceUrl, req_seq_id, req_date, huifu_id }) {
    var params = {
      huifu_id,
      req_seq_id,
      req_date,
      trans_type: 'TO',
    };
    axios
      .post(serviceUrl + configObj.miniQueryOrderAPI, params)
      .then((res) => {
        const { trans_stat, trans_time, create_date, bank_message, resp_desc, resp_code } =
          res.data;
        $('#loadingMask').show();
        $('.loadingTxt').text('交易结果查询中...');
        timeCount--;
        console.log('-- ~ timeCount:', timeCount);
        if (resp_code === '00000000') {
          $('.loadingTxt').text('处理中，请耐心等待');
          if (trans_stat === 'S') {
            pollDiffTime = new Date().getTime() - beginTime;
            // 支付成功
            timer && clearInterval(timer);
            diffTimeMonitor(req_seq_id, pollDiffTime, wsDiffTime, pollDiffTime - wsDiffTime);
            localStorage.setItem('end_time', trans_time || create_date);
            $('#loadingMask').hide();
            paySuccess();
          } else {
            if (trans_stat === 'F') {
              alert(bank_message || resp_desc);
              setTimeout(() => {
                pollDiffTime = new Date().getTime() - beginTime;
                // 支付失败
                clearInterval(timer);
                diffTimeMonitor(req_seq_id, pollDiffTime, wsDiffTime, pollDiffTime - wsDiffTime);
                $('#loadingMask').hide();
                payFail();
              }, 2000);
            }
          }
        } else {
          if (resp_code !== '99010003') {
            alert(bank_message || resp_desc);
            clearInterval(timer);
            $('#loadingMask').hide();
            $('.loadingTxt').text('处理中，请耐心等待');
            payFail();
          } else {
            if (timeCount <= 0) {
              clearInterval(timer);
              $('#loadingMask').hide();
              $('.loadingTxt').text('处理中，请耐心等待');
              payFail();
            }
          }
        }
      })
      .catch((error) => {});
  }

  // 拉起微信支付
  function onBridgeReady(pay_info, callback, hf_seq_id) {
    if (typeof WeixinJSBridge !== 'undefined') {
      WeixinJSBridge.invoke(
        'getBrandWCPayRequest',
        {
          'appId': pay_info.appId, //appid
          'timeStamp': pay_info.timeStamp, //时间戳，自1970年以来的秒数
          'nonceStr': pay_info.nonceStr, //随机串
          'package': pay_info.package,
          'signType': pay_info.signType, //微信签名方式：
          'paySign': pay_info.paySign, //微信签名
        },
        function (res) {
          if (res.err_msg == 'get_brand_wcpay_request:ok') {
            // 使用以上方式判断前端返回,微信团队郑重提示：
            //res.err_msg将在用户支付成功后返回ok，但并不保证它绝对可靠。
            $('#loadingMask').hide();
            $('#cancelPay').hide();

            callback(hf_seq_id);
          } else if (res.err_msg == 'get_brand_wcpay_request:cancel') {
            $('#loadingMask').hide();
            // 弹出继续支付的框
            $('#cancelPay').show();
          } else {
            $('#loadingMask').hide();
            $('#cancelPay').hide();

            callback(hf_seq_id);
          }
        }
      );
    }
  }

  // 支付成功
  function paySuccess() {
    var payType = currentChosePayTypeIndex === 0 ? '支付宝支付' : '微信支付';
    location.href = jumpLink(
      'paySuccess.html?type=3&price=' + amount + '&payType=' + currentChosePayTypeIndex
    );
  }
  // 支付失败
  function payFail() {
    location.href = jumpLink('payFail.html?type=3&price=' + amount);
  }

  // 倒计时
  function startCountDown() {
    let count = 0;
    const startTime = Date.now();
    const fixed = () => {
      count++;
      effectTime -= 1;
      if (effectTime < 0) return;
      const offset = Date.now() - (startTime + count * 1000);
      let nextTime = 1000 - offset;
      if (nextTime < 0) nextTime = 0;
      formatSeconds(effectTime);
      timeoutRemind(effectTime);
      setTimeout(fixed, nextTime);
    };
    setTimeout(fixed, 1000);
  }

  // 格式化时间
  function formatSeconds(seconds) {
    if (seconds < 0) return;
    pay_minute = String((seconds / 60) % 60 | 0).padStart(2, '0');
    pay_second = String(seconds % 60 | 0).padStart(2, '0');
    document.getElementById('pay_minute').innerText = pay_minute;
    document.getElementById('pay_second').innerText = pay_second;
  }

  // 超时提醒
  function timeoutRemind(seconds) {
    if (seconds <= 0) {
      $('#cancelPay').hide();
      $('#loadingMask').hide();
      document.getElementById('timeoutRemind').classList.remove('hide');
    }
  }

  // 重新下单
  function reOrder() {
    $('#timeoutRemind').hide();
    const toUrl = jumpLink('goodsDetail.html') + '?type=3';
    if (history.replaceState) {
      history.replaceState(null, document.title, toUrl);
      history.go(0);
    } else {
      location.replace(toUrl);
    }
  }

  // 跳转链接
  function jumpLink(urlName) {
    const origin = location.origin;
    const pathname = location.pathname;
    const urlAry = pathname.split('/');
    urlAry.pop();
    urlAry.push(urlName);
    const urlStr = urlAry.join('/');
    const link = origin + urlStr;
    return link;
  }

  /**
   * @description: 快捷支付弹窗取消
   * @return {*}
   */
  $('#quickPayModelCancel').click(function () {
    $('#quickPayModel').hide();
  });
  /**
   * @description: 手机网页支付弹窗取消
   * @return {*}
   */
  $('#wapPayModelCancel').click(function () {
    $('#wapPayModel').hide();
  });

  /**
   * @description: 快捷绑卡跳转渲染服务端返回html
   */
  $('#quickBandCardBtn').click(function () {
    quickPageAndBankReq({
      tradeType: 'QUICK_PAGE',
    });
  });
  /**
   * @description: 快捷支付
   */
  $('#quickPayBtn').click(function () {
    let phone_no = $('#quickPayInput').val();
    quickPageAndBankReq({
      tradeType: 'QUICK_PAGE',
      phone_no: phone_no,
    });
  });

  /**
   * @description: 手机网页支付按钮点击
   */
  $('#wapPayBtn').click(function () {
    let bank_card_no = $('#wapPayInput').val();
    if (!bank_card_no) {
      return;
    }
    quickPageAndBankReq({
      tradeType: 'WAP_PAY',
      bank_card_no: bank_card_no,
    });
  });

  /**
   * @description: 快捷支付跳转渲染服务端返回html
   */
  function JumpPay(pay_info) {
    console.log('%c [ pay_info ]-831', 'font-size:13px; background:pink; color:#bf2c9f;', pay_info);
    localStorage.setItem('QUICK_PAGE_PAY_INFO', pay_info);
    const origin = location.origin;
    const pathname = location.pathname;
    const urlAry = pathname.split('/');

    urlAry.splice(urlAry.length - 2, 2);
    const urlStr = urlAry.join('/');
    const toUrl = origin + urlStr + '/common/jumpPay.html';

    window.location.href = toUrl;
  }

  /**
   * @description: 快捷支付，网银支付创建订单
   * @param {*} phone_no 快捷支付时候需要
   * @param {*} bank_card_no 网页支付时候需要
   * @return {*}
   */
  function quickPageAndBankReq({ tradeType, phone_no, bank_card_no }) {
    $('#quickPayModel').hide();
    try {
      let baseURL = '';
      if (location.host.indexOf(configObj.productionEnvHost) > -1) {
        baseURL = configObj.prodBaseURL;
      } else {
        baseURL = configObj.testBaseURL; // 'http://172.31.21.81:30043';
      }
      var paymentcreateData = {
        amount,
        trade_type: tradeType,
        extra_info: {
          // 随机生成三位随机数
          mer_ord_id: mer_ord_id,
          notify_url: 'https://iotpush.cloudpnr.com/ws-mgnt-ser/callback/jspay',
          front_url: baseURL + configObj.redirectH5,
          request_type: 'M', // 手机网页支付 快捷支付 传该字段
          // front_url: jumpLink('goodsDetail.html')
        },
        user_id: '',
      };

      if (tradeType == 'QUICK_PAGE') {
        // 快捷支付
        paymentcreateData['goods_desc'] = '快捷支付-无线鼠标';
        if (phone_no) {
          paymentcreateData['phone_no'] = phone_no;
        }
      }
      if (tradeType == 'WAP_PAY') {
        // 网银支付
        paymentcreateData['extra_info']['bank_card_no'] = bank_card_no;
        paymentcreateData['goods_desc'] = '手机网页支付-无线鼠标';
      }
      $('#loadingMask').show();
      service
        .post(configObj.createPayURL, paymentcreateData)
        .then((res) => {
          $('#loadingMask').hide();

          const { pay_info } = res;
          if (res && res.resp_code === '000000') {
            if (tradeType === 'QUICK_PAGE') {
              window.location.href = pay_info;
              return;
            }
            pay_info && JumpPay(pay_info);
            continueQuickAndWAPpay = pay_info;
          }
        })
        .catch(() => {
          $('#loadingMask').hide();
        });
    } catch (error) {}
  }
});
