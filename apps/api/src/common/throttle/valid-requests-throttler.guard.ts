import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ThrottlerGuard } from '@nestjs/throttler';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export const THROTTLE_VALID_REQUESTS_ONLY = 'throttle:valid-requests-only';

export const ThrottleValidRequestsOnly = (): ClassDecorator & MethodDecorator => SetMetadata(THROTTLE_VALID_REQUESTS_ONLY, true);

type TBodyClass = new () => object;

/**
 * The throttler runs before the validation pipe, so a request that fails validation would still use up
 * the limit (AC 255). On routes marked with `ThrottleValidRequestsOnly`, a body the route's DTO refuses is not counted.
 */
@Injectable()
export class ValidRequestsThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const marked = this.reflector.getAllAndOverride<boolean | undefined>(THROTTLE_VALID_REQUESTS_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!marked) return false;
    const bodyClass = bodyClassOf(context);
    if (bodyClass === null) return false;
    const body: unknown = context.switchToHttp().getRequest<{ body?: unknown }>().body ?? {};
    const errors = await validate(plainToInstance(bodyClass, body, { enableImplicitConversion: true }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    return errors.length > 0;
  }
}

function bodyClassOf(context: ExecutionContext): TBodyClass | null {
  const controller = context.getClass();
  const handlerName = context.getHandler().name;
  const routeArgs = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handlerName) ?? {}) as Record<string, unknown>;
  const bodyKey = Object.keys(routeArgs).find((key) => key.startsWith(`${RouteParamtypes.BODY}:`));
  if (bodyKey === undefined) return null;
  const index = Number(bodyKey.split(':')[1]);
  const paramTypes = (Reflect.getMetadata('design:paramtypes', controller.prototype, handlerName) ?? []) as unknown[];
  const candidate = paramTypes[index];
  return typeof candidate === 'function' && candidate !== Object ? (candidate as TBodyClass) : null;
}
