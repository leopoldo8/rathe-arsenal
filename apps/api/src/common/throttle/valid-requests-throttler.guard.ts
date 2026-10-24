import { BadRequestException, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createValidationPipe } from '../validation/create-validation-pipe';

export const THROTTLE_VALID_REQUESTS_ONLY = 'throttle:valid-requests-only';

export const ThrottleValidRequestsOnly = (): ClassDecorator & MethodDecorator => SetMetadata(THROTTLE_VALID_REQUESTS_ONLY, true);

type TBodyClass = new () => object;

/**
 * The throttler runs before the validation pipe, so a request that fails validation would still use up
 * the limit (AC 255). On routes marked with `ThrottleValidRequestsOnly`, a body the global validation pipe refuses is not counted.
 * The guard runs a pipe built by the same factory as the global one, so the two cannot drift apart: a body the guard
 * lets through to the count is one the pipe would accept, and anything unexpected counts.
 */
@Injectable()
export class ValidRequestsThrottlerGuard extends ThrottlerGuard {
  private readonly validationPipe = createValidationPipe();

  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const marked = this.reflector.getAllAndOverride<boolean | undefined>(THROTTLE_VALID_REQUESTS_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!marked) return false;
    const bodyClass = bodyClassOf(context);
    if (bodyClass === null) return false;
    const body: unknown = context.switchToHttp().getRequest<{ body?: unknown }>().body ?? {};
    try {
      await this.validationPipe.transform(body, { type: 'body', metatype: bodyClass });
      return false;
    } catch (error) {
      return error instanceof BadRequestException;
    }
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
