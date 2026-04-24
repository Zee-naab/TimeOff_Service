import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmployeesModule } from './modules/employees/employees.module';
import { LocationsModule } from './modules/locations/locations.module';
import { LeaveTypesModule } from './modules/leave-types/leave-types.module';
import { LeaveBalancesModule } from './modules/leave-balances/leave-balances.module';
import { TimeOffRequestsModule } from './modules/time-off-requests/time-off-requests.module';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'better-sqlite3',
        database: configService.get<string>('DATABASE_PATH', './timeoff.db'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    EmployeesModule,
    LocationsModule,
    LeaveTypesModule,
    LeaveBalancesModule,
    TimeOffRequestsModule,
    SyncModule,
  ],
})
export class AppModule {}
