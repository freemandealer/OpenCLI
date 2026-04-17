import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
  site: 'eos',
  name: 'data_2',
  description: 'eos data_2 (recorded write)',
  domain: 'eos.douyin.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['has_quest_tab', 'status_code', 'status_msg'],
  pipeline: [
    { navigate: 'https://eos.douyin.com/livesite/live/current' },
    {
      evaluate: `(async () => {
  const res = await fetch('/data/life/live/quest/config/', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      product_id_list: [
        '1830381930056720',
        '1843672721130555',
        '1822223874205724',
        '1835004028309530',
        '1832920985523210',
        '1780889667168272',
        '1806715423659124',
        '1843673677810700',
        '1806638198343716',
        '1806524397578251',
        '1843671607089203',
        '1843671954101252',
        '1843672234501168',
        '1843672464393235',
        '1801088035303468',
        '1829741965439019',
      ],
      room_id: '7629629338887457562',
    }),
  });
  return await res.json();
})()`,
    },
  ],
});
