import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PeerCertificate } from 'node:tls';
import { usageDatabaseTls, withoutTlsParams } from '../usage-database-tls';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';

describe('usage database TLS options', () => {
  it('verifies the server certificate by default', () => {
    // Arrange
    const warn = jest.fn();

    // Act
    const tls = usageDatabaseTls({}, { readFile: () => PEM, warn });

    // Assert
    expect(tls).toEqual({ rejectUnauthorized: true });
    expect(warn).not.toHaveBeenCalled();
  });

  it('trusts a CA read from USAGE_DATABASE_CA_FILE and still verifies', () => {
    const readFile = jest.fn(() => PEM);

    const tls = usageDatabaseTls({ USAGE_DATABASE_CA_FILE: '/tmp/railway-ca.pem' }, { readFile, warn: jest.fn() });

    expect(readFile).toHaveBeenCalledWith('/tmp/railway-ca.pem');
    expect(tls).toEqual({ rejectUnauthorized: true, ca: PEM });
  });

  it('checks the certificate name against USAGE_DATABASE_TLS_SERVERNAME, only with a pinned CA', () => {
    // Arrange
    const env = { USAGE_DATABASE_CA_FILE: '/tmp/ca.pem', USAGE_DATABASE_TLS_SERVERNAME: 'localhost' };
    const cert = { subject: { CN: 'localhost' }, subjectaltname: 'DNS:localhost' } as unknown as PeerCertificate;
    const other = { subject: { CN: 'evil.example' }, subjectaltname: 'DNS:evil.example' } as unknown as PeerCertificate;

    // Act
    const tls = usageDatabaseTls(env, { readFile: () => PEM, warn: jest.fn() });

    // Assert
    expect(tls.rejectUnauthorized).toBe(true);
    expect(tls.ca).toBe(PEM);
    expect(tls.checkServerIdentity!('proxy.example.net', cert)).toBeUndefined();
    expect(tls.checkServerIdentity!('proxy.example.net', other)?.message).toMatch(/localhost/);
    expect(() => usageDatabaseTls({ USAGE_DATABASE_TLS_SERVERNAME: 'localhost' }, { readFile: () => PEM, warn: jest.fn() })).toThrow(/USAGE_DATABASE_CA_FILE/);
  });

  it('refuses a CA file that holds no certificate', () => {
    expect(() => usageDatabaseTls({ USAGE_DATABASE_CA_FILE: '/tmp/x' }, { readFile: () => 'not a cert', warn: jest.fn() })).toThrow(
      /USAGE_DATABASE_CA_FILE/,
    );
  });

  it('turns verification off only on the exact opt-in value, and warns when it does', () => {
    const warn = jest.fn();

    const insecure = usageDatabaseTls({ USAGE_DATABASE_INSECURE_TLS: 'i-understand' }, { readFile: () => PEM, warn });
    const ignored = ['true', '1', 'yes', ''].map((value) => usageDatabaseTls({ USAGE_DATABASE_INSECURE_TLS: value }, { readFile: () => PEM, warn: jest.fn() }));

    expect(insecure).toEqual({ rejectUnauthorized: false });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/certificate verification is OFF/));
    for (const tls of ignored) expect(tls).toEqual({ rejectUnauthorized: true });
  });

  it('drops TLS parameters from the URL, so it cannot override the verified options', () => {
    const url = withoutTlsParams('postgresql://reader:secret@proxy.example.net:5432/railway?sslmode=no-verify&application_name=eval');

    expect(url).not.toMatch(/sslmode/);
    expect(url).toContain('application_name=eval');
    expect(url).toContain('reader:secret@proxy.example.net:5432/railway');
  });

  it('no source but the documented eval opt-in turns certificate verification off', () => {
    const root = join(__dirname, '../../..');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (entry !== '__tests__') walk(path);
        } else if (path.endsWith('.ts') && !path.endsWith('usage-database-tls.ts') && /rejectUnauthorized:\s*false/.test(readFileSync(path, 'utf8'))) {
          offenders.push(path);
        }
      }
    };

    walk(root);

    expect(offenders).toEqual([]);
  });
});
