/*
 * @Author: jiaoyan.du jiaoyan.du@huifu.com
 * @Date: 2023-01-05 14:33:48
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2023-10-16 17:27:28
 * @FilePath: /opps-checkout-web/public/demo/config/index.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
var configObj = {
  mobile: {
    // 支付剩余时间倒计时,单位min
    payTime: 5,
    // 支付完成返回的页面地址，需要加协议，http/https
    backHomeUrl: '',
    // 微信支付相关配置
    wxConfig: {
      // 微信appid
      appid: 'wx85785e2db08b86a8',
      // 获取微信openID的api
      wxAuthURL: 'wxauth',
    },
  },
  pc: {
    // 支付剩余时间倒计时,单位min
    payTime: 5,
    // 支付完成返回的页面地址，需要加协议，http/https
    backHomeUrl: '',
  },

  prod: {
    // 商户id
    huifuId: '6666000166604494',
    //产品Id
    productId: 'PAYUN',
    // 系统Id
    sysId: '6666000166604494',
  },

  test: {
    // 商户id
    huifuId: '6666000166604494',
    //产品Id
    productId: 'PAYUN',
    // 系统Id
    sysId: '6666000166604494',
    // // 商户id
    // huifuId: '6666000104012877',
    // //产品Id
    // productId: 'JCTEST',
    // // 系统Id
    // sysId: '6666000103959241',
  },

  // 是否开启调试模式
  isDebug: true,
  // front_url_h5
  redirectH5: '/redirect_h5',
  redirectPC: '/redirect_pc',
  // 下单的API, 聚合正扫
  createPayURL: 'pay/create',
  // 查询订单API
  queryPayURL: 'pay/query',
  // onlinepayment 查询
  onlineQueryPayURL: 'onlinepayment/query',
  // 预下单
  preorder: '/payment/pre/create',
  // 测试环境域名
  testEnvHost: 'https://localhost:8081',
  // 测试API前缀
  testBaseURL: 'https://localhost:8081',
  // testBaseURL: 'http://172.31.21.105:30043/v1',
  // 下单成功标识上传测试API
  testUploadPayAPI: 'http://top-intetest.huifutest.com/v2/trade/casherinsert',
  // 生产环境域名
  // productionEnvHost: 'paas.huifu.com',
  productionEnvHost: 'www.cocofotos.com',
  // 生产API前缀
  prodBaseURL: 'https://localhost:8081',
  prodUploadPayAPI: 'https://api.huifu.com/v2/trade/casherinsert',
  // 小程序下单域名
  testMiniBaseURL: 'https://spin-test.cloudpnr.com',
  prodMiniBaseURL: 'https://api.huifu.com',
  // 小程序下单API
  miniOrderAPI: '/trade/billing/hosting/preorder',
  miniQueryOrderAPI: '/trade/billing/orderinfo',
};
