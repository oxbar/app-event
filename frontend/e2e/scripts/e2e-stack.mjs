import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertE2eReady} from './preflight.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const action = process.argv[2] ?? 'run';
const forwarded = process.argv.slice(3);
const cli = resolveContainerCli();

const composeBase = [
  'compose',
  '--env-file', '.env.e2e',
  '-f', 'docker-compose.yml',
];

switch (action) {
  case 'up':
    up();
    await waitUntilReady();
    await assertE2eReady();
    break;
  case 'down':
    run(cli, [...composeBase, 'down', '--remove-orphans']);
    break;
  case 'run':
    up();
    await waitUntilReady();
    await assertE2eReady();
    run(npxCommand(), ['playwright', 'test', ...forwarded, '--workers=1'], resolve(repoRoot, 'frontend'));
    break;
  default:
    throw new Error(`Ação desconhecida: ${action}. Use up, down ou run.`);
}

function up() {
  run(cli, [
    ...composeBase,
    'up',
    '-d',
    '--build',
    '--force-recreate',
    '--remove-orphans',
  ]);
}

async function waitUntilReady() {
  const baseUrl = (process.env.E2E_BASE_URL ?? 'http://localhost:4200').replace(/\/+$/, '');
  const deadline = Date.now() + 180_000;
  let lastError = 'sem resposta';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/login`, {signal: AbortSignal.timeout(5_000)});
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 2_000));
  }

  throw new Error(`A stack E2E não ficou pronta em 180 segundos: ${lastError}`);
}

function resolveContainerCli() {
  const configured = process.env.E2E_CONTAINER_CLI;
  const candidates = configured ? [configured] : ['podman', 'docker'];

  for (const candidate of candidates) {
    const check = spawnSync(candidate, ['compose', 'version'], {
      cwd: repoRoot,
      stdio: 'ignore',
      shell: false,
    });
    if (check.status === 0) return candidate;
  }

  throw new Error([
    'Nenhum runtime Compose foi encontrado.',
    'Instale Podman/Docker ou defina E2E_CONTAINER_CLI com o executável correto.',
  ].join('\n'));
}

function npxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function run(command, args, cwd = repoRoot) {
  console.log(`\n> ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
