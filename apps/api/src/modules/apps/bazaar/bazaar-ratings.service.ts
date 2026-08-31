import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../common/current-user.decorator';
import { BazaarProductsService } from './bazaar-products.service';

@Injectable()
export class BazaarRatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: BazaarProductsService,
  ) {}

  async rate(user: AuthUser, productId: string, stars: number) {
    const product = await this.prisma.bazaarProduct.findFirst({
      where: { id: productId, tenantId: user.tenantId, status: 'published' },
    });
    if (!product) throw new NotFoundException('产品不存在');
    if (product.userId === user.userId) {
      throw new ForbiddenException('不能给自己的产品打星');
    }
    await this.prisma.bazaarRating.upsert({
      where: { productId_userId: { productId, userId: user.userId } },
      create: { tenantId: user.tenantId, productId, userId: user.userId, stars },
      update: { stars },
    });
    return this.products.recomputeFromDb(productId);
  }
}
