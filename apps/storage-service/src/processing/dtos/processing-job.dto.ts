export class ProcessingJobDto {
  id: number;
  fileId: number;
  jobType: string;
  status: string;
  bullmqJobId?: string;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

