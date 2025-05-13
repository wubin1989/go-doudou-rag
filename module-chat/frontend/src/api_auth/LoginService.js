import BizService from "./BizService";
export class LoginService extends BizService {
    constructor(options) {
        super(options);
    }
    /**
     * POST /login
     *
     * PostLogin @role(guest)
     * @param payload
     * @returns Promise<PostLoginResp>
     */
    postLogin(payload) {
        return this.getAxios().post(`/login`, payload, {});
    }
}
export default LoginService;
export function createLoginService(opt) {
    return new LoginService(opt);
}
export const loginService = createLoginService();
