import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import { publicUserSelect, type PublicUser } from './public-user.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!user) {
      // Token válido de um usuário que não existe mais: tratamos como sessão inválida.
      throw new UnauthorizedException('Sessão inválida');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    await this.getProfile(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        // String vazia remove a bio.
        bio: dto.bio === undefined ? undefined : dto.bio || null,
      },
      select: publicUserSelect,
    });
  }
}
