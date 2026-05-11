import { AuthService } from './auth.service';
import { AdminUser } from './entities/admin-user.entity';

function createService() {
  const adminUserRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((input: Partial<AdminUser>) => Object.assign(new AdminUser(), input)),
    save: jest.fn(async (input: AdminUser) => input),
  };
  const configService = {
    get: jest.fn((_key: string, defaultValue?: string) => defaultValue),
  };
  const jwtService = {
    signAsync: jest.fn(),
  };

  return {
    service: new AuthService(adminUserRepository as never, configService as never, jwtService as never),
    adminUserRepository,
  };
}

describe('AuthService', () => {
  it('seeds the default admin through an entity so timestamp hooks run', async () => {
    const { service, adminUserRepository } = createService();

    await service.onModuleInit();

    expect(adminUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'admin',
        passwordHash: expect.any(String),
        isActive: true,
      }),
    );
    expect(adminUserRepository.save).toHaveBeenCalledWith(expect.any(AdminUser));

    const savedAdmin = adminUserRepository.save.mock.calls[0][0];
    savedAdmin.setCreateTimestamps();
    expect(savedAdmin.createdAt).toEqual(expect.any(Number));
    expect(savedAdmin.updatedAt).toBe(savedAdmin.createdAt);
  });

  it('does not reseed the default admin when it already exists', async () => {
    const { service, adminUserRepository } = createService();
    adminUserRepository.findOne.mockResolvedValue({ id: 'admin-id' });

    await service.onModuleInit();

    expect(adminUserRepository.create).not.toHaveBeenCalled();
    expect(adminUserRepository.save).not.toHaveBeenCalled();
  });
});
