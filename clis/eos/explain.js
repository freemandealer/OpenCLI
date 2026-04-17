import { CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CURRENT_LIVE_URL, CARD_OPERATE, DEFAULT_AGG_CARD_ID, buildSwitchCardPayload, clean, ensureEosSession, eosBrowserFetch, fetchCurrentAnchorShelves, getCurrentLiveStatus, parsePositiveInt, resolveShelfCardByRank } from './shared.js';

function buildExplainResultRow(rank, card, action, message) {
    const cardBase = card?.card_base_info ?? {};
    const productBase = card?.product_base_info ?? {};
    return {
        status: 'success',
        action,
        rank,
        title: clean(productBase.name),
        product_id: clean(productBase.product_id),
        card_id: clean(cardBase.card_id || card?.card_id),
        is_showing: Boolean(cardBase.is_showing),
        message,
    };
}

function assertCardCanExplain(card) {
    const stockNum = Number(card?.stock_info?.stock_num);
    if (Number.isFinite(stockNum) && stockNum <= 0) {
        throw new CommandExecutionError('EOS explain requires an in-stock product', '仅可讲解有库存的商品');
    }
}

cli({
    site: 'eos',
    name: 'explain',
    description: '开始讲解第 N 个直播商品（按 goods 的 rank）',
    domain: 'eos.douyin.com',
    strategy: Strategy.COOKIE,
    browser: true,
    args: [
        { name: 'rank', required: true, positional: true, help: '商品序号，从 1 开始，对应 eos goods 的 rank' },
    ],
    columns: ['status', 'action', 'rank', 'title', 'product_id', 'card_id', 'is_showing', 'message'],
    func: async (page, kwargs) => {
        const rank = parsePositiveInt(kwargs.rank, 'rank', '1');
        await page.goto(CURRENT_LIVE_URL);
        await page.wait(2);
        await ensureEosSession(page);

        const { roomId, isLiving } = await getCurrentLiveStatus(page);
        if (!roomId || roomId === DEFAULT_AGG_CARD_ID || !isLiving) {
            throw new EmptyResultError('eos explain', '当前没有检测到正在直播的房间，请开播后重试。');
        }

        const shelves = await fetchCurrentAnchorShelves(page, roomId);
        const targetCard = resolveShelfCardByRank(shelves, rank);
        const targetCardBase = targetCard?.card_base_info ?? {};
        if (Boolean(targetCardBase.is_showing)) {
            return [buildExplainResultRow(rank, targetCard, 'already_talking', `商品 rank ${rank} 已在讲解中`)];
        }

        assertCardCanExplain(targetCard);
        const payload = buildSwitchCardPayload(targetCard, roomId, CARD_OPERATE.SHOW);
        await eosBrowserFetch(page, 'POST', 'https://eos.douyin.com/data/life/live/card/switch/', { body: payload });

        const refreshedShelves = await fetchCurrentAnchorShelves(page, roomId);
        const refreshedTargetCard = resolveShelfCardByRank(refreshedShelves, rank);
        return [buildExplainResultRow(rank, refreshedTargetCard, 'started', `已开始讲解商品 rank ${rank}`)];
    },
});

export const __test__ = {
    assertCardCanExplain,
    buildExplainResultRow,
};
