import { myAddEventListener } from "../pr-client-utils/eventListeners";
import { MsgReq, MsgResp } from "../pr-msg-common/pr-msg-common";

export class MsgClient {
    constructor(ownUser: string, rcvTimeoutMs: number, requestHandler?: (req: MsgReq) => void, idleMsBeforeRequest?: number, signal?: AbortSignal) {
        this.ownUser = ownUser;
        this.nextReq = {
            type: 'pr-msg',
            user: ownUser,
            ack: {},
            send: {}
        }
        this.requestHandler = requestHandler;
        this.idleMsBeforeRequest = idleMsBeforeRequest ?? 0;
        this.rcvTimeoutMs = rcvTimeoutMs;
        this.timeout = requestHandler != null ? setTimeout(() => {
            this.onTimeout();
        }, rcvTimeoutMs) : null;

        this.signal = signal;

        if (requestHandler != null && signal != null) {
            const onAbort = () => {
                console.log('MsgClient.onAbort');
                if (this.timeout != null) {
                    clearTimeout(this.timeout);
                }
    
            }
        
            console.warn('TODO fix removing event listeners on destruction of the MsgClient')
            signal.addEventListener('abort', onAbort, {
                once: true
            })
        }
    }

    addToSend(receivingUser: string, msg: string[]) {
        this.signal?.throwIfAborted();
        let outMsg: string[];
        if (!(receivingUser in this.nextReq.send)) {
            outMsg = this.nextReq.send[receivingUser] = [];
        } else {
            outMsg = this.nextReq.send[receivingUser];
        }
        outMsg.push(...msg);

        const h = this.requestHandler;
        if (h != null) {
            if (this.timeout != null) {
                clearTimeout(this.timeout);
            }
            this.timeout = setTimeout(() => {
                this.onTimeout()
            }, this.idleMsBeforeRequest);
        }
    }

    private onTimeout() {
        this.signal?.throwIfAborted();
        console.log('onTimeout');
        this.timeout = null;
        const h = this.requestHandler;
        if (h == null) return;
        h(this.createReq());
        this.timeout = setTimeout(() => this.onTimeout(), this.rcvTimeoutMs);
    }

    createReq(): MsgReq {
        this.signal?.throwIfAborted();
        const res = structuredClone(this.nextReq);
        this.nextReq.send = {}
        return res;
    }

    processResp(resp: MsgResp) {
        this.signal?.throwIfAborted();
        for (const user in resp.rcv) {
            this.nextReq.ack[user] = resp.rcv[user].cnt;
        }
        return resp.rcv;
    }

    /**
     * wraps a handler so that the resulting promise rejects as soon as signal is aborted.
     * @param handler handler to be wrapped
     * @returns a handler that returns a racing promise which resolves when the orig handler resolves or the signal is aborted which ever happens first.
     */
    private createAbortableHandler(handler: (sender: string, msg: string) => Promise<void>): ((sender: string, msg: string) => Promise<void>) {
        console.warn('createAbortableHandler with event listener leak');
        if (this.signal == null) return handler;
        let releaseEventListener: (() => void) | null = null;
        return (sender: string, msg: string): Promise<void> => {
            return Promise.race([handler(sender, msg), new Promise<void>((res, rej) => {
                if (this.signal == null) {
                    rej(new Error('signal became null?!'));
                    return;
                }
                releaseEventListener = myAddEventListener(this.signal, 'abort', () => {
                    rej(this.signal?.reason)
                }, {
                    once: true
                })
            })]).finally(() => {
                if (releaseEventListener != null) releaseEventListener();
            })
        }
    }

    async handleSerially(resp: MsgResp, handler1: (sender: string, msg: string) => Promise<void>): Promise<void> {
        this.signal?.throwIfAborted();
        const abortableHandler = this.createAbortableHandler(handler1);
        console.log('handleSerially: resp', resp);
        console.log('resp.rcv', resp.rcv);
        for (const sender in resp.rcv) {
            console.log('sender', sender);
            this.nextReq.ack[sender] = resp.rcv[sender].cnt;
            for (const msg of resp.rcv[sender].msg) {
                await abortableHandler(sender, msg);
                this.signal?.throwIfAborted();
            }
        }
    }
    async handleParallely(resp: MsgResp, handler1: (sender: string, msg: string) => Promise<void>): Promise<void> {
        this.signal?.throwIfAborted();
        const abortableHandler = this.createAbortableHandler(handler1);
        const promises: Promise<void>[] = [];
        for (const sender in resp.rcv) {
            this.nextReq.ack[sender] = resp.rcv[sender].cnt;
            for (const msg of resp.rcv[sender].msg) {
                // here without await for parallelity
                promises.push(abortableHandler(sender, msg));
            }
        }

        await Promise.allSettled(promises)
    }



    private ownUser: string;
    private nextReq: MsgReq;
    private rcvTimeoutMs: number;
    private requestHandler?: (req: MsgReq) => void;
    private signal?: AbortSignal;
    private idleMsBeforeRequest: number;
    private timeout: NodeJS.Timeout | null = null;
}