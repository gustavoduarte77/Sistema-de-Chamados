import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Trim } from '../common/trim.js';

export class CriarPessoaDto {
  @Trim() @IsString() @IsNotEmpty({ message: 'Nome é obrigatório.' })
  nome: string;

  @Trim() @IsEmail({}, { message: 'E-mail com formato inválido.' })
  email: string;

  @IsIn(['solicitante', 'tecnico'], { message: 'Tipo deve ser "solicitante" ou "tecnico".' })
  tipo: 'solicitante' | 'tecnico';

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

export class AtualizarPessoaDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty({ message: 'Nome é obrigatório.' })
  nome?: string;

  @IsOptional() @Trim() @IsEmail({}, { message: 'E-mail com formato inválido.' })
  email?: string;

  @IsOptional() @IsIn(['solicitante', 'tecnico'], { message: 'Tipo deve ser "solicitante" ou "tecnico".' })
  tipo?: 'solicitante' | 'tecnico';

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}
