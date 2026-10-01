import { Module } from '@nestjs/common';
import { CatalogFiltersController } from './catalog-filters.controller.js';
import { CatalogService } from './catalog.service.js';
import { GamesController } from './games.controller.js';

@Module({
  controllers: [GamesController, CatalogFiltersController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
