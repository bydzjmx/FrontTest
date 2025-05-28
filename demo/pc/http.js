/* 预下单特殊处理 */
var baseURL = '';
if (location.host.indexOf(configObj.productionEnvHost) > -1) {
  baseURL = configObj.prodBaseURL;
} else {
  baseURL = configObj.preTestBaseURL; // 'http://172.31.21.81:30043';
}

var service = axios.create({
  baseURL: baseURL,
  withCredentials: false, // send cookies when cross-domain requests
  timeout: 20000, // request timeout
  headers: {
    'Content-Type': 'application/json;charset=uft-8',
  },
});

// request interceptor
service.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// response interceptor
service.interceptors.response.use(
  (response) => {
    // 直接返回 response.data，让业务代码自己处理数据结构
    return response.data;
  },
  (error) => {
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);
