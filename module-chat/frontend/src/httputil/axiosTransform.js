import { TokenService } from './TokenService';
export class AxiosTransform {
    /**
     * @description: 请求失败处理
     */
    requestCatchHook;
    /**
     * @description: 请求之前的拦截器
     */
    requestInterceptors;
    /**
     * @desc ription: 请求之后的拦截器
     */
    responseInterceptors;
    /**
     * @description: 请求之前的拦截器错误处理
     */
    requestInterceptorsCatch;
    /**
     * @description: 请求之后的拦截器错误处理
     */
    responseInterceptorsCatch;
}
export const customTransform = {
    requestInterceptors: function (config, options) {
        // 获取token
        const token = TokenService.getToken();
        // 如果token存在且配置允许使用token
        if (token && (!options.requestOptions || options.requestOptions?.withToken !== false)) {
            // 获取认证方案，默认为Bearer
            const authenticationScheme = options.authenticationScheme || 'Bearer';
            // 设置Authorization请求头
            if (config.headers) {
                config.headers['Authorization'] = `${authenticationScheme} ${token}`;
            }
            else {
                config.headers = {
                    'Authorization': `${authenticationScheme} ${token}`
                };
            }
        }
        return config;
    },
    responseInterceptorsCatch: function (axiosInstance, error) {
        throw error;
    },
    responseInterceptors: function (res, options) {
        return res;
    }
};
