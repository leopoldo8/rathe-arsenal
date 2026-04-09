import { Module } from '@nestjs/common';
import { AwsIamTransport } from './aws-iam.transport';
import { FabraryService } from './fabrary.service';

@Module({
  providers: [AwsIamTransport, FabraryService],
  exports: [FabraryService, AwsIamTransport],
})
export class FabraryModule {}
