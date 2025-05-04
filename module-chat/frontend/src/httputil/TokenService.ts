/**
 * Token服务，用于保存和获取token
 */

const TOKEN_KEY = 'auth_token';

export class TokenService {
  /**
   * 保存token到localStorage
   * @param token 
   */
  static saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * 从localStorage获取token
   */
  static getToken(): string {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  /**
   * 清除token
   */
  static clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  /**
   * 检查是否已经登录
   */
  static isLoggedIn(): boolean {
    return !!this.getToken();
  }
}

export default TokenService; 