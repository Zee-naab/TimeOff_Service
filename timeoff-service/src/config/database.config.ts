import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'better-sqlite3',
  database: process.env.DATABASE_PATH || './timeoff.db',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: true, // For development only
};
