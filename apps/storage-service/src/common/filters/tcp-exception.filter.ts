import { Catch, RpcExceptionFilter, ArgumentsHost, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';

@Catch()
export class TcpExceptionFilter implements RpcExceptionFilter<Error> {
  private readonly logger = new Logger(TcpExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): Observable<any> {
    // Suppress InvalidTcpDataReceptionException errors
    if (exception.name === 'InvalidTcpDataReceptionException') {
      this.logger.debug('Ignored corrupted TCP data packet');
      return throwError(() => exception);
    }

    // Log other errors
    this.logger.error(`TCP Exception: ${exception.message}`, exception.stack);
    return throwError(() => exception);
  }
}
