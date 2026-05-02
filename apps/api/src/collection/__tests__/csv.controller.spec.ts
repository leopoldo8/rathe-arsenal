import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { CsvController } from '../csv/csv.controller';
import { CsvUploadService } from '../csv/csv-upload.service';
import { CsvUploadExceptionFilter } from '../csv/csv-upload-exception.filter';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import {
  ICreatedResponse,
  IUpdatedResponse,
  IExactMatchResponse,
  IPartialOverlapResponse,
  ICancelledResponse,
} from '../csv/dtos/upload-csv.response.dto';

/**
 * E2E tests for `POST /collection/csv`.
 *
 * Mounts CsvController with a stubbed CsvUploadService. Auth is bypassed via a
 * test middleware that injects `request.user` when `x-test-user-id` is set —
 * the same pattern used in auth.controller.e2e-spec.ts.
 *
 * Scenarios covered (per plan lines 921–937):
 *   Happy: auto → created
 *   Happy: auto + same CSV → exact-match
 *   Happy: action=separate → second created
 *   Happy: auto + partial-overlap
 *   Happy: action=update + targetSourceId → updated
 *   Happy: action=cancel
 *   Error: no file → 400 MISSING_FILE
 *   Error: non-CSV MIME → 400 INVALID_MIME_TYPE
 *   Error: file > 2 MB → 400 FILE_TOO_LARGE
 *   Error: malformed CSV → 400 INVALID_CSV
 *   Error: > 5000 rows → 400 CSV_TOO_MANY_ROWS
 *   Error: action=replace, no targetSourceId → 400 MISSING_TARGET_SOURCE
 *   Error: action=update, wrong user's targetSourceId → 404
 *   Error: action=update, kind=manual targetSourceId → 404
 */

const USER_ID = 'test-user-uuid-e2e';
// Must be valid UUIDs so @IsUUID() passes validation on targetSourceId.
// Using UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx where y ∈ {8,9,a,b}.
const SOURCE_ID_A = 'a1b2c3d4-e5f6-4890-89cd-ef1234567890';
const SOURCE_ID_B = 'b2c3d4e5-f6a7-4901-acde-f12345678901';
const OTHER_SOURCE_UUID = 'c3d4e5f6-a7b8-4012-8def-012345678902';
const MANUAL_SOURCE_UUID = 'd4e5f6a7-b8c9-4123-9efa-123456789012';

const CSV_HEADER = 'Name,Quantity\n';
const MINIMAL_CSV = `${CSV_HEADER}Command and Conquer,3\n`;

function buildMinimalCsvBuffer(): Buffer {
  return Buffer.from(MINIMAL_CSV, 'utf-8');
}

describe('CsvController (e2e)', () => {
  let app: INestApplication;
  let csvUploadService: DeepMocked<CsvUploadService>;

  beforeEach(async () => {
    csvUploadService = createMock<CsvUploadService>();

    const moduleRef = await Test.createTestingModule({
      controllers: [CsvController],
      providers: [
        { provide: CsvUploadService, useValue: csvUploadService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    // Apply the global ValidationPipe (mirrors main.ts behaviour).
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );

    // Register the CSV-specific exception filter so 413 PayloadTooLargeException
    // is converted to 400 FILE_TOO_LARGE (mirrors the @UseFilters on CsvController).
    app.useGlobalFilters(new CsvUploadExceptionFilter());

    // Inject a minimal auth middleware so @CurrentUser() can read request.user.
    // No Passport or JWT guard is needed; the middleware injects a stub user
    // when the x-test-user-id header is present.
    const httpAdapter = app.getHttpAdapter();
    const instance = httpAdapter.getInstance() as {
      use: (fn: (req: Request, res: Response, next: NextFunction) => void) => void;
    };
    instance.use((req, _res, next) => {
      const userId = req.header('x-test-user-id');
      if (userId) {
        (req as Request & { user?: ICurrentUser }).user = {
          userId,
          email: `${userId}@example.com`,
        };
      }
      next();
    });

    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function authHeader(): Record<string, string> {
    return { 'x-test-user-id': USER_ID };
  }

  function postCsv(
    buffer: Buffer,
    mimeType = 'text/csv',
    filename = 'collection.csv',
  ) {
    return request(app.getHttpServer())
      .post('/collection/csv')
      .set(authHeader())
      .attach('file', buffer, { filename, contentType: mimeType });
  }

  // ---------------------------------------------------------------------------
  // Happy: action='auto' → created
  // ---------------------------------------------------------------------------

  describe('action=auto (default) — new source', () => {
    it('POST a new CSV returns { kind: created, sourceId, cardCount, skippedRows }', async () => {
      // Arrange
      const serviceResponse: ICreatedResponse = {
        kind: 'created',
        sourceId: SOURCE_ID_A,
        cardCount: 3,
        skippedRows: [],
      };
      csvUploadService.handle.mockResolvedValue(serviceResponse);

      // Act
      const res = await postCsv(buildMinimalCsvBuffer());

      // Assert
      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('created');
      expect(res.body.sourceId).toBe(SOURCE_ID_A);
      expect(res.body.cardCount).toBe(3);
      expect(res.body.skippedRows).toEqual([]);
      expect(csvUploadService.handle).toHaveBeenCalledWith(
        USER_ID,
        expect.any(Buffer),
        'auto',
        undefined,
        'collection.csv',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Happy: action='auto' → exact-match (no DB writes)
  // ---------------------------------------------------------------------------

  describe('action=auto — exact-match', () => {
    it('second identical POST returns { kind: exact-match }', async () => {
      // Arrange
      const serviceResponse: IExactMatchResponse = {
        kind: 'exact-match',
        existingSourceId: SOURCE_ID_A,
        existingLabel: 'My CSV',
        cardCount: 3,
        skippedRows: [],
      };
      csvUploadService.handle.mockResolvedValue(serviceResponse);

      // Act
      const res = await postCsv(buildMinimalCsvBuffer());

      // Assert
      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('exact-match');
      expect(res.body.existingSourceId).toBe(SOURCE_ID_A);
      expect(res.body.existingLabel).toBe('My CSV');
    });
  });

  // ---------------------------------------------------------------------------
  // Happy: action='separate' — always creates a new source
  // ---------------------------------------------------------------------------

  describe("action='separate'", () => {
    it('re-POST with action=separate creates a second source', async () => {
      // Arrange
      const serviceResponse: ICreatedResponse = {
        kind: 'created',
        sourceId: SOURCE_ID_B,
        cardCount: 3,
        skippedRows: [],
      };
      csvUploadService.handle.mockResolvedValue(serviceResponse);

      // Act
      const res = await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .attach('file', buildMinimalCsvBuffer(), { filename: 'col.csv', contentType: 'text/csv' })
        .field('action', 'separate');

      // Assert
      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('created');
      expect(res.body.sourceId).toBe(SOURCE_ID_B);
      expect(csvUploadService.handle).toHaveBeenCalledWith(
        USER_ID,
        expect.any(Buffer),
        'separate',
        undefined,
        'col.csv',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Happy: action='auto' → partial-overlap (no DB writes)
  // ---------------------------------------------------------------------------

  describe("action='auto' — partial-overlap", () => {
    it('POST partial-overlap CSV returns { kind: partial-overlap }', async () => {
      // Arrange
      const serviceResponse: IPartialOverlapResponse = {
        kind: 'partial-overlap',
        existingSourceId: SOURCE_ID_A,
        existingLabel: 'My CSV',
        similarityScore: 0.75,
        delta: {
          added: [{ cardIdentifier: 'new-card', quantity: 1 }],
          removed: [{ cardIdentifier: 'old-card', quantity: 2 }],
          increased: [],
          decreased: [],
        },
        cardCount: 3,
        skippedRows: [],
      };
      csvUploadService.handle.mockResolvedValue(serviceResponse);

      // Act
      const res = await postCsv(buildMinimalCsvBuffer());

      // Assert
      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('partial-overlap');
      expect(res.body.similarityScore).toBe(0.75);
    });
  });

  // ---------------------------------------------------------------------------
  // Happy: action='update' + targetSourceId → updated
  // ---------------------------------------------------------------------------

  describe("action='update' with targetSourceId", () => {
    it('re-POST with action=update modifies existing source rows', async () => {
      // Arrange
      const serviceResponse: IUpdatedResponse = {
        kind: 'updated',
        sourceId: SOURCE_ID_A,
        cardCount: 2,
        delta: {
          added: [],
          removed: [{ cardIdentifier: 'old-card', quantity: 1 }],
          increased: [],
          decreased: [{ cardIdentifier: 'command-and-conquer', previousQuantity: 4, newQuantity: 1 }],
        },
        skippedRows: [],
      };
      csvUploadService.handle.mockResolvedValue(serviceResponse);

      // Act
      const res = await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .attach('file', buildMinimalCsvBuffer(), { filename: 'update.csv', contentType: 'text/csv' })
        .field('action', 'update')
        .field('targetSourceId', SOURCE_ID_A);

      // Assert
      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('updated');
      expect(res.body.sourceId).toBe(SOURCE_ID_A);
      expect(csvUploadService.handle).toHaveBeenCalledWith(
        USER_ID,
        expect.any(Buffer),
        'update',
        SOURCE_ID_A,
        'update.csv',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Happy: action='cancel'
  // ---------------------------------------------------------------------------

  describe("action='cancel'", () => {
    it('returns { kind: cancelled } without writes', async () => {
      // Arrange
      const serviceResponse: ICancelledResponse = { kind: 'cancelled' };
      csvUploadService.handle.mockResolvedValue(serviceResponse);

      // Act
      const res = await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .attach('file', buildMinimalCsvBuffer(), { filename: 'col.csv', contentType: 'text/csv' })
        .field('action', 'cancel');

      // Assert
      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('cancelled');
    });
  });

  // ---------------------------------------------------------------------------
  // Error: no file → 400 MISSING_FILE
  // ---------------------------------------------------------------------------

  describe('no file attached', () => {
    it('returns 400 MISSING_FILE when no file is in the request', async () => {
      // Act
      const res = await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .send({});

      // Assert
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('MISSING_FILE');
    });
  });

  // ---------------------------------------------------------------------------
  // Error: non-CSV MIME → 400 INVALID_MIME_TYPE
  // ---------------------------------------------------------------------------

  describe('non-CSV MIME type', () => {
    it('returns 400 INVALID_MIME_TYPE for application/json MIME', async () => {
      // Act
      const res = await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .attach('file', Buffer.from('{}', 'utf-8'), {
          filename: 'data.json',
          contentType: 'application/json',
        });

      // Assert
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('INVALID_MIME_TYPE');
    });
  });

  // ---------------------------------------------------------------------------
  // Error: file > 2 MB → 400 FILE_TOO_LARGE
  // ---------------------------------------------------------------------------

  describe('file exceeds 2 MB limit', () => {
    it('returns 400 FILE_TOO_LARGE for a 2.1 MB payload', async () => {
      // Arrange: 2.1 MB buffer (CSV MIME to pass the fileFilter first)
      const bigBuffer = Buffer.alloc(2 * 1024 * 1024 + 1, 'a');

      // Act
      const res = await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .attach('file', bigBuffer, {
          filename: 'big.csv',
          contentType: 'text/csv',
        });

      // Assert
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('FILE_TOO_LARGE');
    });
  });

  // ---------------------------------------------------------------------------
  // Error: malformed CSV → 400 INVALID_CSV
  // ---------------------------------------------------------------------------

  describe('malformed CSV body', () => {
    it('returns 400 INVALID_CSV when service throws BadRequestException(INVALID_CSV)', async () => {
      // Arrange: service propagates parser error
      csvUploadService.handle.mockRejectedValue(
        Object.assign(new Error('INVALID_CSV'), { status: 400, response: 'INVALID_CSV' }),
      );

      // Use a real BadRequestException to test the framework path
      const { BadRequestException } = await import('@nestjs/common');
      csvUploadService.handle.mockRejectedValue(
        new BadRequestException('INVALID_CSV'),
      );

      // Act
      const res = await postCsv(Buffer.from('not,a,valid\xffcsv', 'latin1'));

      // Assert
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // Error: > 5000 rows → 400 CSV_TOO_MANY_ROWS
  // ---------------------------------------------------------------------------

  describe('CSV exceeds row limit', () => {
    it('returns 400 CSV_TOO_MANY_ROWS when service throws that error', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      csvUploadService.handle.mockRejectedValue(
        new BadRequestException('CSV_TOO_MANY_ROWS'),
      );

      // Act
      const res = await postCsv(buildMinimalCsvBuffer());

      // Assert
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('CSV_TOO_MANY_ROWS');
    });
  });

  // ---------------------------------------------------------------------------
  // Error: action='replace', no targetSourceId → 400 MISSING_TARGET_SOURCE
  // ---------------------------------------------------------------------------

  describe("action='replace' without targetSourceId", () => {
    it('returns 400 MISSING_TARGET_SOURCE', async () => {
      // Arrange: service reflects missing-target error (before authz check)
      const { BadRequestException } = await import('@nestjs/common');
      csvUploadService.handle.mockRejectedValue(
        new BadRequestException('MISSING_TARGET_SOURCE'),
      );

      // Act
      const res = await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .attach('file', buildMinimalCsvBuffer(), { filename: 'col.csv', contentType: 'text/csv' })
        .field('action', 'replace');

      // Assert
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('MISSING_TARGET_SOURCE');
    });
  });

  // ---------------------------------------------------------------------------
  // Error: action='update' with another user's targetSourceId → 404
  // ---------------------------------------------------------------------------

  describe("action='update' with unauthorized targetSourceId", () => {
    it('returns 404 (non-leaky) for another user target source', async () => {
      // Arrange: service throws NotFoundException (opaque 404)
      const { NotFoundException } = await import('@nestjs/common');
      csvUploadService.handle.mockRejectedValue(
        new NotFoundException('CSV source not found'),
      );

      // Act
      const res = await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .attach('file', buildMinimalCsvBuffer(), { filename: 'col.csv', contentType: 'text/csv' })
        .field('action', 'update')
        .field('targetSourceId', OTHER_SOURCE_UUID);

      // Assert
      expect(res.status).toBe(404);
      // Should NOT leak whether resource exists or is forbidden
      expect(res.body.message).not.toContain('forbidden');
      expect(res.body.message).not.toContain('unauthorized');
    });
  });

  // ---------------------------------------------------------------------------
  // Error: action='update' targeting a kind='manual' source → 404
  // ---------------------------------------------------------------------------

  describe("action='update' targeting kind='manual' source", () => {
    it('returns 404 for manual source (same opaque response)', async () => {
      // Arrange
      const { NotFoundException } = await import('@nestjs/common');
      csvUploadService.handle.mockRejectedValue(
        new NotFoundException('CSV source not found'),
      );

      // Act
      const res = await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .attach('file', buildMinimalCsvBuffer(), { filename: 'col.csv', contentType: 'text/csv' })
        .field('action', 'update')
        .field('targetSourceId', MANUAL_SOURCE_UUID);

      // Assert
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // Integration contract: service receives correct arguments
  // ---------------------------------------------------------------------------

  describe('service argument forwarding', () => {
    it('forwards userId, buffer, action, targetSourceId, and filename to the service', async () => {
      // Arrange
      csvUploadService.handle.mockResolvedValue({
        kind: 'replaced',
        sourceId: SOURCE_ID_B,
        cardCount: 2,
        skippedRows: [],
      });

      // Act
      await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .attach('file', buildMinimalCsvBuffer(), {
          filename: 'my-deck.csv',
          contentType: 'text/csv',
        })
        .field('action', 'replace')
        .field('targetSourceId', SOURCE_ID_A);

      // Assert: correct service call signature
      expect(csvUploadService.handle).toHaveBeenCalledWith(
        USER_ID,
        expect.any(Buffer),
        'replace',
        SOURCE_ID_A,
        'my-deck.csv',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Integration contract: MIME whitelist allows text/plain and application/vnd.ms-excel
  // ---------------------------------------------------------------------------

  describe('allowed MIME types', () => {
    it('accepts text/plain MIME', async () => {
      // Arrange
      csvUploadService.handle.mockResolvedValue({ kind: 'cancelled' });

      // Act
      const res = await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .attach('file', buildMinimalCsvBuffer(), {
          filename: 'col.txt',
          contentType: 'text/plain',
        })
        .field('action', 'cancel');

      // Assert: reaches service (not rejected at fileFilter)
      expect(res.status).toBe(201);
    });

    it('accepts application/vnd.ms-excel MIME', async () => {
      // Arrange
      csvUploadService.handle.mockResolvedValue({ kind: 'cancelled' });

      // Act
      const res = await request(app.getHttpServer())
        .post('/collection/csv')
        .set(authHeader())
        .attach('file', buildMinimalCsvBuffer(), {
          filename: 'col.xls',
          contentType: 'application/vnd.ms-excel',
        })
        .field('action', 'cancel');

      // Assert
      expect(res.status).toBe(201);
    });
  });
});
