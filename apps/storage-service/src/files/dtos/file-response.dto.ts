export class FileResponseDto {
  id!: number;
  storageProviderId!: number;
  key!: string;
  originalFilename!: string;
  mimeType!: string;
  size!: number;
  sha256Hash!: string;
  referenceCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

