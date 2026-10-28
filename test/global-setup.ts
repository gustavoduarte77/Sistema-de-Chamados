import { execSync } from 'node:child_process';

/** Aplica as migrations no banco de testes antes da suíte. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Defina TEST_DATABASE_URL no .env (veja .env.example).');
  if (!/\/[^/]*_test(\?|$)/.test(url)) {
    throw new Error('TEST_DATABASE_URL deve apontar para um banco cujo nome termina em "_test" (ele é apagado nos testes).');
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
