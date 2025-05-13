import BizService from "./BizService";
export class ChatService extends BizService {
    constructor(options) {
        super(options);
    }
    /**
     * POST /chat
     *
     * @param payload
     * @returns Promise<ChatResp>
     */
    postChat(payload) {
        return this.getAxios().post(`/chat`, payload, {});
    }
}
export default ChatService;
export function createChatService(opt) {
    return new ChatService(opt);
}
export const chatService = createChatService();
