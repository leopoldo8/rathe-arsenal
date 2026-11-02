import { checkServerIdentity, PeerCertificate } from 'node:tls';

/** The only value that turns certificate verification off; anything else, `true` included, keeps it on. */
export const INSECURE_TLS_OPT_IN = 'i-understand';

export interface IUsageDatabaseTls {
  readonly rejectUnauthorized: boolean;
  readonly ca?: string;
  readonly checkServerIdentity?: (host: string, cert: PeerCertificate) => Error | undefined;
}

export interface ITlsDeps {
  readonly readFile: (path: string) => string;
  readonly warn: (message: string) => void;
}

/**
 * TLS options for the eval's read of USAGE_DATABASE_URL. Certificates are verified by default.
 * USAGE_DATABASE_CA_FILE adds a trusted CA (a PEM file), for a proxy whose certificate Node does not know.
 * USAGE_DATABASE_TLS_SERVERNAME, only with a CA file, checks the certificate against that name instead of the host:
 * Railway's public proxy presents a certificate for `localhost`, signed by the database's own CA.
 * USAGE_DATABASE_INSECURE_TLS=i-understand turns verification off, with a warning; never use it outside a one-off local run.
 */
export function usageDatabaseTls(env: Readonly<Record<string, string | undefined>>, deps: ITlsDeps): IUsageDatabaseTls {
  if (env['USAGE_DATABASE_INSECURE_TLS'] === INSECURE_TLS_OPT_IN) {
    deps.warn('USAGE_DATABASE_INSECURE_TLS is set: certificate verification is OFF for the usage database connection.');
    return { rejectUnauthorized: false };
  }
  const caFile = env['USAGE_DATABASE_CA_FILE']?.trim();
  const servername = env['USAGE_DATABASE_TLS_SERVERNAME']?.trim();
  if (!caFile) {
    if (servername) throw new Error('USAGE_DATABASE_TLS_SERVERNAME needs USAGE_DATABASE_CA_FILE: a name check only means something against a pinned CA');
    return { rejectUnauthorized: true };
  }
  const ca = deps.readFile(caFile);
  if (!ca.includes('-----BEGIN CERTIFICATE-----')) throw new Error(`USAGE_DATABASE_CA_FILE (${caFile}) holds no PEM certificate`);
  if (!servername) return { rejectUnauthorized: true, ca };
  return { rejectUnauthorized: true, ca, checkServerIdentity: (_host, cert) => checkServerIdentity(servername, cert) };
}

const TLS_PARAMS = ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'];

/** The connection string without TLS query parameters, so a URL cannot turn verification off behind `ssl`. */
export function withoutTlsParams(connectionString: string): string {
  const url = new URL(connectionString);
  for (const param of TLS_PARAMS) url.searchParams.delete(param);
  return url.toString();
}
