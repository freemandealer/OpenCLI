import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { getRegistry } from '@jackwener/opencli/registry';
import './explain.js';
import { __test__ } from './explain.js';
import { buildSwitchCardPayload, CARD_OPERATE, CURRENT_LIVE_URL } from './shared.js';

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
        is_showing: false,
    },
    product_base_info: {
        product_id: '1830381930056720',
        name: '【中式特惠】排骨小粽一份',
    },
    stock_info: {
        stock_num: 9999999837,
    },
};

const SAMPLE_SHELVES = {
    card_list: [SAMPLE_CARD],
    status_code: 0,
    status_msg: '',
};

describe('eos explain', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('registers the explain command', () => {
        const registry = getRegistry();
        const command = [...registry.values()].find((cmd) => cmd.site === 'eos' && cmd.name === 'explain');
        expect(command).toBeDefined();
        expect(command?.columns).toContain('action');
        expect(command?.columns).toContain('message');
    });

    it('builds the correct switch payload', () => {
        expect(buildSwitchCardPayload(SAMPLE_CARD, '7629629338887457562', CARD_OPERATE.SHOW)).toEqual({
            card_id: '7497252714754181929',
            room_id: '7629629338887457562',
            operation: 3,
            auth_type: 7,
        });
    });

    it('returns already_talking without switching when the card is already showing', async () => {
        const registry = getRegistry();
        const command = [...registry.values()].find((cmd) => cmd.site === 'eos' && cmd.name === 'explain');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos explain command not registered');
        }

        const page = {
            goto: vi.fn(),
            wait: vi.fn(),
            evaluate: vi.fn()
                .mockResolvedValueOnce('退出登录')
                .mockResolvedValueOnce(SAMPLE_STATUS)
                .mockResolvedValueOnce({
                    ...SAMPLE_SHELVES,
                    card_list: [
                        {
                            ...SAMPLE_CARD,
                            card_base_info: {
                                ...SAMPLE_CARD.card_base_info,
                                is_showing: true,
                            },
                        },
                    ],
                }),
        };

        const rows = await command.func(page, { rank: 1 });
        expect(page.goto).toHaveBeenCalledWith(CURRENT_LIVE_URL);
        expect(rows).toEqual([
            expect.objectContaining({
                status: 'success',
                action: 'already_talking',
                rank: 1,
                title: '【中式特惠】排骨小粽一份',
                is_showing: true,
            }),
        ]);
    });

    it('switches the target card by rank and returns the refreshed state', async () => {
        const registry = getRegistry();
        const command = [...registry.values()].find((cmd) => cmd.site === 'eos' && cmd.name === 'explain');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos explain command not registered');
        }

        const page = {
            goto: vi.fn(),
            wait: vi.fn(),
            evaluate: vi.fn()
                .mockResolvedValueOnce('退出登录')
                .mockResolvedValueOnce(SAMPLE_STATUS)
                .mockResolvedValueOnce(SAMPLE_SHELVES)
                .mockResolvedValueOnce({ status_code: 0, status_msg: '' })
                .mockResolvedValueOnce({
                    ...SAMPLE_SHELVES,
                    card_list: [
                        {
                            ...SAMPLE_CARD,
                            card_base_info: {
                                ...SAMPLE_CARD.card_base_info,
                                is_showing: true,
                            },
                        },
                    ],
                }),
        };

        const rows = await command.func(page, { rank: 1 });

        expect(rows).toEqual([
            expect.objectContaining({
                status: 'success',
                action: 'started',
                rank: 1,
                title: '【中式特惠】排骨小粽一份',
                is_showing: true,
            }),
        ]);
    });

    it('surfaces auth-required state from the page text', async () => {
        const registry = getRegistry();
        const command = [...registry.values()].find((cmd) => cmd.site === 'eos' && cmd.name === 'explain');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos explain command not registered');
        }

        const page = {
            goto: vi.fn(),
            wait: vi.fn(),
            evaluate: vi.fn().mockResolvedValueOnce('请登录后继续'),
        };

        await expect(command.func(page, { rank: 1 })).rejects.toBeInstanceOf(AuthRequiredError);
    });

    it('throws when there is no active live room', async () => {
        const registry = getRegistry();
        const command = [...registry.values()].find((cmd) => cmd.site === 'eos' && cmd.name === 'explain');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos explain command not registered');
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

        await expect(command.func(page, { rank: 1 })).rejects.toBeInstanceOf(EmptyResultError);
    });

    it('throws when the target card has no stock', () => {
        expect(() => __test__.assertCardCanExplain({
            stock_info: {
                stock_num: 0,
            },
        })).toThrow(CommandExecutionError);
    });
});
