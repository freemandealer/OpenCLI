import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRequiredError, EmptyResultError } from '@jackwener/opencli/errors';
import { getRegistry } from '@jackwener/opencli/registry';
import './cancel-explain.js';
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
        is_showing: true,
    },
    product_base_info: {
        product_id: '1830381930056720',
        name: '【中式特惠】排骨小粽一份',
    },
};

const SAMPLE_SHELVES = {
    card_list: [SAMPLE_CARD],
    status_code: 0,
    status_msg: '',
};

describe('eos cancel-explain', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('registers the cancel-explain command and alias', () => {
        const registry = getRegistry();
        const command = registry.get('eos/cancel-explain');
        expect(command).toBeDefined();
        expect(command?.columns).toContain('action');
        expect(command?.columns).toContain('message');
        expect(command?.args[0]?.required).toBe(false);
        expect(registry.get('eos/stop-explain')).toBe(command);
    });

    it('builds the correct cancel switch payload', () => {
        expect(buildSwitchCardPayload(SAMPLE_CARD, '7629629338887457562', CARD_OPERATE.CANCEL_SHOW)).toEqual({
            card_id: '7497252714754181929',
            room_id: '7629629338887457562',
            operation: 4,
            auth_type: 7,
        });
    });

    it('returns already_stopped without switching when the card is not showing', async () => {
        const registry = getRegistry();
        const command = registry.get('eos/cancel-explain');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos cancel-explain command not registered');
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
                                is_showing: false,
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
                action: 'already_stopped',
                rank: 1,
                title: '【中式特惠】排骨小粽一份',
                is_showing: false,
            }),
        ]);
    });

    it('cancels the target card by rank and returns the refreshed state', async () => {
        const registry = getRegistry();
        const command = registry.get('eos/cancel-explain');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos cancel-explain command not registered');
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
                                is_showing: false,
                            },
                        },
                    ],
                }),
        };

        const rows = await command.func(page, { rank: 1 });

        expect(rows).toEqual([
            expect.objectContaining({
                status: 'success',
                action: 'stopped',
                rank: 1,
                title: '【中式特惠】排骨小粽一份',
                is_showing: false,
            }),
        ]);
    });

    it('cancels the current showing card when rank is omitted', async () => {
        const registry = getRegistry();
        const command = registry.get('eos/cancel-explain');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos cancel-explain command not registered');
        }

        const firstCard = {
            ...SAMPLE_CARD,
            card_base_info: {
                ...SAMPLE_CARD.card_base_info,
                card_id: '111',
                is_showing: false,
            },
            product_base_info: {
                ...SAMPLE_CARD.product_base_info,
                product_id: 'prod-1',
                name: '第一个商品',
            },
        };
        const secondCard = {
            ...SAMPLE_CARD,
            card_base_info: {
                ...SAMPLE_CARD.card_base_info,
                card_id: '222',
                is_showing: true,
            },
            product_base_info: {
                ...SAMPLE_CARD.product_base_info,
                product_id: 'prod-2',
                name: '第二个商品',
            },
        };

        const page = {
            goto: vi.fn(),
            wait: vi.fn(),
            evaluate: vi.fn()
                .mockResolvedValueOnce('退出登录')
                .mockResolvedValueOnce(SAMPLE_STATUS)
                .mockResolvedValueOnce({
                    ...SAMPLE_SHELVES,
                    card_list: [firstCard, secondCard],
                })
                .mockResolvedValueOnce({ status_code: 0, status_msg: '' })
                .mockResolvedValueOnce({
                    ...SAMPLE_SHELVES,
                    card_list: [
                        firstCard,
                        {
                            ...secondCard,
                            card_base_info: {
                                ...secondCard.card_base_info,
                                is_showing: false,
                            },
                        },
                    ],
                }),
        };

        const rows = await command.func(page, {});

        expect(rows).toEqual([
            expect.objectContaining({
                status: 'success',
                action: 'stopped',
                rank: 2,
                title: '第二个商品',
                product_id: 'prod-2',
                card_id: '222',
                is_showing: false,
            }),
        ]);
    });

    it('throws when rank is omitted and there is no current showing card', async () => {
        const registry = getRegistry();
        const command = registry.get('eos/cancel-explain');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos cancel-explain command not registered');
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
                                is_showing: false,
                            },
                        },
                    ],
                }),
        };

        await expect(command.func(page, {})).rejects.toBeInstanceOf(EmptyResultError);
    });

    it('surfaces auth-required state from the page text', async () => {
        const registry = getRegistry();
        const command = registry.get('eos/cancel-explain');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos cancel-explain command not registered');
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
        const command = registry.get('eos/cancel-explain');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos cancel-explain command not registered');
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
});
