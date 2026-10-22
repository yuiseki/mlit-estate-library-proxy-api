import { handler } from '../lambda/edge-origin-request.template';

const makeEvent = (uri: string, querystring = '', method = 'GET') => ({
  Records: [
    {
      cf: {
        request: { method, uri, querystring, headers: {} as Record<string, any> },
      },
    },
  ],
});

describe('edge-origin-request', () => {
  test.each([
    '/ex-api/external/XPT001/13/7276/3225.pbf',
    '/ex-api/external/XPT002/13/7276/3225.pbf',
    '/ex-api/external/XKT002/15/29105/12903.pbf',
    '/ex-api/external/XGT001/14/14552/6451.pbf',
    '/ex-api/external/XST001/14/14552/6451.pbf',
  ])('rewrites and signs tile request %s', async (uri) => {
    const result = await handler(makeEvent(uri, 'from=20223&to=20234'));
    const query = new URLSearchParams(result.querystring);

    expect(result.uri).toBe(uri.replace(/\/\d+\/\d+\/\d+\.pbf$/, ''));
    expect(query.get('from')).toBe('20223');
    expect(query.get('to')).toBe('20234');
    expect(query.get('response_format')).toBe('pbf');
    expect(query.get('z')).toMatch(/^\d+$/);
    expect(query.get('x')).toMatch(/^\d+$/);
    expect(query.get('y')).toMatch(/^\d+$/);
    expect(result.headers['ocp-apim-subscription-key']).toEqual([
      { key: 'Ocp-Apim-Subscription-Key', value: '__API_KEY__' },
    ]);
  });

  test('viewer cannot override the tile coordinates or format', async () => {
    const result = await handler(
      makeEvent('/ex-api/external/XPT001/13/7276/3225.pbf', 'response_format=geojson&z=1&x=1&y=1'),
    );
    const query = new URLSearchParams(result.querystring);

    expect(query.get('response_format')).toBe('pbf');
    expect(query.get('z')).toBe('13');
    expect(query.get('x')).toBe('7276');
    expect(query.get('y')).toBe('3225');
  });

  test.each([
    // non-tile JSON APIs
    ['/ex-api/external/XIT001', 'year=2023&area=13'],
    ['/ex-api/external/XIT002', 'area=13'],
    ['/ex-api/external/XCT001', ''],
    // non-tile APIs disguised as tiles
    ['/ex-api/external/XIT001/13/7276/3225.pbf', 'year=2023&area=13'],
    ['/ex-api/external/XCT001/13/7276/3225.pbf', ''],
    // tile APIs without the tile form
    ['/ex-api/external/XPT001', 'response_format=geojson&z=13&x=7276&y=3225'],
    // other paths on the upstream host
    ['/', ''],
    ['/help/apiManual/', ''],
    ['/ex-api/external/XPT001/../XIT001/13/7276/3225.pbf', ''],
    ['/ex-api/external/XPT001/extra/13/7276/3225.pbf', ''],
    ['/ex-api/external/xpt001/13/7276/3225.pbf', ''],
  ])('rejects %s without the key', async (uri, querystring) => {
    const event = makeEvent(uri, querystring);
    const result = await handler(event);

    expect(result.status).toBe('403');
    expect(result.headers['ocp-apim-subscription-key']).toBeUndefined();
    expect(event.Records[0].cf.request.headers['ocp-apim-subscription-key']).toBeUndefined();
  });

  test('answers preflight requests without contacting the origin', async () => {
    const result = await handler(makeEvent('/anything', '', 'OPTIONS'));

    expect(result.status).toBe('200');
    expect(result.headers['access-control-allow-origin']).toEqual([
      { key: 'Access-Control-Allow-Origin', value: '*' },
    ]);
  });
});
