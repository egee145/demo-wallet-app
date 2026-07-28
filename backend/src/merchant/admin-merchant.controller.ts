import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ProvisionMerchantDto } from './dto/provision-merchant.dto.js';
import { MerchantService } from './merchant.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/merchants')
export class AdminMerchantController {
  constructor(private readonly merchants: MerchantService) {}

  @Post()
  provision(@Body() dto: ProvisionMerchantDto) {
    return this.merchants.provision(dto);
  }
}
