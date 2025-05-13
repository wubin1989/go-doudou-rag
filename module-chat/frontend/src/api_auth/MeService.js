import BizService from "./BizService";
export class MeService extends BizService {
    constructor(options) {
        super(options);
    }
    /**
     * GET /me
     *
     * @returns Promise<GetMeResp>
     */
    getMe() {
        return this.getAxios().get(`/me`, {});
    }
}
export default MeService;
export function createMeService(opt) {
    return new MeService(opt);
}
export const meService = createMeService();
