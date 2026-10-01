import { ApiProperty } from '@nestjs/swagger';
import type { PublicUser } from '../public-user.js';

/**
 * Formato público de um usuário. É a única forma de um usuário sair da API:
 * campos como passwordHash nunca chegam aqui porque as consultas usam `publicUserSelect`.
 */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ana@example.com' })
  email!: string;

  @ApiProperty({ example: 'Ana' })
  displayName!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Fã de RPGs e metroidvanias.' })
  bio!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export function toUserResponse(user: PublicUser): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    createdAt: user.createdAt,
  };
}
