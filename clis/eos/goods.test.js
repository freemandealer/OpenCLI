import { describe, expect, it, vi } from 'vitest';
import { AuthRequiredError, EmptyResultError } from '@jackwener/opencli/errors';
import { getRegistry } from '@jackwener/opencli/registry';
import './goods.js';
import { __test__ } from './goods.js';

const SAMPLE_STATUS = {
    data: {
        status: 1,
        room_id: '7629629338887457562',
    },
    status_code: 0,
    status_msg: '',
};

const SAMPLE_SHELVES = {
    card_list: [
        {
            card_base_info: {
                card_id: '7497252714754181929',
                business_id: '7520248054661056524',
                is_showing: true,
            },
            product_base_info: {
                product_id: '1830381930056720',
                name: '【中式特惠】排骨小粽一份',
                poi: {
                    shop_info: '台州市法兰奇·西餐经典台州菜 2家门店可用',
                },
            },
            stock_info: {
                sold: ['已售', '477'],
                stock: ['库存', '99万+'],
            },
            price_info: {
                actual_price: 4800,
                origin_price: 5800,
                discount: '8.3折',
            },
            cps_info: {
                commission_num: 240,
                commission_rate_display: '佣金率5%',
            },
            label_info: {
                right_list: ['随时退', '免预约'],
            },
        },
    ],
    card_tab: [
        {
            tab_name: '全部',
            card_list: ['7497252714754181929'],
        },
        {
            tab_name: '单人餐',
            card_list: ['7497252714754181929'],
        },
    ],
    status_code: 0,
    status_msg: '',
};

describe('eos goods', () => {
    it('registers the goods command', () => {
        const registry = getRegistry();
        const command = [...registry.values()].find((cmd) => cmd.site === 'eos' && cmd.name === 'goods');
        expect(command).toBeDefined();
        expect(command?.columns).toContain('product_id');
        expect(command?.columns).toContain('is_showing');
    });

    it('builds a current-live shelves url', () => {
        expect(__test__.buildAnchorShelvesUrl('7629629338887457562')).toBe('https://eos.douyin.com/data/life/live/shelves/anchor/?agg_card_id=0&room_id=7629629338887457562&req_source=pc_current&with_promotion_price_type=true');
    });

    it('maps shelf cards into goods rows', () => {
        expect(__test__.buildGoodsRows(SAMPLE_SHELVES, 10)).toEqual([
            {
                rank: 1,
                product_id: '1830381930056720',
                card_id: '7497252714754181929',
                business_id: '7520248054661056524',
                title: '【中式特惠】排骨小粽一份',
                price: '¥48',
                origin_price: '¥58',
                discount: '8.3折',
                commission: '¥2.4',
                commission_rate: '佣金率5%',
                sold: '477',
                stock: '99万+',
                poi: '台州市法兰奇·西餐经典台州菜 2家门店可用',
                labels: '随时退 | 免预约',
                tab: '单人餐',
                is_showing: true,
            },
        ]);
    });

    it('fetches and returns current live goods', async () => {
        const registry = getRegistry();
        const command = [...registry.values()].find((cmd) => cmd.site === 'eos' && cmd.name === 'goods');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos goods command not registered');
        }

        const page = {
            goto: vi.fn(),
            wait: vi.fn(),
            evaluate: vi.fn()
                .mockResolvedValueOnce('退出登录')
                .mockResolvedValueOnce(SAMPLE_STATUS)
                .mockResolvedValueOnce(SAMPLE_SHELVES),
        };

        const rows = await command.func(page, { limit: 20 });

        expect(page.goto).toHaveBeenCalledWith(__test__.CURRENT_LIVE_URL);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            product_id: '1830381930056720',
            title: '【中式特惠】排骨小粽一份',
            price: '¥48',
            tab: '单人餐',
            is_showing: true,
        });
    });

    it('surfaces auth-required state from the page text', async () => {
        const registry = getRegistry();
        const command = [...registry.values()].find((cmd) => cmd.site === 'eos' && cmd.name === 'goods');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos goods command not registered');
        }

        const page = {
            goto: vi.fn(),
            wait: vi.fn(),
            evaluate: vi.fn().mockResolvedValueOnce('请登录后继续'),
        };

        await expect(command.func(page, { limit: 20 })).rejects.toBeInstanceOf(AuthRequiredError);
    });

    it('throws when there is no active live room', async () => {
        const registry = getRegistry();
        const command = [...registry.values()].find((cmd) => cmd.site === 'eos' && cmd.name === 'goods');
        expect(command?.func).toBeDefined();
        if (!command?.func) {
            throw new Error('eos goods command not registered');
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

        await expect(command.func(page, { limit: 20 })).rejects.toBeInstanceOf(EmptyResultError);
    });
});
