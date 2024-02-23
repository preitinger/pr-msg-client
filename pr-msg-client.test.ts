import { MsgResp } from "../pr-msg-common/pr-msg-common";
import { MsgClient } from "./pr-msg-client"

global.structuredClone = (o: any): any => {
    return JSON.parse(JSON.stringify(o));
}

describe('pr-msg-client provides class MsgClient', () => {
    test('addToSend, and createReq, and processResp', () => {
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

    test('handleSerially', async () => {
        const mc = new MsgClient('a');

        {
            const resp: MsgResp = {
                type: 'success',
                rcv: {
                    b: {
                        cnt: 2,
                        msg: ['b.a.1', 'b.a.2']
                    },
                    c: {
                        cnt: 2,
                        msg: ['c.a.1', 'c.a.2']
                    }
                }
            }
            const protocol: string[] = [];
            await mc.handleSerially(resp, async (sender, msg) => {
                protocol.push('begin ' + sender + ' ' + msg);
                await new Promise<void>(res => {
                    setTimeout(() => {
                        res();
                    }, 200)
                })
                protocol.push('end ' + sender + ' ' + msg)
            })
            console.log('protocol', protocol);
            expect(protocol).toEqual([
                'begin b b.a.1',
                'end b b.a.1',
                'begin b b.a.2',
                'end b b.a.2',
                'begin c c.a.1',
                'end c c.a.1',
                'begin c c.a.2',
                'end c c.a.2',
            ]);
        }

    })

    test('handleParallely', async () => {
        const mc = new MsgClient('a');

        {
            const resp: MsgResp = {
                type: 'success',
                rcv: {
                    b: {
                        cnt: 2,
                        msg: ['b.a.1', 'b.a.2']
                    },
                    c: {
                        cnt: 2,
                        msg: ['c.a.1', 'c.a.2']
                    }
                }
            }
            const protocol: string[] = [];
            await mc.handleParallely(resp, async (sender, msg) => {
                protocol.push('begin ' + sender + ' ' + msg);
                await new Promise<void>(res => {
                    setTimeout(() => {
                        res();
                    }, 200)
                })
                protocol.push('end ' + sender + ' ' + msg)
            })
            console.log('protocol after parallely', protocol);
            expect(protocol).toEqual([
                'begin b b.a.1',
                'begin b b.a.2',
                'begin c c.a.1',
                'begin c c.a.2',
                'end b b.a.1',
                'end b b.a.2',
                'end c c.a.1',
                'end c c.a.2',
            ]);
        }
    })
})