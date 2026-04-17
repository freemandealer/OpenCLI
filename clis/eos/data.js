import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
  site: 'eos',
  name: 'data',
  description: 'eos data (recorded)',
  domain: 'eos.douyin.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int', default: 20, help: 'Number of items' },
  ],
  columns: ['rank', 'title', 'url'],
  pipeline: [
    { navigate: 'https://eos.douyin.com/livesite/live/current' },
    {
      evaluate: `(async () => {
  const res = await fetch('/data/life/live/marketing/items/status/?room_id=7629629338887457562', {
    credentials: 'include',
  });
  const data = await res.json();
  return data?.items || [];
})()`,
    },
    {
      map: {
        rank: '${{ index + 1 }}',
        title: '${{ item.title }}',
        url: '${{ item.url | default("") }}',
      },
    },
    { limit: '${{ args.limit | default(20) }}' },
  ],
});
