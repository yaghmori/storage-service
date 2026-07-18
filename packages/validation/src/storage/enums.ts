import { z } from "zod";

export enum ProviderType {
  LOCAL = "local",
  MINIO = "minio",
  S3 = "s3",
}

export const providerTypeSchema = z.nativeEnum(ProviderType);

export const ProviderTypeLabels: Record<ProviderType, string> = {
  [ProviderType.LOCAL]: "Local disk",
  [ProviderType.MINIO]: "MinIO",
  [ProviderType.S3]: "Amazon S3",
};

export enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export const jobStatusSchema = z.nativeEnum(JobStatus);

export const JobStatusLabels: Record<JobStatus, string> = {
  [JobStatus.PENDING]: "Pending",
  [JobStatus.PROCESSING]: "Processing",
  [JobStatus.COMPLETED]: "Completed",
  [JobStatus.FAILED]: "Failed",
  [JobStatus.CANCELLED]: "Cancelled",
};

export enum JobType {
  IMAGE = "image",
  VIDEO = "video",
  METADATA = "metadata",
  THUMBNAIL = "thumbnail",
  TRANSCODE = "transcode",
}

export const jobTypeSchema = z.nativeEnum(JobType);

export const JobTypeLabels: Record<JobType, string> = {
  [JobType.IMAGE]: "Image",
  [JobType.VIDEO]: "Video",
  [JobType.METADATA]: "Metadata",
  [JobType.THUMBNAIL]: "Thumbnail",
  [JobType.TRANSCODE]: "Transcode",
};
