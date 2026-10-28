import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Length, MinLength, Min } from 'class-validator';
import { Trim } from '../common/trim.js';
import { Prioridade, Situacao } from '../generated/prisma/enums.js';

const PRIORIDADES = Object.values(Prioridade);
const SITUACOES = Object.values(Situacao);
const MSG_PRIORIDADE = `Prioridade deve ser uma de: ${PRIORIDADES.join(', ')}.`;
const MSG_SITUACAO = `Situação deve ser uma de: ${SITUACOES.join(', ')}.`;
const MSG_TITULO = 'Título deve ter entre 5 e 100 caracteres.';
const MSG_DESCRICAO = 'Descrição deve ter no mínimo 10 caracteres.';

export class AbrirChamadoDto {
  @IsInt({ message: 'solicitanteId deve ser um inteiro.' })
  solicitanteId: number;

  @IsInt({ message: 'tipoProblemaId deve ser um inteiro.' })
  tipoProblemaId: number;

  @Trim() @IsString({ message: MSG_TITULO }) @Length(5, 100, { message: MSG_TITULO })
  titulo: string;

  @Trim() @IsString({ message: MSG_DESCRICAO }) @MinLength(10, { message: MSG_DESCRICAO })
  descricao: string;

  @IsOptional() @IsIn(PRIORIDADES, { message: MSG_PRIORIDADE })
  prioridade?: Prioridade;
}

export class AtualizarChamadoDto {
  @IsOptional() @Trim() @IsString({ message: MSG_TITULO }) @Length(5, 100, { message: MSG_TITULO })
  titulo?: string;

  @IsOptional() @Trim() @IsString({ message: MSG_DESCRICAO }) @MinLength(10, { message: MSG_DESCRICAO })
  descricao?: string;

  @IsOptional() @IsIn(PRIORIDADES, { message: MSG_PRIORIDADE })
  prioridade?: Prioridade;
}

export class DesignarTecnicoDto {
  @IsInt({ message: 'tecnicoId deve ser um inteiro.' })
  tecnicoId: number;
}

export class MudarSituacaoDto {
  @IsIn(SITUACOES, { message: MSG_SITUACAO })
  situacao: Situacao;
}

export class ComentarDto {
  @IsInt({ message: 'autorId deve ser um inteiro.' })
  autorId: number;

  @Trim() @IsString({ message: 'Comentário não pode ser vazio.' }) @IsNotEmpty({ message: 'Comentário não pode ser vazio.' })
  texto: string;
}

export class ListarChamadosQuery {
  @IsOptional() @IsIn(SITUACOES, { message: MSG_SITUACAO })
  situacao?: Situacao;

  @IsOptional() @IsIn(PRIORIDADES, { message: MSG_PRIORIDADE })
  prioridade?: Prioridade;

  @IsOptional() @Type(() => Number) @IsInt({ message: 'Filtro "tipoProblemaId" inválido.' }) @Min(1)
  tipoProblemaId?: number;

  @IsOptional() @Type(() => Number) @IsInt({ message: 'Filtro "tecnicoId" inválido.' }) @Min(1)
  tecnicoId?: number;
}
