import { MsgReq, MsgResp } from "../pr-msg-common/pr-msg-common";

export class MsgClient {
    constructor(ownUser: string) {
        this.ownUser = ownUser;
        this.nextReq = {
            type: 'pr-msg',
            user: ownUser,
            ack: {},
            send: {}
        }
    }

    addToSend(receivingUser: string, msg: string[]) {
        let outMsg: string[];
        if (!(receivingUser in this.nextReq.send)) {
            outMsg = this.nextReq.send[receivingUser] = [];
        } else {
            outMsg = this.nextReq.send[receivingUser];
        }
        outMsg.push(...msg);
    }

    createReq(): MsgReq {
        const res = structuredClone(this.nextReq);
        this.nextReq.send = {}
        return res;
    }

    processResp(resp: MsgResp) {
        for (const user in resp.rcv) {
            this.nextReq.ack[user] = resp.rcv[user].cnt;
        }
        return resp.rcv;
    }

    async handleSerially(resp: MsgResp, handler: (sender: string, msg: string) => Promise<void>): Promise<void> {
        for(const sender in resp.rcv) {
            this.nextReq.ack[sender] = resp.rcv[sender].cnt;
            for (const msg of resp.rcv[sender].msg) {
                await handler(sender, msg);
            }
        }
    }
    async handleParallely(resp: MsgResp, handler: (sender: string, msg: string) => Promise<void>): Promise<void> {
        const promises: Promise<void>[] = [];
        for(const sender in resp.rcv) {
            this.nextReq.ack[sender] = resp.rcv[sender].cnt;
            for (const msg of resp.rcv[sender].msg) {
                // here without await for parallelity
                promises.push(handler(sender, msg));
            }
        }

        await Promise.allSettled(promises)
    }


    private ownUser: string;
    private nextReq: MsgReq;
}