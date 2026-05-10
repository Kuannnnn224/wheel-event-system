import { UnauthorizedException } from '@nestjs/common';
import { DemoTokenController } from './demo-token.controller';

const request = {
  headers: {
    origin: 'http://127.0.0.1:5173',
    referer: 'http://127.0.0.1:5173/demo',
  },
};

function createController(platformApiKey = 'test-platform-key') {
  const demoTokenService = {
    createSession: jest.fn().mockReturnValue({ token: 'token' }),
    getClientConfig: jest.fn(),
    getSessionState: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) => (key === 'PLATFORM_API_KEY' ? platformApiKey : undefined)),
  };

  return {
    controller: new DemoTokenController(demoTokenService as never, configService as never),
    demoTokenService,
  };
}

describe('DemoTokenController session creation', () => {
  it('rejects platform session creation without a valid API key', () => {
    const { controller } = createController();

    expect(() =>
      controller.createSession(
        { externalId: 'player-001', turnoverPoints: 500 },
        'wrong-key',
        request as never,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('allows platform session creation with the configured API key', () => {
    const { controller, demoTokenService } = createController();

    controller.createSession(
      { externalId: 'player-001', turnoverPoints: 500 },
      'test-platform-key',
      request as never,
    );

    expect(demoTokenService.createSession).toHaveBeenCalledWith(
      { externalId: 'player-001', turnoverPoints: 500 },
      { origin: request.headers.origin, referer: request.headers.referer },
    );
  });

  it('creates admin sessions without requiring the platform API key', () => {
    const { controller, demoTokenService } = createController();

    controller.createAdminSession({ externalId: 'player-001', turnoverPoints: 500 }, request as never);

    expect(demoTokenService.createSession).toHaveBeenCalledWith(
      { externalId: 'player-001', turnoverPoints: 500 },
      { origin: request.headers.origin, referer: request.headers.referer },
    );
  });
});
