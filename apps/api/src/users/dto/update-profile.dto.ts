import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { trim } from '../../common/transforms.js';
import { IsOptionalNotNull } from '../../common/validation.js';

/**
 * Apenas campos de perfil podem ser editados aqui. E-mail e senha ficam fora:
 * como o ValidationPipe usa `forbidNonWhitelisted`, enviá-los gera erro 400.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ana Souza', minLength: 2, maxLength: 50 })
  @IsOptionalNotNull()
  @Transform(trim)
  @IsString()
  @Length(2, 50)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Jogo principalmente RPGs.', maxLength: 280, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(280)
  bio?: string;
}
