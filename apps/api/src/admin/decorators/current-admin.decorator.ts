import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AdminRequestUser = {
  adminId: string;
  email: string;
  role: string;
};

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminRequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AdminRequestUser;
  },
);
