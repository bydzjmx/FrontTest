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
  // 商品类型 2为京东白条支付，其他默认
  goodsType = GetQueryString('goodsType');
  // 是否为京东白条分期判断
  isJdbt = goodsType === '2';
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
  amount = decodeURIComponent(GetQueryString('price'));
  // 京东白条分期支付金额处理
  if (isJdbt) {
    jdbtPaySelect();
  } else {
    // 其他情况
    $('#cashier_priceNumber').text(amount);
    $('#pay_amount').text(amount);
    $('#cashier_priceNumber1').text(amount);
    $('#pay_amount1').text(amount);
  }

  // initWebsocket();

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
    continueJdbtPay, // 京东白条H5继续支付的payinfo
    // websocket connection
    ws,
    wsMsg,
    beginTime, // 进页面创建订单时间
    pollDiffTime, // 轮询时间差
    wsDiffTime, // websocket收到消息的时间差
    // 京东白条分期数
    installmentNum = 3;

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
    if (tradeType === 'A_NATIVE') {
      // 支付宝
      window.location.href = continueAlipay;
    } else if (tradeType === 'QUICK_PAGE') {
      // 支付宝
      window.location.href = continueQuickAndWAPpay;
    } else if (tradeType === 'WAP_PAY') {
      // 快捷和网页支付
      JumpPay(continueQuickAndWAPpay);
    } else if (tradeType === 'T_JSAPI') {
      onBridgeReady(continueWxpay, queryOrder, hf_seq_id);
    } else if (tradeType === 'U_JSAPI') {
      window.location.href = continueUnionpay;
    } else if (tradeType === 'JDBT') {
      window.location.href = continueJdbtPay;
    }
  });

  // 切换支付类型
  var list = document.getElementsByTagName('li');
  for (let i = 0; i < list.length; i++) {
    list[i].onclick = function (e) {
      var parentLi = $(e.target).closest('li');
      var targetId = parentLi.length > 0 ? parentLi[0].id : e.target.id;
      $(`#${list[i].id} input`).prop('checked', false);
      $(`#${targetId} input`).prop('checked', true);
      tradeType = $(`#${e.target.id}`).attr('data-type');
      // 产品要求分期金额写死
      if (tradeType === 'FQ_ALIPAY') {
        amount = '100.00';
      } else if (tradeType === 'FQ_BANK') {
        amount = '600.00';
      } else {
        amount = decodeURIComponent(GetQueryString('price'));
      }
      // 非京东白条支付时处理
      if (!isJdbt) {
        $('#cashier_priceNumber').text(amount);
        $('#pay_amount').text(amount);
        $('#cashier_priceNumber1').text(amount);
        $('#pay_amount1').text(amount);
      }
    };
  }

  // 上传标识
  function uploadPayInfo() {
    var params = {
      product_id: configObj.productId,
      sys_id: isProdEnv ? configObj.prod.sysId : configObj.test.sysId,
      data: {
        huifu_id: isProdEnv ? configObj.prod.huifuId : configObj.test.huifuId,
        resource: 'H5',
        id_code: 'co',
        action: 'CALL',
        ref_req_date: dayjs().format('YYYYMMDD'), //YYYYMMDD
        ref_req_seqid: mer_ord_id, //orderID
      },
    };
    var baseURL = '';
    if (isProdEnv) {
      baseURL = configObj.prodUploadPayAPI;
    } else {
      baseURL = configObj.testUploadPayAPI; // 'http://172.31.21.81:30043';
    }
    axios.post(baseURL, params);
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
    $('#quickPayItem').show();
    $('#wapPayItem').show();
    if (isInWeiXinApp && !isJdbt) {
      loadPaySDK(wxPaySDKURL);
      // 收银页面展示类型
      if (pageShowType === 'fullScreen') {
        $('#fullScreenCashier').show();
        $('#wxpayItem').show();
        if (source == 'wx_pc') {
          $('#quickPayItem').hide();
          $('#wapPayItem').hide();
        } else {
          // 微信PC支付过来的页面不需要显示银行卡支付
          $('#bankPayItem').show();
        }
        $('#wxpayInput').attr('checked', true);
      } else {
        $('#halfScreenCashier').show();
        $('#orderPage').show();
        $('#priceOrder').text(amount);
        $('#countOrder').text(amount * 100);
        $('#wxpayItem1').show();
        $('#bankPayItem1').show();
        $('#wxpayInput1').attr('checked', true);
      }
      code = GetQueryString('code');
      if (!code) {
        // 微信code获取
        weixinAuth();
      } else {
        try {
          var paymentData = {
            auth_code: code,
            client_type: '1',
          };
          // 获取openid
          if (!localStorage.getItem('open_id')) {
            service
              .post(configObj.mobile.wxConfig.wxAuthURL, paymentData)
              .then((data) => {
                const { open_id, resp_code } = data;
                if (data && resp_code == '000000' && open_id) {
                  $('#pageLoadingMask').hide();
                  localStorage.setItem('open_id', open_id);
                }
              })
              .catch((error) => {
                $('#pageLoadingMask').hide();
                showToast((error && error.resp_desc) || '发生错误！');
                alert(data);
              });
          } else {
            $('#pageLoadingMask').hide();
          }
        } catch (error) {
          $('#pageLoadingMask').hide();
          showToast(JSON.stringify(error) || '发生错误！');
        }
      }
      // 页面加载完，隐藏页面loading
      $('#pageLoadingMask').hide();
    } else if (isInUnionApp && !isJdbt) {
      if (pageShowType === 'fullScreen') {
        $('#fullScreenCashier').show();
        $('#quickpasspayItem').show();
        $('#bankPayItem').show();
        $('#quickpasspayInput').prop('checked', true);
      } else {
        $('#halfScreenCashier').show();
        $('#orderPage').show();
        $('#priceOrder').text(amount);
        $('#countOrder').text(amount * 100);
        $('#quickpasspayItem1').show();
        $('#bankPayItem1').show();
        $('#quickpasspayInput1').prop('checked', true);
      }
      respCode = GetQueryString('respCode');
      userAuthCode = GetQueryString('userAuthCode');
      if (!respCode || respCode.length === 0) {
        // 银联内第一打开跳转银联的授权
        unionPayReady();
      } else {
        getUnionUserId(userAuthCode);
      }
    } else {
      loadPaySDK(aliPaySDKURL);
      if (pageShowType === 'fullScreen') {
        $('#fullScreenCashier').show();
        // 京东白条分期
        if (isJdbt) {
          $('#quickPayItem').hide();
          $('#wapPayItem').hide();
          $('#jdbtItem').show();
          $('#jdbtInput').prop('checked', true);
        } else {
          // 其他情况
          $('#alipayItem').show();
          $('#huabeipayItem').show();
          $('#bankPayItem').show();
          $('#alipayInput').prop('checked', true);
        }
      } else {
        $('#halfScreenCashier').show();
        $('#orderPage').show();
        $('#priceOrder').text(amount);
        $('#countOrder').text(amount * 100);
        $('#alipayItem1').show();
        $('#huabeipayItem1').show();
        $('#bankPayItem1').show();
        $('#alipayInput1').prop('checked', true);
      }
      // 页面加载完，隐藏页面loading
      $('#pageLoadingMask').hide();
    }
  }

  // 选择支付方式
  function choosePayment(type) {}

  // 点击支付时，支付逻辑判断
  function payType() {
    beginTime = new Date().getTime();
    // pc端微信支付不创建新链接
    if (source !== 'wx_pc') {
      // connectWebsocket(mer_ord_id);
    }
    // 快捷支付的时候弹出交互框
    if (tradeType == 'QUICK_PAGE') {
      $('#quickPayModel').show();
      return;
    }
    if (tradeType == 'WAP_PAY') {
      $('#wapPayModel').show();
      return;
    }
    // 银行卡分期 花呗分期
    if (tradeType === 'FQ_BANK' || tradeType === 'FQ_ALIPAY') {
      fenqiPay(tradeType);
      return;
    }

    // 京东白条分期
    if (isJdbt) {
      jdbtPay();
      return;
    }

    if (isInWeiXinApp) {
      wxPay();
    } else if (isInUnionApp) {
      $('#loadingMask').show();
      // 银联银联，需要传递用户IP
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

  // 初始化websocket
  function initWebsocket() {
    ws = new HFWebsocket({
      appId: '6810112250564608', // 统一推送平台申请的 appid
      huifuId: isProdEnv ? configObj.prod.huifuId : configObj.test.huifuId,
      appSecret: 'secret_ws', // 统一推送平台申请的 webSocket 服务对应的 appSecret
      channel: 'h5',
      isDev: false, // 环境，不传或 false 默认生产
    });
  }
  // 创建连接
  function connectWebsocket(mer_ord_id) {
    ws.connect(mer_ord_id);
    ws.onOpen(() => {
      console.log('********* connect success *********');
    });
    ws.onMessage((message) => {
      wsMsg = JSON.parse(message.content);
      console.log('********* 接受消息 *********', wsMsg);
      if (wsMsg.trans_stat === 'S' || wsMsg.trans_stat === 'F') {
        wsDiffTime = new Date().getTime() - beginTime;
      }
    });
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

  // 分期支付
  function fenqiPay(tradeType) {
    try {
      let goods_desc =
        tradeType === 'FQ_BANK' ? '银行卡分期测试商品-无线鼠标' : '花呗分期测试商品-无线鼠标';
      var paymentCreateData = {
        amount: amount,
        trade_type: tradeType,
        goods_desc,
        extra_info: {
          mer_ord_id,
          notify_url: 'https://iotpush.cloudpnr.com/ws-mgnt-ser/callback/jspay',
        },
        user_id: '',
      };
      $('#loadingMask').show();
      service
        .post(configObj.createPayURL, paymentCreateData)
        .then((res) => {
          if (res && res.resp_code === '000000') {
            const { json_data } = res;
            if (json_data.hf_seq_id) {
              hf_seq_id = json_data.hf_seq_id;
              let payType = tradeType === 'FQ_BANK' ? 'unionpay' : 'alipay';
              // if (isProdEnv) {
              //   var url = `https://hfenqi.cloudpnr.com/h5/qrcode/?huifuId=${configObj.prod.huifuId}&productId=${configObj.prod.productId}&reqSeqId=${json_data.req_seq_id}&payType=${payType}&transAmt=${amount}`;
              // } else {
              //   var url = `https://hfq.testpnr.com/h5/qrcode/?huifuId=${configObj.test.huifuId}&productId=${configObj.test.productId}&reqSeqId=${json_data.req_seq_id}&payType=${payType}&transAmt=${amount}`;
              // }
              var url = `https://hfenqi.cloudpnr.com/h5/qrcode/?huifuId=${configObj.prod.huifuId}&productId=${configObj.prod.productId}&reqSeqId=${json_data.req_seq_id}&payType=${payType}&transAmt=${amount}`;
              window.location.href = url;
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

  // 支付方式-支付宝
  function aliPay() {
    try {
      tradeType = 'A_NATIVE';
      var paymentCreateData = {
        amount: amount,
        trade_type: 'A_NATIVE',
        goods_desc: '支付宝测试商品-无线鼠标',
        extra_info: {
          mer_ord_id,
          notify_url: 'https://iotpush.cloudpnr.com/ws-mgnt-ser/callback/jspay',
        },
        user_id: '',
      };
      $('#loadingMask').show();
      service
        .post(configObj.createPayURL, paymentCreateData)
        .then((res) => {
          const { json_data, pay_info } = res;
          $('#loadingMask').hide();

          if (res && res.resp_code === '000000') {
            // 下单成功上传数据
            uploadPayInfo();
            if (pay_info && json_data.hf_seq_id) {
              hf_seq_id = json_data.hf_seq_id;
              timer = setInterval(function () {
                queryOrder(hf_seq_id);
              }, 5000);
              window.location.href =
                'alipays://platformapi/startapp?saId=10000007&qrcode=' + pay_info;

              continueAlipay = 'alipays://platformapi/startapp?saId=10000007&qrcode=' + pay_info;
              // 弹出继续支付的框
              $('#cancelPay').show();
            } else {
              alert(json_data.resp_desc);
            }
          } else {
            // $('#loadingMask').hide();
          }
        })
        .catch((error) => {
          $('#loadingMask').hide();
        });
    } catch (error) {}
  }
  // 支付方式-微信 todo 微信支付
  function wxPay() {
    $('#loadingMask').show();
    try {
      tradeType = 'T_JSAPI';
      // 生成订单
      var paymentCreateData = {
        price: amount,
        tradeType: 'T_JSAPI',
        goodsDesc: pass_goods_desc || '微信测试商品-无线鼠标',
        // extra_info: {
        //   mer_ord_id,
        //   notify_url: 'https://iotpush.cloudpnr.com/ws-mgnt-ser/callback/jspay',
        // },
        orderId: mer_ord_id, // 订单号
        effectTime: effectTime,
        orgReqDate: mer_ord_id.slice(0, 8),
        user_id: localStorage.getItem('open_id'),
      };
      service
        .post(configObj.createPayURL, paymentCreateData)
        .then((res) => {
          const json_data  = res;
          if (json_data && json_data.pay_info && json_data.hf_seq_id) {
            hf_seq_id = json_data.hf_seq_id;
            let pay_info = JSON.parse(json_data.pay_info);
            // JSAPI调起支付
            if (typeof WeixinJSBridge == 'undefined') {
              if (document.addEventListener) {
                document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
              } else if (document.attachEvent) {
                document.attachEvent('WeixinJSBridgeReady', onBridgeReady);
                document.attachEvent('onWeixinJSBridgeReady', onBridgeReady);
              }
            } else {
              // todo 下单成功上传数据
              // uploadPayInfo();
              continueWxpay = pay_info;
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
    tradeType = 'U_JSAPI';
    var paymentCreateData = {
      amount: amount,
      trade_type: 'U_JSAPI',
      goods_desc: '银联支付测试商品-无线鼠标',
      extra_info: {
        mer_ord_id,
        user_id: union_user_id,
        notify_url: 'https://iotpush.cloudpnr.com/ws-mgnt-ser/callback/jspay',
      },
      user_id: union_user_id,
      client_ip,
    };

    service
      .post(configObj.createPayURL, paymentCreateData)
      .then((res) => {
        if (res && res.resp_code === '000000') {
          // 下单成功上传数据
          uploadPayInfo();
          $('#loadingMask').hide();
          const { pay_info } = res;
          if (pay_info) {
            continueUnionpay = pay_info;
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

  // 支付方式-京东白条分期
  function jdbtPay() {
    tradeType = 'JDBT';
    var jdbtData = {
      goods_num: '1',
      order_source: '微信APP扫一扫',
      order_source_type: 'H5',
    };
    var paymentCreateData = {
      amount: $('#pay_amount').text(),
      trade_type: 'JDBT',
      goods_desc: '精致陶瓷大容量马克杯',
      huifu_id: isProdEnv ? configObj.prod.huifuId : configObj.test.huifuId,
      extra_info: {
        req_seq_id: mer_ord_id,
        jdbt_data: JSON.stringify(jdbtData),
        pay_scene: '01',
      },
      installment_num: installmentNum,
      client_ip,
    };

    $('#loadingMask').show();
    service
      .post(configObj.createPayURL, paymentCreateData)
      .then((res) => {
        const { resp_code } = res;
        // 成功状态处理
        if (res && (resp_code === '000000' || resp_code === '00000000')) {
          $('#loadingMask').hide();
          const {
            json_data: { pay_info, req_seq_id },
          } = res;
          continueJdbtPay = pay_info;
          // 轮询结果
          timer = setInterval(function () {
            queryOnlineOrder(req_seq_id);
          }, 5000);
          // 支付信息存在
          if (pay_info) {
            window.location.href = pay_info;
          }
        } else {
          // 其他情况
          $('#loadingMask').hide();
        }
      })
      .catch((error) => {
        $('#loadingMask').hide();
      });
  }

  // 京东白条支付选择处理
  function jdbtPaySelect() {
    const totalPrice = Number(amount).toFixed(2);
    // 京东分期支付信息对象
    const jdCreditPayInfo = {
      0: {
        periodAmount: '',
        charge: '',
        payPrice: '',
        period: 3,
        userFee: 2.4,
      },
      1: {
        periodAmount: '',
        charge: '',
        payPrice: '',
        period: 6,
        userFee: 4.5,
      },
      2: {
        periodAmount: '',
        charge: '',
        payPrice: '',
        period: 12,
        userFee: 7.5,
      },
    };

    showAllJdCreditPayInfo();

    // 京东分期选择事件
    $('.checkout-payinfo-item').on('click', function () {
      const index = $(this).index();
      installmentNum = jdCreditPayInfo[index].period;
      $('#cashier_priceNumber').text(jdCreditPayInfo[index].payPrice);
      $('#pay_amount').text(jdCreditPayInfo[index].payPrice);
      $('.checkout-payinfo-item').removeClass('checkout-payinfo-item-active');
      $('.selected-arrow-icon').removeClass('selected-arrow-icon-active');
      $(this)
        .addClass('checkout-payinfo-item-active')
        .find('.selected-arrow-icon')
        .addClass('selected-arrow-icon-active');
    });

    // 渲染所有京东分期支付计算后的费用
    function showAllJdCreditPayInfo() {
      $('.checkout-payinfo-item').map(function (index, item) {
        const period = jdCreditPayInfo[index].period;
        const userFee = jdCreditPayInfo[index].userFee;
        const charge = Number(((totalPrice * userFee) / 100 / period).toFixed(2));
        const periodAmount = Number((totalPrice / period + charge).toFixed(2));
        const payPrice = Number(
          ((totalPrice * 100 + charge * 100 * period) / 100).toFixed(2)
        ).toFixed(2);
        jdCreditPayInfo[index].periodAmount = periodAmount;
        jdCreditPayInfo[index].charge = charge;
        jdCreditPayInfo[index].payPrice = payPrice;

        // 设置默认支付金额和选中
        if (index === 0) {
          $('#cashier_priceNumber').text(payPrice);
          $('#pay_amount').text(payPrice);
        }

        $(item).find('.periodAmount').text(periodAmount);
        $(item).find('.charge').text(charge);
      });
    }
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
          // 隐藏page loading
          $('#pageLoadingMask').hide();
          if (jsonData && jsonData.user_id) {
            union_user_id = jsonData.user_id;
          } else if (json_data && json_data.user_id) {
            union_user_id = json_data.user_id;
          }
          // 银联返回的userid 可能存在空格，需要将空格替换成加号
          union_user_id = union_user_id.replace(/\s+/g, '+');
        } else {
          // 隐藏page loading
          $('#pageLoadingMask').hide();
          // alert(jsonData.return_desc);
        }
      })
      .catch((error) => {
        // 隐藏page loading
        $('#pageLoadingMask').hide();
        // alert(JSON.stringify(error));
      });
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
    var skipUrl = 'paySuccess.html?price=' + amount;
    // 京东白条分期处理
    if (tradeType === 'JDBT') {
      skipUrl += '&tradeType=' + tradeType;
    }
    location.href = jumpLink(skipUrl);
  }
  // 支付失败
  function payFail() {
    location.href = jumpLink('payFail.html?price=' + amount);
  }
  // 查询订单详情
  function queryOrder(hf_seq_id) {
    var queryOrderData;
    if (tradeType === 'FQ_ALIPAY' || tradeType === 'JDBT') {
      queryOrderData = {
        org_hf_seq_id: hf_seq_id,
      };
    } else {
      queryOrderData = {
        org_hf_seq_id: hf_seq_id,
        org_req_date: mer_ord_id.slice(0, 8),
      };
    }
    service
      .post(configObj.queryPayURL, queryOrderData)
      .then((res) => {
        const { json_data, resp_code } = res;
        if (json_data && (resp_code === '000000' || resp_code === '00000000')) {
          if (json_data.trans_stat == 'S') {
            pollDiffTime = new Date().getTime() - beginTime;
            // 支付成功
            clearInterval(timer);
            diffTimeMonitor(mer_ord_id, pollDiffTime, wsDiffTime, pollDiffTime - wsDiffTime);
            localStorage.setItem('end_time', json_data.end_time);
            localStorage.setItem('tradeType', tradeType);
            $('#loadingMask').hide();
            paySuccess();
          } else if (json_data.trans_stat == 'F') {
            pollDiffTime = new Date().getTime() - beginTime;
            // 支付失败
            clearInterval(timer);
            diffTimeMonitor(mer_ord_id, pollDiffTime, wsDiffTime, pollDiffTime - wsDiffTime);
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

  // 查询 online 订单详情 针对分期支付订单
  function queryOnlineOrder(hf_seq_id) {
    var queryOrderData = {
      org_req_seq_id: hf_seq_id,
    };
    service
      .post(configObj.onlineQueryPayURL, queryOrderData)
      .then((res) => {
        const { json_data, resp_code } = res;
        if (json_data && (resp_code === '000000' || resp_code === '00000000')) {
          if (json_data.trans_stat == 'S') {
            // 支付成功
            clearInterval(timer);
            // 支付成功时间
            localStorage.setItem('end_time', json_data.org_req_date);
            $('#loadingMask').hide();
            paySuccess();
          } else if (json_data.trans_stat == 'F') {
            // 支付失败
            clearInterval(timer);
            $('#loadingMask').hide();
            payFail();
          }
        }
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
      $('#cancelPay').hide();
      $('#loadingMask').hide();
      document.getElementById('timeoutRemind').classList.remove('hide');
    }
  }

  // 重新下单
  function reOrder() {
    $('#timeoutRemind').hide();
    const toUrl = jumpLink('goodsDetail.html');
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
    $('#wapPayModel').hide();
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
        .catch((error) => {
          $('#loadingMask').hide();
        });
    } catch (error) {}
  }
});
