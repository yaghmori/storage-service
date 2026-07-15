/** TCP port constants for public platform services */

export const SERVICE_PORTS = {
  STORAGE_SERVICE_TCP: 4002,
  EMAIL_SERVICE_TCP: 4003,
  NOTIFICATION_SERVICE_TCP: 4004,
} as const;

export type ServicePort = (typeof SERVICE_PORTS)[keyof typeof SERVICE_PORTS];
