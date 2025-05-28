// 支付类型
var payList = {
    datarmbpay: '数字人民币',
    alipay: '支付宝',
    huabeipay: '支付宝',
    quickpasspay: '银联支付',
    unionpay: '银联支付',
    bankpay: '微信、支付宝、银联支付',
    wxpay: '微信',
    jdbt: '微信',
  },
  // 订单金额
  amount = '',
  // 商品描述
  goods_desc = '测试商品',
  // 轮训支付状态定时标识
  payInterval,
  // 流水号
  hf_seq_id,
  // 订单号
  mer_ord_id = dayjs().format('YYYYMMDDHHmmssSSS') + '' + randomNum(100, 999),
  // 倒计时总时长
  effectTime = configObj.pc.payTime * 60,
  // 全局订单倒计时
  orderTimer = null,
  // 倒计时分钟
  pay_minute = '05',
  // 倒计时秒
  pay_second = '00',
  // 支付类型
  transType = {
    'alipay': 'A_NATIVE',
    'unionpay': 'U_NATIVE',
    'quickpasspay': 'U_NATIVE',
    'datarmbpay': 'D_NATIVE',
    'huabeipay': 'FQ_ALIPAY',
    'bankpay': 'FQ_BANK',
    'wxpay': 'WX_H5_PAY', // 微信支付类型不是用来下单，只用来区分别的各种类型
    'quickPay': 'QUICK_PAGE',
    'netBankpay': 'BANK_PAY',
    'jdbt': 'JDBT',
  },
  // 接入指引文字显示名称
  productDesc = {
    'alipay': '支付宝扫码接入指引',
    'quickpasspay': '银联支付扫码接入指引',
    'datarmbpay': '数字人民币扫码接入指引',
    'huabeipay': '汇分期接入指引',
    'bankpay': '汇分期接入指引',
    'wxpay': '微信扫码接入指引', // 微信支付类型不是用来下单，只用来区分别的各种类型
    'quickPay': '快捷支付接入指引',
    'netBankpay': '网银支付接入指引',
    'jdbt': '京东白条接入指引',
  },
  // 当前选中支付方式
  activePay,
  isProdEnv,
  // websocket connection
  ws,
  wsMsg,
  beginTime, // 进页面创建订单时间
  pollDiffTime, // 轮询时间差
  wsDiffTime, // websocket收到消息的时间差
  // 订单状态管理
  isOrderCreated = false, // 订单是否已创建
  isCountdownStarted = false, // 倒计时是否已启动
  qrCodeCache = {}, // 二维码缓存
  orderCache = {}; // 订单缓存

$(document).ready(function () {
  isProdEnv = location.host.indexOf(configObj.productionEnvHost) > -1 ? true : false;
  amount = GetQueryString('price');
  goods_desc = GetQueryString('goods_desc');
  // order_code = GetQueryString('order_code'); // 订单编号
  // new_time = GetQueryString('new_time'); // 下单时间
  // over_time = GetQueryString('over_time'); // 超时时间

  // mer_ord_id = order_code;
  sessionStorage.setItem('pc_mer_ord_id', mer_ord_id);
  // 尝试从sessionStorage恢复订单编号，如果没有则生成新的
  let savedOrderId = sessionStorage.getItem('pc_mer_ord_id');
  if (savedOrderId) {
    mer_ord_id = savedOrderId;
  } else {
    mer_ord_id = dayjs().format('YYYYMMDDHHmmssSSS') + '' + randomNum(100, 999);
    sessionStorage.setItem('pc_mer_ord_id', mer_ord_id);
  }
  
  $('#orderNumber').text(mer_ord_id);
  // initWebsocket();
  activePay = document.getElementsByClassName('activePayItem')[0].getAttribute('data-type');
  // $('#productDescBtn').text(productDesc[activePay]);
  $('#payName').text('使用' + payList[activePay] + 'App扫码完成支付');
  
  // 初始化订单和倒计时
  initializePayment(activePay);

  // todo 打开定时查询
  queryOrderStatus(activePay);
});

// 初始化支付方式
function initializePayment(payType) {
  // 启动倒计时（只启动一次）
  if (!isCountdownStarted) {
    if (payType === 'wxpay') {
      $('#payTimeRemaining').addClass('payTimeRemainningHidden');
    } else {
      $('#payTimeRemaining').removeClass('payTimeRemainningHidden');
      startCountDown();
      isCountdownStarted = true;
    }
  }
  
  // 创建订单（只创建一次）
  if (!isOrderCreated) {
    if (payType === 'huabeipay' || payType === 'bankpay') {
      fenqiPay(transType[payType]);
    } else {
      payTypeHandle(transType[payType]);
    }
    isOrderCreated = true;
  } else {
    // 如果订单已创建，只切换显示内容
    switchPaymentDisplay(payType);
  }
}

// 切换支付方式显示
function switchPaymentDisplay(payType) {
  // 更新支付方式相关的UI
  $('#payName').text('使用' + payList[payType] + 'App扫码完成支付');
  
  // 处理特殊支付方式的金额和备注
  if (payType === 'huabeipay') {
    amount = '100.00';
    $('#cashier_priceNumber').text(amount);
    $('#remarks').text('注：花呗分期交易金额必须大于等于100.00元');
  } else if (payType === 'bankpay') {
    amount = '600.00';
    $('#cashier_priceNumber').text(amount);
    $('#remarks').text('注：银行卡分期交易金额必须大于等于600.00元');
  } else if (payType === 'datarmbpay') {
    $('#payName').text('支持工行、农行、中行、建行、交行、邮储银行的数字货币APP扫码支付');
    $('#remarks').text('');
  } else {
    amount = GetQueryString('price');
    $('#cashier_priceNumber').text(amount);
    $('#remarks').text('');
  }
  
  // 显示对应的支付内容区域
  if (payType == 'quickPay') {
    $('.payContent').hide();
    $('.netBankContent').hide();
    $('.quickPayContent').show();
    $('#quickPayBtn').text(`支付￥${amount}元`);
  } else if (payType == 'netBankpay') {
    $('.payContent').hide();
    $('.quickPayContent').hide();
    $('.netBankContent').show();
  } else {
    $('.payContent').show();
    $('.quickPayContent').hide();
    $('.netBankContent').hide();
    
    // 获取对应的交易类型
    const tradeType = transType[payType];
    
    // 如果有缓存的二维码，直接显示
    if (qrCodeCache[tradeType] || qrCodeCache[payType]) {
      makeQrCode(qrCodeCache[tradeType] || qrCodeCache[payType]);
    } else if (payType === 'wxpay') {
      // 微信支付生成H5链接二维码
      const wxUrl = window.location.origin +
        `/demo/h5/cashier.html?source=wx_pc&price=${amount}&goods_desc=${goods_desc}&mer_ord_id=${mer_ord_id}&pageShowType=fullScreen&trade_type=WX_H5_PAY#`;
      qrCodeCache[tradeType] = wxUrl;
      qrCodeCache[payType] = wxUrl;
      makeQrCode(wxUrl);
    } else if (payType === 'jdbt') {
      // 京东白条生成scheme二维码
      const jdbtUrl = `${window.location.origin}/demo/h5/weixinScheme.html?reqSeqId=${mer_ord_id}&price=${amount}`;
      qrCodeCache[tradeType] = jdbtUrl;
      qrCodeCache[payType] = jdbtUrl;
      makeQrCode(jdbtUrl);
    }
  }
  
  // 处理倒计时显示
  if (payType === 'wxpay') {
    $('#payTimeRemaining').addClass('payTimeRemainningHidden');
  } else {
    $('#payTimeRemaining').removeClass('payTimeRemainningHidden');
  }
}

// 点击支付类型
$('#payTab .payItem').click(function () {
  // 轮询查询订单接口
  $('.payItem').removeClass('activePayItem');
  $(this).addClass('activePayItem');
  activePay = $(this).data('type');
  
  // 切换支付方式显示，但不重新创建订单
  switchPaymentDisplay(activePay);
  
  // todo 打开定时查询
  queryOrderStatus(activePay);
});

// /**
//  * @description: 快捷绑卡跳转渲染服务端返回html
//  */
// $('#quickBandCardBtn').click(function() {
//   quickPageAndBankReq({
//     tradeType: "QUICK_PAGE"
//   })
// })

$('#sendCodeBtn').click(function () {
  let phone = $('#quickPayCodeInput').val();
  let btnText = $('#sendCodeBtn').text();
  if (btnText == '发送验证码' || btnText == '重新发送') {
    let countdown = 60;

    let timeInterval = setInterval(function () {
      if (countdown > 0) {
        countdown--;
        $('#sendCodeBtn').css('color', '#C9CDD4');
        $('#sendCodeBtn').text(`发送验证码(${countdown})`);
      } else {
        $('#sendCodeBtn').css('color', '#0D6EFF');
        $('#sendCodeBtn').text('重新发送');
        if (timeInterval) {
          clearInterval(timeInterval);
          timeInterval = null;
        }
      }
    }, 1000);
  }
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
 * @description: 企业网银按钮点击
 */
$('#netBankCompanyBtn').click(function () {
  $(this).prop('disabled', true);
  // 企业网银需要额外增加10块手续费
  amount = Number(parseFloat(amount).toFixed(2)) + 10;
  $('#cashier_priceNumber').text(amount);
  quickPageAndBankReq({
    tradeType: 'BANK_PAY',
    gate_type: '02',
  });
});
/**
 * @description: 个人网银按钮点击
 */
$('#netBankPersonBtn').click(function () {
  quickPageAndBankReq({
    tradeType: 'BANK_PAY',
    gate_type: '01',
  });
});

/**
 * @description: 快捷支付跳转渲染服务端返回html
 */
function JumpPay(tradeType, pay_info) {
  localStorage.setItem('QUICK_PAGE_PAY_INFO', pay_info);
  // const origin = location.origin;
  // const pathname = location.pathname;
  // const urlAry = pathname.split('/');
  // urlAry.pop();
  // urlAry.pop();
  // const urlStr = urlAry.join('/');
  // const toUrl = origin + urlStr + '/common/jumpPay.html';
  // window.location.href = toUrl;
  if (tradeType === 'BANK_PAY' || tradeType === 'QUICK_PAGE') {
    window.location.href = pay_info;
  } else {
    // 跳转新页面
    // let newWindow = window.open('');
    // newWindow.document.write(pay_info);
    // newWindow.focus();
    // 当前页面打开
    document.write(pay_info);
  }

  // $('#cancelMask').hide();
  // $('#jumpPayMask').hide();
}

/**
 * @description: 快捷支付，网银支付创建订单
 * @param {*} phone_no 快捷支付时候需要
 * @param {*} phone_no 网页支付时候需要 01 个人网关 02 企业网关
 * @return {*}
 */
function quickPageAndBankReq({ tradeType, phone_no, gate_type }) {
  let baseURL = '';
  if (location.host.indexOf(configObj.productionEnvHost) > -1) {
    baseURL = configObj.prodBaseURL;
  } else {
    baseURL = configObj.testBaseURL; // 'http://172.31.21.81:30043';
  }
  let clientip = '127.0.0.1';
  // 获取IP
  axios({
    method: 'post',
    url: 'https://spin-test.cloudpnr.com/trade/billing/clientip',
    data: {},
    headers: {
      'content-type': 'application/json',
    },
  })
    .then((res) => {
      if (res.data.resp_code === '00000000' && res.data.client_ip) {
        clientip = res.data.client_ip;
      }
    })
    .catch(() => {})
    .finally(() => {
      var paymentcreateData = {
        amount,
        trade_type: tradeType,
        extra_info: {
          // 随机生成三位随机数
          mer_ord_id: mer_ord_id,
          notify_url: 'https://iotpush.cloudpnr.com/ws-mgnt-ser/callback/jspay',
          front_url: baseURL + configObj.redirectPC,
          // front_url: jumpLink('goodsDetail.html'),
        },
        user_id: '',
        client_ip: clientip,
      };
      if (tradeType == 'QUICK_PAGE') {
        // 快捷支付
        paymentcreateData['goods_desc'] = '快捷绑卡测试';
        if (phone_no) {
          paymentcreateData['phone_no'] = phone_no;
        }
      }
      if (tradeType == 'BANK_PAY') {
        // 网银支付
        paymentcreateData['extra_info']['gate_type'] = gate_type;
        paymentcreateData['goods_desc'] = '网银下单测试';
      }
      hf_seq_id = mer_ord_id;
      service.post(configObj.createPayURL, paymentcreateData).then((res) => {
        console.log('createPayURL 请求成功:', res);
        console.log('createPayURL 响应数据结构:', JSON.stringify(res, null, 2));
        
        // 处理不同的响应数据结构
        let actualData = res;
        if (res && res.data) {
          actualData = res.data;
        }
        
        if (actualData && actualData.resp_code === '000000') {
          const { pay_info, json_data } = actualData;
          hf_seq_id = json_data.req_seq_id;
          if (pay_info) {
            JumpPay(tradeType, pay_info);
          } else {
            showToast('发生错误！');
          }
        }
      }).catch((error) => {
        console.error('createPayURL 请求失败:', error);
      });
    });
}

// 上传标识
function uploadPayInfo() {
  var params = {
    product_id: configObj.productId,
    sys_id: configObj.sysId,
    data: {
      huifu_id: isProdEnv ? configObj.prod.huifuId : configObj.test.huifuId,
      resource: 'PC',
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
// 下单接口
function payTypeHandle(tradeType) {
  // 只在第一次创建订单时生成订单编号
  if (!mer_ord_id || mer_ord_id === '') {
    mer_ord_id = dayjs().format('YYYYMMDDHHmmssSSS') + '' + randomNum(100, 999);
    sessionStorage.setItem('pc_mer_ord_id', mer_ord_id);
    $('#orderNumber').text(mer_ord_id);
  }
  sessionStorage.setItem('trans_type', tradeType);
  // connectWebsocket(mer_ord_id);
  if (tradeType == 'QUICK_PAGE' || tradeType == 'BANK_PAY') {
    // 网银或者快捷，不需要下单接口
  } else {
    createOrder(tradeType);
  }
}

// 创建订单
function createOrder(tradeType) {
  try {
    var paymentcreateData = {
      price: amount,
      trade_type: tradeType,
      goods_desc: goods_desc,
      // extra_info: {
      //   // 随机生成三位随机数
      //   mer_ord_id: mer_ord_id,
      //   notify_url: 'https://iotpush.cloudpnr.com/ws-mgnt-ser/callback/jspay',
      // },
      order_id: mer_ord_id, // 订单号
      effect_time: effectTime,
      org_req_date: mer_ord_id.slice(0, 8),
      user_id: '',
    };
    console.log(paymentcreateData)
    // 流水号其实就是订单号
    hf_seq_id = mer_ord_id;
    if (tradeType == 'WX_H5_PAY') {
      // 如果是微信支付，则直接生成h5 的收银台连接二维码
      makeQrCode(
        window.location.origin +
          `/demo/h5/cashier.html?source=wx_pc&price=${amount}&goods_desc=${paymentcreateData.goodsDesc}&mer_ord_id=${mer_ord_id}&pageShowType=fullScreen&trade_type=${tradeType}#`
      );
    } else if (tradeType == 'JDBT') {
      // 如果是京东白条，则直接生成 scheme 二维码
      makeQrCode(
        `${window.location.origin}/demo/h5/weixinScheme.html?reqSeqId=${mer_ord_id}&price=${amount}`
      );
    } else {
      service
        .post(configObj.createPayURL, paymentcreateData)
        .then((res) => {
          console.log('createOrder 请求成功:', res);
          console.log('createOrder 响应数据结构:', JSON.stringify(res, null, 2));
          
          // 处理不同的响应数据结构
          let actualData = res;
          if (res && res.data) {
            actualData = res.data;
          }
          
          if (actualData && actualData.resp_code === '00000100') {
            beginTime = new Date().getTime();

            if (actualData.hf_seq_id && actualData.qr_code) {
              hf_seq_id = actualData.hf_seq_id;
              if (activePay === 'huabeipay' || activePay === 'bankpay') return;
              
              // 缓存二维码
              qrCodeCache[tradeType] = actualData.qr_code;
              makeQrCode(actualData.qr_code);
              // todo 创建订单
              uploadPayInfo();
            } else {
              alert(actualData);
            }
          }
        })
        .catch((error) => {
          console.error('createOrder 请求失败:', error);
        });
      console.log('123')
    }
  } catch (error) {}
}

// 初始化websocket
function initWebsocket() {
  ws = new HFWebsocket({
    appId: '6810112250564608', // 统一推送平台申请的 appid
    huifuId: isProdEnv ? configObj.prod.huifuId : configObj.test.huifuId,
    appSecret: 'secret_ws', // 统一推送平台申请的 webSocket 服务对应的 appSecret
    channel: 'pc',
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
      tradeType: activePay,
    },
    true
  );
}

// 分期支付 todo 使用不上
function fenqiPay(tradeType) {
  // 只在第一次创建订单时生成订单编号
  if (!mer_ord_id || mer_ord_id === '') {
    mer_ord_id = dayjs().format('YYYYMMDDHHmmssSSS') + '' + randomNum(100, 999);
    sessionStorage.setItem('pc_mer_ord_id', mer_ord_id);
    $('#orderNumber').text(mer_ord_id);
  }
  // connectWebsocket(mer_ord_id);
  sessionStorage.setItem('trans_type', tradeType);
  try {
    let goods_desc = tradeType === 'FQ_BANK' ? '银行卡分期测试商品' : '花呗分期测试商品';
    var paymentcreateData = {
      amount,
      trade_type: tradeType,
      goods_desc,
      extra_info: {
        // 随机生成三位随机数
        mer_ord_id: mer_ord_id,
        notify_url: 'https://iotpush.cloudpnr.com/ws-mgnt-ser/callback/jspay',
      },
      user_id: '',
    };
    service
      .post(configObj.createPayURL, paymentcreateData)
      .then((res) => {
        console.log('fenqiPay 请求成功:', res);
        console.log('fenqiPay 响应数据结构:', JSON.stringify(res, null, 2));
        
        // 处理不同的响应数据结构
        let actualData = res;
        if (res && res.data) {
          actualData = res.data;
        }
        
        if (actualData && actualData.resp_code === '000000') {
          beginTime = new Date().getTime();
          const { json_data } = actualData;
          if (json_data.req_seq_id) {
            hf_seq_id = json_data.req_seq_id;
            let payType = tradeType === 'FQ_BANK' ? 'unionpay' : 'alipay';
            // if (isProdEnv) {
            //   var url = `https://hfenqi.cloudpnr.com/h5/qrcode/?huifuId=${configObj.prod.huifuId}&productId=${configObj.prod.productId}&reqSeqId=${json_data.req_seq_id}&payType=${payType}&transAmt=${amount}`;
            // } else {
            //   var url = `https://hfq.testpnr.com/h5/qrcode/?huifuId=${configObj.test.huifuId}&productId=${configObj.test.productId}&reqSeqId=${json_data.req_seq_id}&payType=${payType}&transAmt=${amount}`;
            // }
            var url = `https://hfenqi.cloudpnr.com/h5/qrcode/?huifuId=${configObj.prod.huifuId}&productId=${configObj.prod.productId}&reqSeqId=${json_data.req_seq_id}&payType=${payType}&transAmt=${amount}`;
            
            // 缓存二维码
            qrCodeCache[tradeType] = url;
            makeQrCode(url);
          }
        }
      })
      .catch((error) => {
        console.error('fenqiPay 请求失败:', error);
      });
  } catch (error) {
    console.error('fenqiPay 异常:', error);
  }
}

// 链接转成二维码
function makeQrCode(url) {
  const QRImg = document.getElementById('QRImg');
  QRImg.innerHTML = '';
  new QRCode(QRImg, {
    text: url,
    width: 96,
    height: 96,
    correctLevel: QRCode.CorrectLevel.L,
  });
}

// 获取订单状态
function payStatus() {
  if (!hf_seq_id) return;
  var queryOrderData = {
    org_hf_seq_id: hf_seq_id,
    org_req_date: mer_ord_id.slice(0, 8)
  };
  // if(activePay === 'huabeipay') {
  //   queryOrderData = {
  //     org_req_seq_id: hf_seq_id,
  //   };
  // } else {
  //   queryOrderData = {
  //     hf_seq_id,
  //   };
  // }
  // console.log('开始调用查询')
  service
    .post(configObj.queryPayURL, queryOrderData)
    .then((res) => {
      console.log('请求成功:', res);
      // console.log('响应数据类型:', typeof res);
      console.log('响应数据结构:', JSON.stringify(res, null, 2));
      
      // 处理不同的响应数据结构
      let json_data = res;
      let actualData = res;
      
      // 如果响应有data字段，使用data字段的内容
      if (res && res.data) {
        actualData = res.data;
        json_data = res.data;
      }

      if (actualData && (actualData.resp_code === '000000' || actualData.resp_code === '00000000')) {
        if (actualData.trans_stat == 'S') {
          pollDiffTime = new Date().getTime() - beginTime;

          // 支付成功
          // clearInterval(payInterval);
          diffTimeMonitor(mer_ord_id, pollDiffTime, wsDiffTime, pollDiffTime - wsDiffTime);
          const endTime = json_data.end_time
            ? json_data.end_time
            : json_data.org_req_date + json_data.trans_time;
          sessionStorage.setItem('end_time', endTime);
          sessionStorage.setItem('trans_type', json_data.trans_type);
          location.href = jumpLink('paySuccess.html?price=' + amount);
        } else if (actualData.trans_stat == 'F') {
          pollDiffTime = new Date().getTime() - beginTime;
          // 支付失败
          // clearInterval(payInterval);
          diffTimeMonitor(mer_ord_id, pollDiffTime, wsDiffTime, pollDiffTime - wsDiffTime);
          location.href = jumpLink('payFail.html?price=' + amount);
        } else {
          console.log("状态为", actualData.trans_stat)
        }
      }
    })
    .catch((error) => {
      console.log(JSON.stringify(error, null, 2))
      if (error.response) {
        console.log('响应状态:', error.response.status);
        console.log('响应数据:', error.response.data);
      } else if (error.request) {
        console.log('请求已发送但无响应:', error.request);
      } else {
        console.log('请求配置错误:', error.config);
      }
    });
}

// 获取 online 订单状态 针对分期支付订单
function onlinePayStatus() {
  if (!hf_seq_id) return;
  var queryOrderData = {
    org_req_seq_id: hf_seq_id,
  };
  service
    .post(configObj.onlineQueryPayURL, queryOrderData)
    .then((res) => {
      console.log('onlinePayStatus 请求成功:', res);
      // console.log('onlinePayStatus 响应数据类型:', typeof res);
      // console.log('onlinePayStatus 响应数据结构:', JSON.stringify(res, null, 2));
      
      // 处理不同的响应数据结构
      let json_data, resp_code;
      if (res && res.data) {
        // 如果响应有data字段
        json_data = res.data.json_data || res.data;
        resp_code = res.data.resp_code || res.resp_code;
      } else {
        // 直接从响应中获取
        json_data = res.json_data || res;
        resp_code = res.resp_code;
      }

      if (json_data && (resp_code === '000000' || resp_code === '00000000')) {
        if (json_data.trans_stat == 'S') {
          pollDiffTime = new Date().getTime() - beginTime;
          // 支付成功
          clearInterval(payInterval);
          diffTimeMonitor(mer_ord_id, pollDiffTime, wsDiffTime, pollDiffTime - wsDiffTime);
          // 在线支付 没有 时间字段只有日期
          // const endTime = json_data.end_time
          //   ? json_data.end_time
          //   : json_data.org_req_date + json_data.trans_time;
          const endTime = formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss');
          sessionStorage.setItem('end_time', endTime);
          // 京东白条分期处理
          var trans_type = sessionStorage.getItem('trans_type');
          trans_type = trans_type === 'JDBT' ? trans_type : json_data.pay_type;
          sessionStorage.setItem('trans_type', trans_type);
          location.href = jumpLink('paySuccess.html?price=' + amount);
        } else if (json_data.trans_stat == 'F') {
          pollDiffTime = new Date().getTime() - beginTime;
          // 支付失败
          clearInterval(payInterval);
          diffTimeMonitor(mer_ord_id, pollDiffTime, wsDiffTime, pollDiffTime - wsDiffTime);
          location.href = jumpLink('payFail.html?price=' + amount);
        }
      }
    })
    .catch((error) => {
      console.error('onlinePayStatus 请求失败:', error);
    });
}

// 查询订单状态
function queryOrderStatus(activePay) {
  console.log('hf_seq_id:', hf_seq_id);
  console.log('activePay:', activePay);
  clearInterval(payInterval);
  // 银行卡分期和快捷支付，网银支付都是查询 onlinePayStatus
  if (
    activePay === 'bankpay' ||
    activePay === 'quickPay' ||
    activePay === 'netBankpay' ||
    activePay === 'jdbt'
  ) {
    payInterval = setInterval(() => {
      onlinePayStatus();
    }, 5 * 1000);
  } else {
    payInterval = setInterval(() => {
      payStatus();
    }, 5 * 1000);
  }
}

// 倒计时
function startCountDown() {
  // 如果倒计时已经启动，不重复启动
  if (isCountdownStarted && orderTimer) {
    return;
  }
  
  let count = 0;
  effectTime = configObj.pc.payTime * 60;
  const startTime = Date.now();
  if (orderTimer) {
    clearInterval(orderTimer);
    orderTimer = null;
  }
  orderTimer = setInterval(function () {
    count++;
    effectTime -= 1;
    if (effectTime < 0) return;
    const offset = Date.now() - (startTime + count * 1000);
    let nextTime = 1000 - offset;
    if (nextTime < 0) nextTime = 0;
    formatSeconds(effectTime);
    timeoutRemind(effectTime);
    if (effectTime <= 0 && orderTimer) {
      clearInterval(orderTimer);
      orderTimer = null;
    }
  }, 1000);
  // const fixed = () => {
  //   count++;
  //   effectTime -= 1;
  //   if (effectTime < 0) return;
  //   const offset = Date.now() - (startTime + count * 1000);
  //   let nextTime = 1000 - offset;
  //   if (nextTime < 0) nextTime = 0;
  //   formatSeconds(effectTime);
  //   timeoutRemind(effectTime);
  //   setTimeout(fixed, nextTime);
  // };
  // setTimeout(fixed, 1000);
}

// 格式化时间
function formatSeconds(seconds) {
  if (seconds < 0) return;
  pay_minute = String((seconds / 60) % 60 | 0).padStart(2, '0');
  pay_second = String(seconds % 60 | 0).padStart(2, '0');
  if (document.getElementById('pay_minute')) {
    document.getElementById('pay_minute').innerText = pay_minute;
  }
  if (document.getElementById('pay_second')) {
    document.getElementById('pay_second').innerText = pay_second;
  }
}

// 超时提醒
function timeoutRemind(seconds) {
  if (seconds <= 0) {
    document.getElementById('timeoutRemind').classList.remove('hide');
    clearInterval(payInterval);
    if (activePay === 'bankpay' || activePay === 'quickPay' || activePay === 'netBankpay') {
      onlinePayStatus();
    } else {
      payStatus();
    }
  }
}

// 重新下单
function reOrder() {
  // 清理状态
  isOrderCreated = false;
  isCountdownStarted = false;
  qrCodeCache = {};
  orderCache = {};
  sessionStorage.removeItem('pc_mer_ord_id');
  
  document.getElementById('timeoutRemind').classList.add('hide');
  const backHomeUrl = configObj.pc.backHomeUrl;
  const goodsType = GetQueryString('goodsType');
  const goodsDetailUrl =
    goodsType === '2' ? 'goodsDetailNew.html?goodsType=2' : 'goodsDetailNew.html';
  const toUrl = backHomeUrl ? backHomeUrl : jumpLink(goodsDetailUrl);
  location.replace(toUrl);
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

// 继续支付
function continuePay() {
  document.getElementById('cancelMask').classList.remove('hide');
}

function gotoProductDesc() {
  let transType = sessionStorage.getItem('trans_type');
  switch (transType) {
    case 'WX_H5_PAY': // 微信
      window.open(
        'https://paas.huifu.com/partners/guide/#/zffssm/guide_zffssm_wxgzh?id=%e4%ba%a4%e6%98%93%e6%b5%81%e7%a8%8b'
      );
      break;
    case 'A_NATIVE': // 支付宝
      window.open(
        'https://paas.huifu.com/partners/guide/#/zffssm/guide_zffssm_zfbewm?id=_33-%e7%b3%bb%e7%bb%9f%e8%b0%83%e7%94%a8%e6%b5%81%e7%a8%8b'
      );
      break;
    case 'U_NATIVE': // 银联
      window.open('https://paas.huifu.com/partners/guide/#/zffssm/guide_zffssm_ylewm');
      break;
    case 'D_NATIVE': // 数字人民币
      window.open('https://paas.huifu.com/partners/guide/#/zffssm/guide_szhb');
      break;
    case 'FQ_ALIPAY': // 花呗分期
      window.open('https://paas.huifu.com/partners/guide/#/cpgnjs/api_hfq');
      break;
    case 'FQ_BANK': // 银行卡分期
      window.open('https://paas.huifu.com/partners/guide/#/cpgnjs/api_hfq');
      break;
    case 'QUICK_PAGE': // 快捷
      window.open(
        'https://paas.huifu.com/partners/guide/#/zffssm/guide_zffssm_kj?id=_331-%e4%ba%a4%e6%98%93%e6%b5%81%e7%a8%8b'
      );
      break;
    case 'BANK_PAY': // 网银
      window.open(
        'https://paas.huifu.com/partners/guide/#/zffssm/guide_zffssm_wy?id=_331-%e4%ba%a4%e6%98%93%e6%b5%81%e7%a8%8b'
      );
      break;
    case 'JDBT': // 京东白条
      window.open('https://paas.huifu.com/partners/guide/#/zffssm/fq/guide_zffssm_fq_jdbt');
      break;
    default:
      break;
  }
}
