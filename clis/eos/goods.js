import { EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { clampInt } from '../_shared/common.js';
import { CURRENT_LIVE_URL, DEFAULT_AGG_CARD_ID, buildAnchorShelvesUrl, clean, ensureEosSession, eosBrowserFetch, extractMetric, fetchCurrentAnchorShelves, formatMoneyFen, getCurrentLiveStatus } from './shared.js';

function buildTabMap(cardTabs) {
    const tabMap = new Map();
    const tabs = Array.isArray(cardTabs) ? cardTabs : [];
    for (const tab of tabs) {
        const tabName = clean(tab?.tab_name);
        const cardIds = Array.isArray(tab?.card_list) ? tab.card_list : [];
        if (!tabName || tabName === '全部' || cardIds.length === 0) {
            continue;
        }
        for (const rawCardId of cardIds) {
            const cardId = clean(rawCardId);
            if (!cardId) {
                continue;
            }
            const current = tabMap.get(cardId) ?? [];
            if (!current.includes(tabName)) {
                current.push(tabName);
                tabMap.set(cardId, current);
            }
        }
    }
    return tabMap;
}

function buildGoodsRows(payload, limit = Infinity) {
    const cards = Array.isArray(payload?.card_list) ? payload.card_list : [];
    const tabMap = buildTabMap(payload?.card_tab);
    return cards.slice(0, limit).map((item, index) => {
        const cardBase = item?.card_base_info ?? {};
        const productBase = item?.product_base_info ?? {};
        const stockInfo = item?.stock_info ?? {};
        const priceInfo = item?.price_info ?? {};
        const cpsInfo = item?.cps_info ?? {};
        const labelInfo = item?.label_info ?? {};
        const cardId = clean(cardBase.card_id || item?.card_id);
        return {
            rank: index + 1,
            product_id: clean(productBase.product_id),
            card_id: cardId,
            business_id: clean(cardBase.business_id),
            title: clean(productBase.name),
            price: formatMoneyFen(priceInfo.actual_price),
            origin_price: formatMoneyFen(priceInfo.origin_price),
            discount: clean(priceInfo.discount),
            commission: formatMoneyFen(cpsInfo.commission_num),
            commission_rate: clean(cpsInfo.commission_rate_display),
            sold: extractMetric(stockInfo.sold),
            stock: extractMetric(stockInfo.stock),
            poi: clean(productBase?.poi?.shop_info),
            labels: Array.isArray(labelInfo.right_list) ? labelInfo.right_list.map(clean).filter(Boolean).join(' | ') : '',
            tab: (tabMap.get(cardId) ?? []).join(' | '),
            is_showing: Boolean(cardBase.is_showing),
        };
    });
}

cli({
    site: 'eos',
    name: 'goods',
    description: '当前直播间货架商品列表',
    domain: 'eos.douyin.com',
    strategy: Strategy.COOKIE,
    browser: true,
    args: [
        { name: 'limit', type: 'int', default: 20, help: '返回商品数量（max 100）' },
    ],
    columns: ['rank', 'product_id', 'title', 'price', 'commission_rate', 'sold', 'tab', 'is_showing'],
    func: async (page, kwargs) => {
        const limit = clampInt(kwargs.limit, 20, 1, 100);
        await page.goto(CURRENT_LIVE_URL);
        await page.wait(2);
        await ensureEosSession(page);
        const { roomId, isLiving } = await getCurrentLiveStatus(page);
        if (!roomId || roomId === DEFAULT_AGG_CARD_ID || !isLiving) {
            throw new EmptyResultError('eos goods', '当前没有检测到正在直播的房间，请开播后重试。');
        }
        const shelves = await fetchCurrentAnchorShelves(page, roomId);
        return buildGoodsRows(shelves, limit);
    },
});

export const __test__ = {
    CURRENT_LIVE_URL,
    buildAnchorShelvesUrl,
    buildGoodsRows,
    buildTabMap,
    clean,
    extractMetric,
    formatMoneyFen,
};
