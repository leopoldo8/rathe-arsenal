import { DataSource } from 'typeorm';
import { setChatAccess } from './chat-grant';

export interface ICliIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

/** `chat:grant <email> [--revoke]`; resolves to the process exit code. */
export async function runChatGrant(argv: readonly string[], dataSource: DataSource, io: ICliIo): Promise<number> {
  const email = argv.find((arg) => !arg.startsWith('--'));
  const revoke = argv.includes('--revoke');
  if (!email) {
    io.err('usage: chat:grant <email> [--revoke]');
    return 1;
  }
  try {
    const updated = await setChatAccess(dataSource, email, !revoke);
    io.out(`${revoke ? 'revoked' : 'granted'} chat access: ${updated}`);
    return 0;
  } catch (error) {
    io.err((error as Error).message);
    return 1;
  }
}

async function main(): Promise<void> {
  const { AppDataSource } = await import('../database/datasource');
  await AppDataSource.initialize();
  const code = await runChatGrant(process.argv.slice(2), AppDataSource, {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  });
  await AppDataSource.destroy();
  process.exit(code);
}

if (require.main === module) {
  void main();
}
