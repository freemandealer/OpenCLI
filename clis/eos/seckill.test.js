import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { getRegistry } from '@jackwener/opencli/registry';
import './seckill.js';
import { __test__ } from './seckill.js';
import { CURRENT_LIVE_URL } from './shared.js';

const SAMPLE_STATUS = {
    data: {
        status: 1,
        room_id: '7629629338887457562',
    },
    status_code: 0,
    status_msg: '',
};

const SAMPLE_CARD = {
    card_base_info: {
        card_id: '7497252714754181929',
        auth_type: 7,
    },
    product_base_info: {
        product_id: '1830381930056720',
        name: '【中式特惠】排骨小粽一份',
    },
    stock_info: {
        stock_num: 30,
    },
};

const SAMPLE_SHELVES = {
    card_list: [SAMPLE_CARD],
    status_code: 0,
    status_msg: '',
};

describe('eos seckill', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('registers the seckill command and alias', () => {
        const registry = getRegistry();
        const command = registry.get('eos/seckill');
        expect(command).toBeDefined();
        expect(command?.columns).toContain('deploy_stock');
        expect(command?.columns).toContain('activity_id');
        expect(registry.get('eos/drop-spike')).toBe(command);
    });

    it('submits the seckill popup for the target card rank', async () => {
        const registry = getRegistry();
        const command = registry.get('eos/seckill');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos seckill command not registered');
        }

        const page = {
            goto: vi.fn(),
            wait: vi.fn(),
            evaluate: vi.fn()
                .mockResolvedValueOnce('退出登录')
                .mockResolvedValueOnce(SAMPLE_STATUS)
                .mockResolvedValueOnce(SAMPLE_SHELVES),
            evaluateWithArgs: vi.fn().mockResolvedValueOnce({
                ok: true,
                action: 'submitted',
                verified: true,
                message: '已提交秒杀投放',
                capture: {
                    response: {
                        status_code: 0,
                        status_msg: '',
                        data: {
                            discount_activity_id: '7613705061528799295',
                        },
                    },
                },
            }),
        };

        const rows = await command.func(page, { rank: 1, stock: 10 });

        expect(page.goto).toHaveBeenCalledWith(CURRENT_LIVE_URL);
        expect(page.evaluateWithArgs).toHaveBeenCalledTimes(1);
        expect(rows).toEqual([
            expect.objectContaining({
                status: 'success',
                action: 'submitted',
                rank: 1,
                title: '【中式特惠】排骨小粽一份',
                product_id: '1830381930056720',
                card_id: '7497252714754181929',
                deploy_stock: 10,
                limit_per_user: 99,
                duration: '60分钟',
                activity_id: '7613705061528799295',
            }),
        ]);
    });

    it('uses native text input when the page supports it', async () => {
        const registry = getRegistry();
        const command = registry.get('eos/seckill');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos seckill command not registered');
        }

        const page = {
            goto: vi.fn(),
            wait: vi.fn(),
            insertText: vi.fn(),
            nativeKeyPress: vi.fn(),
            evaluate: vi.fn()
                .mockResolvedValueOnce('退出登录')
                .mockResolvedValueOnce(SAMPLE_STATUS)
                .mockResolvedValueOnce(SAMPLE_SHELVES),
            evaluateWithArgs: vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    stage: 'prepare',
                    snapshot: {
                        fields: {
                            deployStock: '0',
                            limitPerUser: '0',
                        },
                    },
                })
                .mockResolvedValueOnce({
                    ok: true,
                    stage: 'focus-input',
                    snapshot: {
                        fields: {
                            deployStock: '0',
                            limitPerUser: '0',
                        },
                    },
                })
                .mockResolvedValueOnce({
                    ok: true,
                    stage: 'read-state',
                    snapshot: {
                        fields: {
                            deployStock: '10',
                            limitPerUser: '0',
                        },
                    },
                })
                .mockResolvedValueOnce({
                    ok: true,
                    stage: 'focus-input',
                    snapshot: {
                        fields: {
                            deployStock: '10',
                            limitPerUser: '0',
                        },
                    },
                })
                .mockResolvedValueOnce({
                    ok: true,
                    stage: 'read-state',
                    snapshot: {
                        fields: {
                            deployStock: '10',
                            limitPerUser: '99',
                        },
                    },
                })
                .mockResolvedValueOnce({
                    ok: true,
                    action: 'submitted',
                    verified: true,
                    message: '已提交秒杀投放',
                    capture: {
                        response: {
                            status_code: 0,
                            status_msg: '',
                            data: {
                                discount_activity_id: '7613705061528799295',
                            },
                        },
                    },
                }),
        };

        const rows = await command.func(page, { rank: 1, stock: 10 });

        expect(page.evaluateWithArgs).toHaveBeenCalledTimes(6);
        expect(page.insertText).toHaveBeenNthCalledWith(1, '10');
        expect(page.insertText).toHaveBeenNthCalledWith(2, '99');
        expect(page.nativeKeyPress).toHaveBeenNthCalledWith(1, 'Tab');
        expect(page.nativeKeyPress).toHaveBeenNthCalledWith(2, 'Tab');
        expect(rows).toEqual([
            expect.objectContaining({
                status: 'success',
                action: 'submitted',
                rank: 1,
                deploy_stock: 10,
                limit_per_user: 99,
                duration: '60分钟',
                activity_id: '7613705061528799295',
            }),
        ]);
    });

    it('includes recovery flow for existing seckill surfaces', () => {
        const js = __test__.buildSeckillUiAutomationJs();
        expect(js).toContain('live-detail');
        expect(js).toContain('停止投放');
        expect(js).toContain('reopened seckill button after stop');
    });

    it('surfaces auth-required state from the page text', async () => {
        const registry = getRegistry();
        const command = registry.get('eos/seckill');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos seckill command not registered');
        }

        const page = {
            goto: vi.fn(),
            wait: vi.fn(),
            evaluate: vi.fn().mockResolvedValueOnce('请登录后继续'),
        };

        await expect(command.func(page, { rank: 1, stock: 10 })).rejects.toBeInstanceOf(AuthRequiredError);
    });

    it('throws when there is no active live room', async () => {
        const registry = getRegistry();
        const command = registry.get('eos/seckill');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos seckill command not registered');
        }

        const page = {
            goto: vi.fn(),
            wait: vi.fn(),
            evaluate: vi.fn()
                .mockResolvedValueOnce('')
                .mockResolvedValueOnce({
                    data: {
                        status: 0,
                        room_id: '0',
                    },
                    status_code: 0,
                    status_msg: '',
                }),
        };

        await expect(command.func(page, { rank: 1, stock: 10 })).rejects.toBeInstanceOf(EmptyResultError);
    });

    it('throws when the target card stock is insufficient', () => {
        expect(() => __test__.assertCardCanSeckill({
            stock_info: {
                stock_num: 5,
            },
        }, 6)).toThrow(CommandExecutionError);
    });

    it('throws when the captured save response is a failure', () => {
        expect(() => __test__.assertSaveResponseSucceeded({
            capture: {
                response: {
                    status_code: 1234,
                    status_msg: '秒杀活动不可用',
                },
            },
        })).toThrow(CommandExecutionError);
    });
});
