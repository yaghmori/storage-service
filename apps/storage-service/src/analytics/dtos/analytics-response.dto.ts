export class AnalyticsResponseDto {
  totalDownloads!: number;
  uniqueIPs!: number;
  downloadsByVariant!: Record<string | number, number>;
}

