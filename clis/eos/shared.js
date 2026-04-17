import { ArgumentError, AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';

export const CURRENT_LIVE_URL = 'https://eos.douyin.com/livesite/live/current';
export const DEFAULT_AGG_CARD_ID = '0';
export const DEFAULT_REQ_SOURCE = 'pc_current';
export const CARD_OPERATE = {
    SHOW: 3,
    CANCEL_SHOW: 4,
};

const LOGIN_REQUIRED_PATTERN = /扫码登录|请登录|登录后/;

export function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function formatMoneyFen(value) {
    const fen = Number(value);
    if (!Number.isFinite(fen)) {
        return '';
    }
    const normalized = (fen / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    return `¥${normalized}`;
}

export function extractMetric(value) {
    if (Array.isArray(value)) {
        return clean(value[1] ?? value[0] ?? '');
    }
    return clean(value);
}

export function parsePositiveInt(value, label, example) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new ArgumentError(`${label} must be a positive integer`, `Pass a numeric ${label}, for example: ${example}`);
    }
    return parsed;
}

export function buildAnchorShelvesUrl(roomId) {
    const params = new URLSearchParams({
        agg_card_id: DEFAULT_AGG_CARD_ID,
        room_id: String(roomId),
        req_source: DEFAULT_REQ_SOURCE,
        with_promotion_price_type: 'true',
    });
    return `https://eos.douyin.com/data/life/live/shelves/anchor/?${params.toString()}`;
}

export async function eosBrowserFetch(page, method, url, options = {}) {
    const js = `
      (async () => {
        const response = await fetch(${JSON.stringify(url)}, {
          method: ${JSON.stringify(method)},
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...${JSON.stringify(options.headers ?? {})}
          },
          ${options.body ? `body: JSON.stringify(${JSON.stringify(options.body)}),` : ''}
        });
        return response.json();
      })()
    `;
    const result = await page.evaluate(js);
    if (result && typeof result === 'object' && 'status_code' in result) {
        const code = Number(result.status_code);
        if (Number.isFinite(code) && code !== 0) {
            const msg = clean(result.status_msg || 'unknown error');
            const hint = result.show_pop_up ? '请稍后再试，避免频繁切换讲解。' : undefined;
            throw new CommandExecutionError(`EOS API error ${code}: ${msg}`, hint);
        }
    }
    return result;
}

export async function ensureEosSession(page) {
    const pageText = clean(await page.evaluate('document.body?.innerText || ""'));
    if (LOGIN_REQUIRED_PATTERN.test(pageText)) {
        throw new AuthRequiredError('eos.douyin.com', 'EOS 命令需要已登录的浏览器会话');
    }
    return pageText;
}

export async function getCurrentLiveStatus(page) {
    const status = await eosBrowserFetch(page, 'GET', 'https://eos.douyin.com/data/life/live/status/');
    const roomId = clean(status?.data?.room_id);
    const isLiving = Number(status?.data?.status) === 1;
    return {
        payload: status,
        roomId,
        isLiving,
    };
}

export async function fetchCurrentAnchorShelves(page, roomId) {
    return eosBrowserFetch(page, 'GET', buildAnchorShelvesUrl(roomId));
}

export function resolveShelfCardByRank(shelves, rank) {
    const cards = Array.isArray(shelves?.card_list) ? shelves.card_list : [];
    if (rank < 1 || rank > cards.length) {
        throw new ArgumentError(`rank must be between 1 and ${cards.length || 1}`, 'Use "opencli eos goods -f json" to inspect the current goods ranks first.');
    }
    return cards[rank - 1];
}

export function buildSwitchCardPayload(card, roomId, operation) {
    const cardBase = card?.card_base_info ?? {};
    return {
        card_id: clean(cardBase.card_id || card?.card_id),
        room_id: clean(roomId),
        operation,
        auth_type: cardBase.auth_type,
    };
}
