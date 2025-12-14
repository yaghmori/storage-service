export class UploadResponseDto {
  /**
   * File ID
   */
  id!: string;

  /**
   * Original filename as uploaded by user
   */
  originalFileName!: string;

  /**
   * MIME type of the file
   */
  mimeType!: string;

  /**
   * File size in bytes
   */
  size!: number;

  /**
   * Indicates if this upload was a duplicate of an existing file
   */
  isDuplicate?: boolean;

  /**
   * If duplicate, this is the ID of the original file
   */
  originalFileId?: string;

  /**
   * Message explaining what happened with the upload
   */
  message?: string;

  /**
   * Indicates if the file was actually uploaded to storage (false for duplicates)
   */
  uploadedToStorage?: boolean;

  /**
   * File creation timestamp
   */
  createdAt?: Date;
}

