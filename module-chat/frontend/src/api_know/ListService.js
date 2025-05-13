import qs from "qs";
import BizService from "./BizService";
export class ListService extends BizService {
    constructor(options) {
        super(options);
    }
    /**
     * GET /list
     *
     * @param req
     * @returns Promise<GetListResp>
     */
    getList(params) {
        return this.getAxios().get(`/list`, {
            params: {
                req: params.req,
            },
            paramsSerializer: (params) => qs.stringify(params),
        });
    }
}
export default ListService;
export function createListService(opt) {
    return new ListService(opt);
}
export const listService = createListService();
