import { HealthController } from '../health.controller';

describe('HealthController', () => {
  const original = process.env['RAILWAY_GIT_COMMIT_SHA'];

  afterEach(() => {
    if (original === undefined) delete process.env['RAILWAY_GIT_COMMIT_SHA'];
    else process.env['RAILWAY_GIT_COMMIT_SHA'] = original;
  });

  it('reports the commit Railway deployed', () => {
    process.env['RAILWAY_GIT_COMMIT_SHA'] = '49521011aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    const answer = new HealthController().check();

    expect(answer.status).toBe('ok');
    expect(answer.commit).toBe('49521011aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(Number.isNaN(Date.parse(answer.timestamp))).toBe(false);
  });

  it('reports a null commit when the deploy did not come from GitHub', () => {
    delete process.env['RAILWAY_GIT_COMMIT_SHA'];

    expect(new HealthController().check().commit).toBeNull();
  });
});
