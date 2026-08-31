import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  PatchBazaarProductSchema,
  PolishBazaarProductOverrideSchema,
  RateBazaarProductSchema,
  UpsertBazaarCompanySchema,
  UpsertBazaarProductSchema,
} from '@work-ally/shared';
import { JwtAuthGuard } from '../../../common/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../../common/current-user.decorator';
import { parseBody } from '../../../common/zod';
import { BazaarAppGuard } from '../bazaar-app.guard';
import { BazaarCompanyService } from './bazaar-company.service';
import { BazaarMarketService } from './bazaar-market.service';
import { BazaarProductsService } from './bazaar-products.service';
import { BazaarRatingsService } from './bazaar-ratings.service';

@Controller('apps/bazaar')
@UseGuards(JwtAuthGuard, BazaarAppGuard)
export class BazaarController {
  constructor(
    private readonly company: BazaarCompanyService,
    private readonly products: BazaarProductsService,
    private readonly ratings: BazaarRatingsService,
    private readonly market: BazaarMarketService,
  ) {}

  @Get('company')
  getCompany(@CurrentUser() user: AuthUser) {
    return this.company.getMine(user);
  }

  @Get('company/:userId')
  getCompanyByUser(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ) {
    return this.market.getCompany(user.tenantId, userId);
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

  @Post('products/:id/polish')
  polishProduct(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const override =
      body != null &&
      typeof body === 'object' &&
      Object.keys(body as object).length > 0
        ? parseBody(PolishBazaarProductOverrideSchema, body)
        : undefined;
    return this.products.polish(user, id, override);
  }

  @Put('products/:id/rating')
  rateProduct(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const { stars } = parseBody(RateBazaarProductSchema, body);
    return this.ratings.rate(user, id, stars);
  }

  @Get('market')
  getMarket(@CurrentUser() user: AuthUser, @Query('sort') sort?: string) {
    return this.market.market(user.tenantId, sort === 'hottest' ? 'hottest' : 'newest');
  }

  @Get('stalls/:userId')
  getStall(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.market.stall(user.tenantId, userId);
  }

  @Get('leaderboard')
  getLeaderboard(@CurrentUser() user: AuthUser) {
    return this.market.leaderboard(user.tenantId);
  }
}
