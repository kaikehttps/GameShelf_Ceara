import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { trim, trimLowercase as normalizeEmail } from '../../common/transforms.js';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';

/**
 * NIST SP 800-63B-4 / OWASP: mínimo de 15 caracteres quando não há MFA, sem regras
 * de composição. O máximo limita o custo do hash.
 */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

export class RegisterDto {
  @ApiProperty({ example: 'ana@example.com', maxLength: 254 })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'uma-senha-longa-e-unica',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiProperty({ example: 'Ana', minLength: 2, maxLength: 50 })
  @Transform(trim)
  @IsString()
  @Length(2, 50)
  displayName!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'demo@gameshelf.dev' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'demo-password-123' })
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT de curta duração. Envie em Authorization: Bearer <token>.' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: 900, description: 'Validade do access token em segundos.' })
  expiresIn!: number;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}
