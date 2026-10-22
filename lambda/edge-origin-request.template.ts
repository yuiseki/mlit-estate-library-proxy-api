export const handler = async (event: any): Promise<any> => {
  const request = event.Records[0].cf.request;

  // OPTIONSリクエストならプリフライト応答
  if (request.method === 'OPTIONS') {
    return {
      status: '200',
      statusDescription: 'OK',
      headers: {
        'access-control-allow-origin': [{ key: 'Access-Control-Allow-Origin', value: '*' }],
        'access-control-allow-methods': [{ key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS' }],
        'access-control-allow-headers': [{ key: 'Access-Control-Allow-Headers', value: '*' }],
        'access-control-max-age': [{ key: 'Access-Control-Max-Age', value: '86400' }],
      },
      body: '',
    };
  }

  // 転送するのはタイル API（XPT/XKT/XGT/XST）の {z}/{x}/{y}.pbf 形式だけ
  // それ以外はAPIキーを付ける前に拒否する
  const regex = /^(\/ex-api\/external\/X[PKGS]T\d{3})\/(\d+)\/(\d+)\/(\d+)\.pbf$/;
  const match = request.uri.match(regex);

  if (!match) {
    return {
      status: '403',
      statusDescription: 'Forbidden',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'text/plain' }],
      },
      body: 'Forbidden',
    };
  }

  const basePath = match[1];
  const z = match[2];
  const x = match[3];
  const y = match[4];

  const query = new URLSearchParams(request.querystring);
  query.set('response_format', 'pbf');
  query.set('z', z);
  query.set('x', x);
  query.set('y', y);

  request.uri = basePath;
  request.querystring = query.toString();

  // APIキーをヘッダーに追加
  request.headers['ocp-apim-subscription-key'] = [
    { key: 'Ocp-Apim-Subscription-Key', value: '__API_KEY__' },
  ];

  return request;
};
