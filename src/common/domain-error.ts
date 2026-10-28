export type ErrorKind = 'validacao' | 'nao_encontrado' | 'conflito' | 'regra';

export class DomainError extends Error {
  constructor(
    public kind: ErrorKind,
    message: string,
    public regra?: number,
  ) {
    super(message);
  }

  get status(): number {
    return { validacao: 400, nao_encontrado: 404, conflito: 409, regra: 422 }[this.kind];
  }
}

export const validacao = (m: string, r?: number) => new DomainError('validacao', m, r);
export const naoEncontrado = (m: string) => new DomainError('nao_encontrado', m);
export const conflito = (m: string, r?: number) => new DomainError('conflito', m, r);
export const regra = (m: string, r?: number) => new DomainError('regra', m, r);
