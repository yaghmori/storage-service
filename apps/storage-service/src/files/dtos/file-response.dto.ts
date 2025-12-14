export class FileResponseDto {
  id!: string;
  storageProviderId!: string;
  key!: string;
  originalFilename!: string;
  mimeType!: string;
  size!: number;
  sha256Hash!: string;
  referenceCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

