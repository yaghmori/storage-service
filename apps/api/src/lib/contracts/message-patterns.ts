// Unified TCP message patterns for platform services

export const MESSAGE_PATTERNS = {
  STORAGE: {
    GET_FILE_INFO: 'storage.get_file_info',
    DELETE_FILE: 'storage.delete_file',
    BATCH_OPERATIONS: 'storage.batch_operations',
    GET_SIGNED_URL: 'storage.get_signed_url',
    /** Legacy Allyfe alias — prefer HTTP upload + GET_SIGNED_URL */
    UPLOAD_FILE: 'uploadFile',
    GET_ASSET_URL: 'getAssetUrl',
    DELETE_ASSET: 'deleteAsset',
  },

  EMAIL: {
    SEND_EMAIL: 'email.send_email',
    GET_MESSAGE: 'email.get_message',
    LIST_MESSAGES: 'email.list_messages',
    RETRY_MESSAGE: 'email.retry_message',
  },

  NOTIFICATION: {
    GET_NOTIFICATIONS: 'notification.get_notifications',
    GET_NOTIFICATION_BY_ID: 'notification.get_notification_by_id',
    CREATE_NOTIFICATION: 'notification.create_notification',
    MARK_AS_READ: 'notification.mark_as_read',
    MARK_ALL_AS_READ: 'notification.mark_all_as_read',
    ARCHIVE_NOTIFICATION: 'notification.archive_notification',
    DELETE_NOTIFICATION: 'notification.delete_notification',
  },

  HEALTH: {
    CHECK: 'health.check',
  },
} as const;

export const BATCH_OPERATION_TYPES = {
  GET: 'get',
  DELETE: 'delete',
} as const;
