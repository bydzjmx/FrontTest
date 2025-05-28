/* eslint-disable */
// h5调试
var hostName = location.host;
if (!(hostName.indexOf(configObj.productionEnvHost) > -1)) {
  if (configObj.isDebug) {
    new window.VConsole();
  }
}
$(document).ready(function () {
  // 解决移动端300ms延迟
  FastClick.attach(document.body);

  // 微信openID
  var openid = '',
    // 微信授权码
    code = '',
    // 订单页面设置的金额
    amount = GetQueryString('price'),
    // 微信SDK的URL
    wxPaySDKURL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js',
    // 支付宝SDK的URL
    aliPaySDKURL =
      'https://gw.alipayobjects.com/as/g/h5-lib/alipayjsapi/3.1.1/alipayjsapi.inc.min.js',
    // 订单号
    mer_ord_id =
      localStorage.getItem('mer_ord_id') ||
      dayjs().format('YYYYMMDDHHmmssSSS') + '' + randomNum(100, 999),
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
    pageShowType = 'fullScreen'; // GetQueryString('pageShowType');
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
  // 环境判断，加载不同支付选项
  function payEnvHandle() {
    if (isInWeiXinApp) {
      loadPaySDK(wxPaySDKURL);
      $('#pay-button').addClass('cashierPayBtnDisabled');
      // 收银页面展示类型
      if (pageShowType === 'fullScreen') {
        $('#fullScreenCashier').show();
        $('#wxpayItem').show();
        $('#wxpayInput').attr('checked', true);
      } else {
        $('#halfScreenCashier').show();
        $('#orderPage').show();
        $('#priceOrder').text(amount);
        $('#countOrder').text(amount * 100);
        $('#wxpayItem1').show();
        $('#wxpayInput1').attr('checked', true);
      }
      code = GetQueryString('code');
      if (!code) {
        // url重定向带上当前金额
        // 微信code获取
        weixinAuth();
      } else {
        try {
          var paymentCreateData = {
            auth_code: code,
            client_type: '1',
          };
          // 获取openid
          if (!localStorage.getItem('open_id')) {
            service
              .post('wxauth', paymentCreateData)
              .then((data) => {
                const { open_id, resp_code } = data;
                if (data && resp_code == '000000' && open_id) {
                  $('#pageLoadingMask').hide();
                  $('#pay-button').removeClass('cashierPayBtnDisabled');
                  localStorage.setItem('open_id', open_id);
                }
              })
              .catch((error) => {
                alert(data);
              });
          } else {
            $('#pay-button').removeClass('cashierPayBtnDisabled');
            $('#pageLoadingMask').hide();
          }
        } catch (error) {}
      }
    } else if (isInUnionApp) {
      $('#pay-button').addClass('cashierPayBtnDisabled');
      if (pageShowType === 'fullScreen') {
        $('#fullScreenCashier').show();
        $('#quickpasspayItem').show();
        $('#quickpasspayInput').attr('checked', true);
      } else {
        $('#halfScreenCashier').show();
        $('#orderPage').show();
        $('#priceOrder').text(amount);
        $('#countOrder').text(amount * 100);
        $('#quickpasspayItem1').show();
        $('#quickpasspayInput1').attr('checked', true);
      }
      respCode = GetQueryString('respCode');
      userAuthCode = GetQueryString('userAuthCode');
      if (!respCode || respCode.length === 0) {
        unionPayReady();
      } else {
        getUnionUserId(userAuthCode);
      }
      // 页面加载完，隐藏页面loading
      $('#pageLoadingMask').hide();
    } else {
      loadPaySDK(aliPaySDKURL);
      if (pageShowType === 'fullScreen') {
        $('#fullScreenCashier').show();
        $('#alipayItem').show();
        $('#alipayInput').attr('checked', true);
      } else {
        $('#halfScreenCashier').show();
        $('#orderPage').show();
        $('#priceOrder').text(amount);
        $('#countOrder').text(amount * 100);
        $('#alipayItem1').show();
        $('#alipayInput1').attr('checked', true);
      }
      // 页面加载完，隐藏页面loading
      $('#pageLoadingMask').hide();
    }
  }

  // 点击支付时，支付逻辑判断
  function payType() {
    if (isInWeiXinApp) {
      wxPay();
    } else if (isInUnionApp) {
      $('#loadingMask').show();
      // 银联，需要传递用户IP
      axios
        .get('https://api.ipify.org/?format=json')
        .then((res) => {
          const { data: ipInfo } = res;
          client_ip = ipInfo.ip;
          unionPay();
        })
        .catch(() => {
          client_ip = '172.31.19.51';
          unionPay();
        });
    } else {
      aliPay();
    }
  }

  // 支付方式-支付宝
  function aliPay() {
    try {
      var paymentCreateData = {
        amount: amount,
        trade_type: 'A_NATIVE',
        goods_desc: '茶歇费',
        extra_info: {
          mer_ord_id,
          notify_url:'https://iotpush.cloudpnr.com/ws-mgnt-ser/callback/jspay',
        },
        user_id: '',
      };
      $('#loadingMask').show();
      service
        .post(configObj.createPayURL, paymentCreateData)
        .then((res) => {
          const { json_data, pay_info } = res;
          if (res && res.resp_code === '000000') {
            if (pay_info && json_data.hf_seq_id) {
              hf_seq_id = json_data.hf_seq_id;
              timer = setInterval(function () {
                queryOrder(hf_seq_id);
              }, 5000);
              window.location.href =
                'alipays://platformapi/startapp?saId=10000007&qrcode=' + pay_info;
            } else {
              alert(json_data.resp_desc);
            }
          } else {
            $('#loadingMask').hide();
          }
        })
        .catch((error) => {
          $('#loadingMask').hide();
        });
    } catch (error) {}
  }
  // 支付方式-微信
  function wxPay() {
    try {
      // 生成订单
      // 当前页面取消支付，重新生成订单号
      mer_ord_id = dayjs().format('YYYYMMDDHHmmssSSS') + '' + randomNum(100, 999);
      localStorage.setItem('mer_ord_id', mer_ord_id);
      var paymentCreateData = {
        amount: amount,
        trade_type: 'T_JSAPI',
        goods_desc: '茶歇费',
        extra_info: {
          mer_ord_id,
          notify_url:'https://iotpush.cloudpnr.com/ws-mgnt-ser/callback/jspay',
        },
        user_id: localStorage.getItem('open_id'),
      };
      $('#loadingMask').show();
      service
        .post(configObj.createPayURL, paymentCreateData)
        .then((res) => {
          const { json_data } = res;
          if (json_data && json_data.pay_info && json_data.hf_seq_id) {
            hf_seq_id = json_data.hf_seq_id;
            let pay_info = JSON.parse(json_data.pay_info);
            // JSAPI调起支付
            if (typeof WeixinJSBridge == 'undefined') {
              $('#loadingMask').hide();
              if (document.addEventListener) {
                document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
              } else if (document.attachEvent) {
                document.attachEvent('WeixinJSBridgeReady', onBridgeReady);
                document.attachEvent('onWeixinJSBridgeReady', onBridgeReady);
              }
            } else {
              $('#loadingMask').hide();
              onBridgeReady(pay_info, queryOrder, hf_seq_id);
            }
          }
        })
        .catch((error) => {
          $('#loadingMask').hide();
        });
    } catch (error) {
      $('#loadingMask').hide();
    }
  }
  // 支付方式-银联
  function unionPay() {
    var paymentCreateData = {
      amount: amount,
      trade_type: 'U_JSAPI',
      goods_desc: '茶歇费',
      extra_info: {
        mer_ord_id,
        user_id: union_user_id,
        notify_url:'https://iotpush.cloudpnr.com/ws-mgnt-ser/callback/jspay',
      },
      user_id: union_user_id,
      client_ip,
    };
    $('#loadingMask').show();
    service
      .post(configObj.createPayURL, paymentCreateData)
      .then((res) => {
        if (res && res.resp_code === '000000') {
          $('#loadingMask').hide();
          const { pay_info } = res;
          if (pay_info) {
            window.location.href = pay_info;
          }
        } else {
          $('#loadingMask').hide();
        }
      })
      .catch((error) => {
        $('#loadingMask').hide();
      });
  }
  // 银联环境跳转
  function unionPayReady() {
    userAuthCode = GetQueryString('userAuthCode');
    let urlNow = encodeURIComponent(window.location.href);
    let url = 'https://qr.95516.com/qrcGtwWeb-web/api/userAuth?version=1.0.0&redirectUrl=' + urlNow;
    window.location = url;
  }
  // 获取银联用户ID
  function getUnionUserId(userAuthCode) {
    var params = {
      auth_code: decodeURIComponent(userAuthCode),
    };
    service
      .post('unionpayauth', params)
      .then((res) => {
        const { jsonData, resp_code, json_data } = res;
        if (resp_code == '000000') {
          $('#pay-button').removeClass('cashierPayBtnDisabled');
          if (jsonData && jsonData.user_id) {
            union_user_id = jsonData.user_id;
          } else if (json_data && json_data.user_id) {
            union_user_id = json_data.user_id;
          }
          // 银联返回的userid 可能存在空格，需要将空格替换成加号
          union_user_id = union_user_id.replace(/\s+/g, '+');
        } else {
          // alert(jsonData.return_desc);
        }
      })
      .catch((error) => {
        // alert(JSON.stringify(error));
      });
  }

  // 拉起微信支付
  function onBridgeReady(pay_info, callback, hf_seq_id) {
    $('#loadingMask').show();
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
            callback(hf_seq_id);
          } else if (res.err_msg == 'get_brand_wcpay_request:cancel') {
            $('#loadingMask').hide();
            $('#cancelPay').show();
            $('#continuePay').click(function () {
              $('#cancelPay').hide();
            });
          } else {
            callback(hf_seq_id);
          }
        }
      );
    }
  }
  // 加载支付SDK
  function loadPaySDK(url) {
    return new Promise((resolve, reject) => {
      let script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = url;
      script.onload = () => {
        resolve(true);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // 支付成功
  function paySuccess() {
    location.href = jumpLink('billPaySuccess.html?price=' + amount);
  }
  // 支付失败
  function payFail() {
    location.href = jumpLink('billPayFail.html?price=' + amount);
  }
  // 查询订单详情
  function queryOrder(hf_seq_id) {
    var queryOrderData = {
      hf_seq_id,
    };
    service
      .post(configObj.queryPayURL, queryOrderData)
      .then((res) => {
        const { json_data, resp_code } = res;
        if (json_data && (resp_code === '000000' || resp_code === '00000000')) {
          if (json_data.trans_stat == 'S') {
            // 支付成功
            clearInterval(timer);
            // 支付成功时间
            localStorage.setItem('end_time', json_data.end_time);
            $('#loadingMask').hide();
            paySuccess();
          } else if (json_data.trans_stat == 'F') {
            // 支付失败
            clearInterval(timer);
            $('#loadingMask').hide();
            payFail();
          }
        }
        // else {
        //   $('#loadingMask').hide();
        //   clearInterval(timer);
        // }
      })
      .catch((error) => {});
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
      document.getElementById('timeoutRemind').classList.remove('hide');
    }
  }

  // 重新下单
  function reOrder() {
    $('#timeoutRemind').hide();
    const toUrl = jumpLink('billDetail.html');
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
});
