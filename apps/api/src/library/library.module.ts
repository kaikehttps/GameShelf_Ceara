import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
