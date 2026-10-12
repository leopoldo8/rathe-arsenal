import { DataSource } from 'typeorm';

export class ChatGrantError extends Error {
  constructor(readonly code: 'USER_NOT_FOUND', email: string) {
    super(`No user with email ${email}`);
  }
}

export async function setChatAccess(dataSource: DataSource, email: string, granted: boolean): Promise<string> {
  const rows = (await dataSource.query(
    `UPDATE "user" SET "chatAccess" = $2 WHERE lower(email) = lower($1) RETURNING email`,
    [email.trim(), granted],
  )) as [Array<{ email: string }>, number];
  const updated = rows[0]?.[0];
  if (!updated) throw new ChatGrantError('USER_NOT_FOUND', email);
  return updated.email;
}
