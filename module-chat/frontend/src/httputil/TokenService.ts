/**
 * Token服务，用于保存和获取token
 */

const TOKEN_KEY = 'auth_token';
const TOKEN_EXPIRY_KEY = 'auth_token_expiry';

export class TokenService {
  /**
   * 保存token和过期时间到localStorage
   * @param tokenData string或包含token和expire的对象
   */
  static saveToken(tokenData: string | { token: string; expire: string }): void {
    if (typeof tokenData === 'string') {
      localStorage.setItem(TOKEN_KEY, tokenData);
    } else {
      localStorage.setItem(TOKEN_KEY, tokenData.token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, tokenData.expire);
    }
  }

  /**
   * 从localStorage获取token，如果token已过期则返回空字符串
   */
  static getToken(): string {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);

    if (!token) {
      return '';
    }

    if (expiryTime) {
      const expiry = new Date(expiryTime).getTime();
      const now = new Date().getTime();
      if (now > expiry) {
        this.clearToken();
        return '';
      }
    }

    return token;
  }

  /**
   * 清除token及其过期时间
   */
  static clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  /**
   * 检查是否已经登录且token未过期
   */
  static isLoggedIn(): boolean {
    return !!this.getToken();
  }
}

export default TokenService; 