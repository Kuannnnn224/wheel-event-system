import { DemoTokenService } from './demo-token.service';

const player = {
  id: 'player-id',
  externalId: 'demo-player-001',
};

function createService(configValues: Record<string, string | undefined> = {}) {
  const demoSessionRepository = {
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => input),
    findOne: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string, defaultValue?: string) => configValues[key] ?? defaultValue),
  };
  const playersService = {
    getOrCreateByExternalId: jest.fn().mockResolvedValue(player),
    getDailyProgress: jest.fn(),
  };
  const probabilityService = {
    getStages: jest.fn(),
  };

  return {
    service: new DemoTokenService(
      demoSessionRepository as never,
      configService as never,
      playersService as never,
      probabilityService as never,
    ),
    demoSessionRepository,
  };
}

describe('DemoTokenService webview urls', () => {
  it('builds demo webview links from the request origin when no fixed base url is configured', async () => {
    const { service } = createService({ WEBVIEW_BASE_URL: '' });

    const result = await service.createSession('demo-player-001', {
      origin: 'http://192.168.1.50:5173',
    });

    const url = new URL(result.webviewUrl);
    expect(`${url.protocol}//${url.host}${url.pathname}`).toBe('http://192.168.1.50:5173/webview.html');
    expect(url.searchParams.get('token')).toBe(result.token);
  });

  it('keeps configured webview base url ahead of request origin', async () => {
    const { service } = createService({
      WEBVIEW_BASE_URL: 'https://wheel.example.com/webview.html',
    });

    const result = await service.createSession('demo-player-001', {
      origin: 'http://192.168.1.50:5173',
    });

    expect(result.webviewUrl).toMatch(/^https:\/\/wheel\.example\.com\/webview\.html\?token=/);
  });

  it('returns same-origin api proxy path by default for webview client config', () => {
    const { service } = createService();

    expect(service.getClientConfig()).toEqual({ apiBaseUrl: '/api' });
  });

  it('allows overriding the webview api base url', () => {
    const { service } = createService({
      WEBVIEW_API_BASE_URL: 'https://api.example.com',
    });

    expect(service.getClientConfig()).toEqual({ apiBaseUrl: 'https://api.example.com' });
  });
});
