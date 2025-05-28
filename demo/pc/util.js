/*eslint-disable*/
function GetQueryString(name) {
  var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
  var r = window.location.search.substr(1).match(reg);
  if (r != null) return decodeURI(r[2]);
  return null;
}
function deepClone(source) {
  if (!source && typeof source !== 'object') {
    throw new Error('error arguments', 'deepClone');
  }
  const targetObj = source.constructor === Array ? [] : {};
  Object.keys(source).forEach((keys) => {
    if (source[keys] && typeof source[keys] === 'object') {
      targetObj[keys] = deepClone(source[keys]);
    } else {
      targetObj[keys] = source[keys];
    }
  });
  return targetObj;
}
//生成自定义位数随机数
function randomNum(minNum, maxNum) {
  switch (arguments.length) {
    case 1:
      return parseInt(Math.random() * minNum + 1);
    case 2:
      return parseInt(Math.random() * (maxNum - minNum + 1) + minNum);
    default:
      return 0;
  }
}
// 支付状态
var mods = {};
// 支付渠道
// alipay_wap: 支付宝H5支付
// wx_pub: 微信H5支付
mods.channelConfig = {
  alipay_qr: 'alipay_qr',
  alipay_wap: 'alipay_wap',
  wx_pub: 'wx_pub',
};

// payment参数校验结果
mods.chackMsg = {
  orderError: '发起支付失败',
  channelError: '支付渠道参数错误',
  amountError: '支付金额参数错误',
  queryUrlError: '支付结果url参数未知',
};

// 支付状态值
mods.payStatus = {
  succeeded: 'succeeded',
  failed: 'failed',
  pending: 'pending',
  timeout: 'timeout',
  cancel: 'unknown',
  unknown: 'unknown',
  paramError: 'paramError',
};
// 支付结果对象
mods.payResult = {
  succeeded: {
    result_status: mods.payStatus.succeeded,
    result_message: '订单支付成功',
    result_info: {},
  },

  failed: {
    result_status: mods.payStatus.failed,
    result_message: '订单支付失败',
    result_info: {},
  },

  pending: {
    result_status: mods.payStatus.pending,
    result_message: '订单支付中',
    result_info: {},
  },

  timeout: {
    result_status: mods.payStatus.timeout,
    result_message: '订单支付超时',
    result_info: {},
  },

  cancel: {
    result_status: mods.payStatus.cancel,
    result_message: '支付取消',
    result_info: {},
  },

  unknown: {
    result_status: mods.payStatus.unknown,
    result_message: '订单结果未知',
    result_info: {},
  },

  paramError: {
    result_status: mods.payStatus.paramError,
    result_message: '参数错误',
    result_info: {},
  },
};

// 时间格式化
function formatDate(data, format) {
  const now = new Date(data);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  // 替换格式化标记
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}
