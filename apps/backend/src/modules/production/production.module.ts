import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service.js';
import { ProductionRunsService } from './production-runs.service.js';

@Module({
  providers: [RecipesService, ProductionRunsService],
  exports: [RecipesService, ProductionRunsService],
})
export class ProductionModule {}
