import { Injectable } from '@nestjs/common';
import { ImageProcessingService } from './image-processing.service';
import { VideoProcessingService } from './video-processing.service';
import { MetadataExtractionService } from './metadata-extraction.service';

@Injectable()
export class ProcessingService {
  constructor(
    private readonly imageProcessing: ImageProcessingService,
    private readonly videoProcessing: VideoProcessingService,
    private readonly metadataExtraction: MetadataExtractionService,
  ) {}
}

