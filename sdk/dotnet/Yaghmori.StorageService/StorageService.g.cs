// AUTO-GENERATED from contracts.json — do not edit by hand.
namespace Yaghmori.StorageService;

public static class StorageService
{
    public const string Name = "storage-service";
    public const string InjectionToken = "STORAGE_SERVICE";
    public const string DockerImage = "ghcr.io/yaghmori/storage-service";

    public static class Ports
    {
        public const int tcp = 4002;
        public const int http = 4000;
    }

    public static class Patterns
    {
        public const string GET_FILE_INFO = "storage.get_file_info";
        public const string DELETE_FILE = "storage.delete_file";
        public const string BATCH_OPERATIONS = "storage.batch_operations";
        public const string GET_SIGNED_URL = "storage.get_signed_url";
        public const string UPLOAD_FILE = "uploadFile";
        public const string GET_ASSET_URL = "getAssetUrl";
        public const string DELETE_ASSET = "deleteAsset";
        public const string HEALTH_CHECK = "health.check";
    }

    public static class Topics
    {
        public const string FILE_UPLOADED = "file.uploaded";
        public const string FILE_DELETED = "file.deleted";
        public const string FILE_PROCESSED = "file.processed";
    }

    public static class EventTypes
    {
        public const string UPLOADED = "evt.storage.file.uploaded.v1";
        public const string DELETED = "evt.storage.file.deleted.v1";
        public const string PROCESSED = "evt.storage.file.processed.v1";
    }
}
