import { All, Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BullBoardSetupService } from './bull-board-setup.service';

@Controller('admin/queues')
export class BullBoardController {
  constructor(
    @Inject(BullBoardSetupService)
    private readonly bullBoardSetup: BullBoardSetupService,
  ) {}

  @Get()
  serveBullBoardRoot(@Req() req: Request, @Res() res: Response): void {
    this.serveBullBoard(req, res);
  }

  @All('*path')
  serveBullBoard(@Req() req: Request, @Res() res: Response): void {
    if (!this.bullBoardSetup || !this.bullBoardSetup.serverAdapter) {
      res.status(503).send('Bull Board is not initialized yet');
      return;
    }

    // Adjust the request URL to be relative to the base path
    // Bull Board expects paths relative to /api/admin/queues
    const originalUrl = req.url;
    const basePath = '/api/admin/queues';

    // If the URL starts with the base path, remove it to make it relative
    if (originalUrl.startsWith(basePath)) {
      req.url = originalUrl.substring(basePath.length) || '/';
    }

    // Delegate to Express adapter router
    const router = this.bullBoardSetup.serverAdapter.getRouter();
    router(req, res, () => {
      // Restore original URL in case it's needed elsewhere
      req.url = originalUrl;
      if (!res.headersSent) {
        res.status(404).send('Not found');
      }
    });
  }
}
