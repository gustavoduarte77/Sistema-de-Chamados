import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../common/trim.js';

export class CriarTipoProblemaDto {
  @Trim() @IsString() @IsNotEmpty({ message: 'Nome é obrigatório.' }) @MaxLength(100)
  nome: string;

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

export class AtualizarTipoProblemaDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty({ message: 'Nome é obrigatório.' }) @MaxLength(100)
  nome?: string;

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}
