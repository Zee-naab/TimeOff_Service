import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const apiKey = req.headers['x-api-key'];
    const expectedKey = this.configService.get<string>('HCM_API_KEY');

    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    return true;
  }
}
