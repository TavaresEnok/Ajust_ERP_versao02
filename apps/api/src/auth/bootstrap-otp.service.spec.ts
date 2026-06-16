import { BadRequestException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { BootstrapOtpService } from './bootstrap-otp.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

const mockHash = hash as jest.Mock;

describe('BootstrapOtpService', () => {
  const prisma = {
    bootstrapOtp: {
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  };
  const email = {
    sendBootstrapOtp: jest.fn(),
  };
  const token = {
    generateTokenWithExpiry: jest.fn(),
  };
  let service: BootstrapOtpService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BootstrapOtpService(prisma as any, email as any, token as any);
  });

  it('defines a strong password and one-time bootstrap token after valid OTP', async () => {
    jest.spyOn(service, 'validateOtp').mockResolvedValue(true);
    mockHash.mockResolvedValue('new-password-hash');
    const expiresAt = new Date(Date.now() + 60_000);
    token.generateTokenWithExpiry.mockReturnValue({
      token: 'plain-bootstrap-token',
      hash: 'bootstrap-token-hash',
      expiresAt,
    });

    await expect(service.completeFirstAccess('user-1', '123456', 'NewPassword@123')).resolves.toBe(
      'plain-bootstrap-token',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        passwordHash: 'new-password-hash',
        bootstrapTokenHash: 'bootstrap-token-hash',
        bootstrapTokenExpiresAt: expiresAt,
      },
    });
  });

  it('does not change the password when OTP is invalid', async () => {
    jest.spyOn(service, 'validateOtp').mockResolvedValue(false);

    await expect(
      service.completeFirstAccess('user-1', '000000', 'NewPassword@123'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
