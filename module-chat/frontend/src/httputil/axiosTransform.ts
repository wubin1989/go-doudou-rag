/**
 * Data processing class, can be configured according to the project
 */
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { AxiosCanceler } from './axiosCancel';
import type { RequestOptions } from '../types/axios';
import { TokenService } from './TokenService';

export interface CreateAxiosOptions extends AxiosRequestConfig {
  authenticationScheme?: string;
  transform?: AxiosTransform;
  requestOptions?: RequestOptions;
  axiosCanceler?: AxiosCanceler;
  tokenGetter?: () => string;
}

export abstract class AxiosTransform {
  /**
   * @description: 请求失败处理
   */
  requestCatchHook?: (e: Error, options: RequestOptions) => Promise<any>;

  /**
   * @description: 请求之前的拦截器
   */
  requestInterceptors?: (config: AxiosRequestConfig,options: CreateAxiosOptions) => AxiosRequestConfig;

  /**
   * @desc ription: 请求之后的拦截器
   */
  responseInterceptors?: (res: any, options: CreateAxiosOptions) => any;

  /**
   * @description: 请求之前的拦截器错误处理
   */
  requestInterceptorsCatch?: (error: Error) => void;

  /**
   * @description: 请求之后的拦截器错误处理
   */
  responseInterceptorsCatch?: (axiosInstance: AxiosResponse, error: Error) => void;
}

export const customTransform = {
  requestInterceptors: function (config: AxiosRequestConfig, options: CreateAxiosOptions): AxiosRequestConfig {
    // 获取token
    const token = TokenService.getToken();
    
    // 如果token存在且配置允许使用token
    if (token && (!options.requestOptions || options.requestOptions?.withToken !== false)) {
      // 获取认证方案，默认为Bearer
      const authenticationScheme = options.authenticationScheme || 'Bearer';
      
      // 设置Authorization请求头
      if (config.headers) {
        config.headers['Authorization'] = `${authenticationScheme} ${token}`;
      } else {
        config.headers = {
          'Authorization': `${authenticationScheme} ${token}`
        };
      }
    }
    
    return config;
  },
  responseInterceptorsCatch: function (axiosInstance: AxiosResponse, error: Error) {
    throw error;
  },
  responseInterceptors: function (res: any, options: CreateAxiosOptions): any {
    return res;
  }
}