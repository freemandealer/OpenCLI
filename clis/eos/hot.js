import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
  site: 'eos',
  name: 'hot',
  description: 'eos hot (recorded)',
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
      fetch: {
        url: 'https://eos.douyin.com/data/life/live/card/list/?page=1&limit=${{ args.limit | default(20) }}&source=0&transform_type=1&room_id=0&key_word=&sub_source=0&cps_options_string=%7B%22is_hot_sold%22%3Afalse%2C%22is_live_only%22%3Afalse%2C%22sort_type%22%3A1%2C%22tags%22%3Anull%7D&next_cursor=0',
      },
    },
    { select: 'card_list' },
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
