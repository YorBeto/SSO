import { Module } from '@nestjs/common';
import { PersonsService } from './persons.service.js';
import { PersonsController } from './persons.controller.js';

@Module({
  providers: [PersonsService],
  controllers: [PersonsController]
})
export class PersonsModule {}
