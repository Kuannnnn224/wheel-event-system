import { DemoTokenService } from './demo-token.service';

const stageThresholds = [
  { stageNumber: 1, turnoverThresholdPoints: 500 },
  { stageNumber: 2, turnoverThresholdPoints: 5000 },
  { stageNumber: 3, turnoverThresholdPoints: 20000 },
  { stageNumber: 4, turnoverThresholdPoints: 50000 },
  { stageNumber: 5, turnoverThresholdPoints: 100000 },
];

const player = {
  id: 'player-id',
  externalId: 'demo-player-001',
};

function createService(configValues: Record<string, string | undefined> = {}) {
  const progressRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => input),
  };
  const demoSessionRepository = {
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => input),
    findOne: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity.name === 'PlayerDailyProgress') return progressRepository;
      if (entity.name === 'DemoSession') return demoSessionRepository;
      throw new Error(`Unexpected repository: ${entity.name}`);
    }),
  };
  const dataSource = {
    transaction: jest.fn((callback: (transactionManager: typeof manager) => Promise<unknown>) => callback(manager)),
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
    getStageThresholds: jest.fn().mockResolvedValue(stageThresholds),
  };

  return {
    service: new DemoTokenService(
      demoSessionRepository as never,
      dataSource as never,
      configService as never,
      playersService as never,
      probabilityService as never,
    ),
    demoSessionRepository,
    progressRepository,
    playersService,
    probabilityService,
  };
}

describe('DemoTokenService webview urls', () => {
  it('builds demo webview links from the request origin when no fixed base url is configured', async () => {
    const { service } = createService({ WEBVIEW_BASE_URL: '' });

    const result = await service.createSession({ externalId: 'demo-player-001', turnoverPoints: 500 }, {
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

    const result = await service.createSession({ externalId: 'demo-player-001', turnoverPoints: 500 }, {
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

  it('writes incoming turnover snapshot and unlocks stages when creating a session', async () => {
    const { service, progressRepository } = createService();

    await service.createSession({ externalId: 'demo-player-001', turnoverPoints: 5000 });

    expect(progressRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      playerId: player.id,
      turnoverPoints: 5000,
      unlockedStage: 2,
    }));
  });

  it('does not lower existing same-day progress when creating a session with a lower turnover snapshot', async () => {
    const { service, progressRepository } = createService();
    progressRepository.findOne.mockResolvedValue({
      id: 'progress-id',
      playerId: player.id,
      businessDate: '2026-05-11',
      turnoverPoints: 50000,
      unlockedStage: 4,
    });

    await service.createSession({ externalId: 'demo-player-001', turnoverPoints: 500 });

    expect(progressRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'progress-id',
      turnoverPoints: 50000,
      unlockedStage: 4,
    }));
  });

  it('does not expose probability weights or table names in public session state', async () => {
    const { service, demoSessionRepository, playersService, probabilityService } = createService();
    demoSessionRepository.findOne.mockResolvedValue({
      token: 'token',
      playerId: player.id,
      player,
      expiresAt: 9999999999,
    });
    playersService.getDailyProgress.mockResolvedValue({
      player,
      businessDate: '2026-05-11',
      turnoverPoints: 1000,
      unlockedStage: 1,
      playedStages: [1],
      totalWinPoints: 100,
      spins: [
        {
          id: 'spin-id',
          playerId: player.id,
          businessDate: '2026-05-11',
          stageNumber: 1,
          probabilityTable: 'dailyLimit',
          prizeName: 'A Prize',
          amountPoints: 100,
          createdAt: 1778436000,
        },
      ],
    });
    probabilityService.getStages.mockResolvedValue([
      {
        stageNumber: 1,
        turnoverThresholdPoints: 500,
        lowTableWeight: 960,
        highTableWeight: 40,
        prizes: [
          {
            rewardCode: 'A',
            name: 'A Prize',
            amountPoints: 100,
            lowWeight: 64,
            highWeight: 41,
            prizeWeight: 0,
            dailyLimitWeight: 64,
            sortOrder: 1,
          },
        ],
      },
    ]);

    const result = await service.getSessionState('token');

    expect(result.stages[0]).not.toHaveProperty('lowTableWeight');
    expect(result.stages[0]).not.toHaveProperty('highTableWeight');
    expect(result.stages[0].prizes[0]).toEqual({
      rewardCode: 'A',
      name: 'A Prize',
      amountPoints: 100,
      sortOrder: 1,
    });
    expect(result.progress.spins[0]).not.toHaveProperty('probabilityTable');
    expect(result.progress.spins[0]).not.toHaveProperty('playerId');
  });
});
