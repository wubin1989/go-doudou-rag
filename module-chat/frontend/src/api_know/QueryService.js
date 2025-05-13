import qs from "qs";
import BizService from "./BizService";
export class QueryService extends BizService {
    constructor(options) {
        super(options);
    }
    /**
     * GET /query
     *
     * @param req
     * @returns Promise<GetQueryResp>
     */
    getQuery(params) {
        return this.getAxios().get(`/query`, {
            params: {
                req: params.req,
            },
            paramsSerializer: (params) => qs.stringify(params),
        });
    }
}
export default QueryService;
export function createQueryService(opt) {
    return new QueryService(opt);
}
export const queryService = createQueryService();
