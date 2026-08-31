import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  PatchBazaarProductSchema,
  UpsertBazaarCompanySchema,
  UpsertBazaarProductSchema,
} from '@work-ally/shared';
import { JwtAuthGuard } from '../../../common/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../../common/current-user.decorator';
import { parseBody } from '../../../common/zod';
import { BazaarAppGuard } from '../bazaar-app.guard';
import { BazaarCompanyService } from './bazaar-company.service';
import { BazaarProductsService } from './bazaar-products.service';

@Controller('apps/bazaar')
@UseGuards(JwtAuthGuard, BazaarAppGuard)
export class BazaarController {
  constructor(
    private readonly company: BazaarCompanyService,
    private readonly products: BazaarProductsService,
  ) {}

  @Get('company')
  getCompany(@CurrentUser() user: AuthUser) {
    return this.company.getMine(user);
  }

  @Post('company')
  createCompany(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.company.upsert(user, parseBody(UpsertBazaarCompanySchema, body));
  }

  @Patch('company')
  updateCompany(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.company.upsert(user, parseBody(UpsertBazaarCompanySchema, body));
  }

  @Get('products')
  listProducts(@CurrentUser() user: AuthUser) {
    return this.products.listMine(user);
  }

  @Post('products')
  createProduct(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.products.create(user, parseBody(UpsertBazaarProductSchema, body));
  }

  @Get('products/:id')
  getProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.get(user, id);
  }

  @Patch('products/:id')
  updateProduct(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.products.update(user, id, parseBody(PatchBazaarProductSchema, body));
  }

  @Delete('products/:id')
  deleteProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.remove(user, id);
  }

  @Post('products/:id/publish')
  publishProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.publish(user, id);
  }

  @Post('products/:id/unpublish')
  unpublishProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.unpublish(user, id);
  }
}
