import { EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CURRENT_LIVE_URL, CARD_OPERATE, DEFAULT_AGG_CARD_ID, buildSwitchCardPayload, clean, ensureEosSession, eosBrowserFetch, fetchCurrentAnchorShelves, getCurrentLiveStatus, parsePositiveInt, resolveShelfCardByRank } from './shared.js';

function buildCancelExplainResultRow(rank, card, action, message) {
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

function resolveCancelTarget(shelves, rawRank) {
    if (rawRank !== undefined && rawRank !== null && rawRank !== '') {
        const rank = parsePositiveInt(rawRank, 'rank', '1');
        return {
            rank,
            card: resolveShelfCardByRank(shelves, rank),
        };
    }

    const cards = Array.isArray(shelves?.card_list) ? shelves.card_list : [];
    const currentIndex = cards.findIndex((card) => Boolean(card?.card_base_info?.is_showing));
    if (currentIndex < 0) {
        throw new EmptyResultError('eos cancel-explain', '当前没有正在讲解中的商品。');
    }

    return {
        rank: currentIndex + 1,
        card: cards[currentIndex],
    };
}

cli({
    site: 'eos',
    name: 'cancel-explain',
    aliases: ['stop-explain'],
    description: '取消第 N 个直播商品的讲解；不传 rank 时取消当前正在讲解的商品',
    domain: 'eos.douyin.com',
    strategy: Strategy.COOKIE,
    browser: true,
    args: [
        { name: 'rank', required: false, positional: true, help: '商品序号，从 1 开始；不传则取消当前正在讲解的商品' },
    ],
    columns: ['status', 'action', 'rank', 'title', 'product_id', 'card_id', 'is_showing', 'message'],
    func: async (page, kwargs) => {
        await page.goto(CURRENT_LIVE_URL);
        await page.wait(2);
        await ensureEosSession(page);

        const { roomId, isLiving } = await getCurrentLiveStatus(page);
        if (!roomId || roomId === DEFAULT_AGG_CARD_ID || !isLiving) {
            throw new EmptyResultError('eos cancel-explain', '当前没有检测到正在直播的房间，请开播后重试。');
        }

        const shelves = await fetchCurrentAnchorShelves(page, roomId);
        const { rank, card: targetCard } = resolveCancelTarget(shelves, kwargs.rank);
        const targetCardBase = targetCard?.card_base_info ?? {};
        if (!Boolean(targetCardBase.is_showing)) {
            return [buildCancelExplainResultRow(rank, targetCard, 'already_stopped', `商品 rank ${rank} 当前未在讲解中`)];
        }

        const payload = buildSwitchCardPayload(targetCard, roomId, CARD_OPERATE.CANCEL_SHOW);
        await eosBrowserFetch(page, 'POST', 'https://eos.douyin.com/data/life/live/card/switch/', { body: payload });

        const refreshedShelves = await fetchCurrentAnchorShelves(page, roomId);
        const refreshedTargetCard = resolveShelfCardByRank(refreshedShelves, rank);
        return [buildCancelExplainResultRow(rank, refreshedTargetCard, 'stopped', `已取消商品 rank ${rank} 的讲解`)];
    },
});

export const __test__ = {
    buildCancelExplainResultRow,
    resolveCancelTarget,
};
