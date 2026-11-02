import { Module } from '@nestjs/common';
import { FabraryAppSyncTransport } from './fabrary-appsync.transport';
import { FabraryService } from './fabrary.service';

@Module({
  providers: [FabraryAppSyncTransport, FabraryService],
  exports: [FabraryService, FabraryAppSyncTransport],
})
export class FabraryModule {}
