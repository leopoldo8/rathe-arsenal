import { DataSource } from 'typeorm';
import { runChatGrant } from '../chat-grant.cli';

function dataSourceAnswering(rows: Array<{ email: string }>): DataSource {
  return { query: jest.fn().mockResolvedValue([rows, rows.length]) } as unknown as DataSource;
}

describe('chat:grant', () => {
  it('exits 1 for an unknown email and prints the granted one', async () => {
    const out = jest.fn();
    const err = jest.fn();

    const unknown = await runChatGrant(['ghost@test.local'], dataSourceAnswering([]), { out, err });
    const granted = await runChatGrant(['Owner@Test.local'], dataSourceAnswering([{ email: 'owner@test.local' }]), { out, err });
    const revoked = await runChatGrant(['owner@test.local', '--revoke'], dataSourceAnswering([{ email: 'owner@test.local' }]), { out, err });
    const usage = await runChatGrant([], dataSourceAnswering([]), { out, err });

    expect([unknown, granted, revoked, usage]).toEqual([1, 0, 0, 1]);
    expect(err).toHaveBeenCalledWith('No user with email ghost@test.local');
    expect(out.mock.calls).toEqual([['granted chat access: owner@test.local'], ['revoked chat access: owner@test.local']]);
  });
});
