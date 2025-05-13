import BizService from "./BizService";
export class UploadService extends BizService {
    constructor(options) {
        super(options);
    }
    /**
     * POST /upload
     *
     * @param formData
     * @returns Promise<UploadResp>
     */
    postUpload(formData) {
        return this.getAxios().post(`/upload`, formData, {});
    }
}
export default UploadService;
export function createUploadService(opt) {
    return new UploadService(opt);
}
export const uploadService = createUploadService();
