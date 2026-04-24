import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';

describe('TimeOff Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Employees', () => {
    it('GET /employees returns empty array initially', () => {
      return request(app.getHttpServer())
        .get('/employees')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('POST /employees creates an employee', () => {
      return request(app.getHttpServer())
        .post('/employees')
        .send({ name: 'Test User', email: 'test@example.com' })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('Test User');
          expect(res.body.email).toBe('test@example.com');
          expect(res.body.id).toBeDefined();
        });
    });

    it('POST /employees returns 409 for duplicate email', () => {
      return request(app.getHttpServer())
        .post('/employees')
        .send({ name: 'Another User', email: 'test@example.com' })
        .expect(409);
    });

    it('GET /employees/:id returns 404 for non-existent employee', () => {
      return request(app.getHttpServer()).get('/employees/9999').expect(404);
    });
  });

  describe('Locations', () => {
    it('GET /locations returns empty array initially', () => {
      return request(app.getHttpServer())
        .get('/locations')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('POST /locations creates a location', () => {
      return request(app.getHttpServer())
        .post('/locations')
        .send({ name: 'New York' })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('New York');
        });
    });
  });

  describe('Leave Types', () => {
    it('POST /leave-types creates a leave type', () => {
      return request(app.getHttpServer())
        .post('/leave-types')
        .send({ name: 'Vacation' })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('Vacation');
        });
    });
  });

  describe('Validation', () => {
    it('POST /employees returns 400 for invalid email', () => {
      return request(app.getHttpServer())
        .post('/employees')
        .send({ name: 'Bad User', email: 'not-an-email' })
        .expect(400);
    });

    it('POST /employees returns 400 for missing fields', () => {
      return request(app.getHttpServer())
        .post('/employees')
        .send({ name: 'No Email' })
        .expect(400);
    });
  });
});
