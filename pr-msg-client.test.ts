import { MsgResp } from "../pr-msg-common/pr-msg-common";
import { MsgClient } from "./pr-msg-client"

global.structuredClone = (o: any): any => {
    return JSON.parse(JSON.stringify(o));
}

describe('pr-msg-client provides class MsgClient', () => {
    test('addToSend and createReq', () => {
        const mc = new MsgClient('a');
        mc.addToSend('b', ['a.b.1', 'a.b.2']);
        mc.addToSend('c', ['a.c.1', 'a.c.2']);


        {
            const req = mc.createReq();
            expect(req).toEqual({
                type: 'pr-msg',
                user: 'a',
                ack: {},
                send: {
                    'b': ['a.b.1', 'a.b.2'],
                    'c': ['a.c.1', 'a.c.2']
                }
            })
        }

        {
            const resp: MsgResp = {
                type: 'success',
                rcv: {}
            }
            expect(mc.processResp(resp)).toEqual({});
        }
        {
            const req = mc.createReq();
            expect(req).toEqual({
                type: 'pr-msg',
                user: 'a',
                ack: {},
                send: {}
            })
        }

        {
            const resp: MsgResp = {
                type: 'success',
                rcv: {
                    b: {
                        cnt: 2,
                        msg: ['b.a.1', 'b.a.2']
                    }
                }
            }
            expect(mc.processResp(resp)).toEqual({
                b: {
                    cnt: 2,
                    msg: ['b.a.1', 'b.a.2']
                }
            });
        }
        {
            const req = mc.createReq();
            expect(req).toEqual({
                type: 'pr-msg',
                user: 'a',
                ack: {
                    b: 2
                },
                send: {}
            })
        }
    })
})