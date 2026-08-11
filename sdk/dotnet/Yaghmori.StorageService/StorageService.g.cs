// AUTO-GENERATED from contracts.json - do not edit by hand.
namespace Yaghmori.StorageService;

public static class StorageService
{
    public const string Name = "storage-service";
    public const string InjectionToken = "STORAGE_SERVICE";
    public const string DockerImage = "ghcr.io/yaghmori/storage-service";

    public static class Ports
    {
        public const int Tcp = 6001;
        public const int Http = 6100;
    }

    public static class Env
    {
        public const string HttpBaseUrl = "STORAGE_SERVICE_URL";
        public const string Host = "STORAGE_SERVICE_HOST";
        public const string TcpPort = "STORAGE_SERVICE_TCP_PORT";
        public const string HttpPort = "STORAGE_SERVICE_HTTP_PORT";
    }

    public static class Patterns
    {
        public const string GetFileInfo = "storage.get_file_info";
        public const string DeleteFile = "storage.delete_file";
        public const string BatchOperations = "storage.batch_operations";
        public const string GetSignedUrl = "storage.get_signed_url";
        public const string ListProcessorResults = "storage.list_processor_results";
        public const string GetProcessorResult = "storage.get_processor_result";
        public const string GetFileMetadata = "storage.get_file_metadata";
        public const string ListVariants = "storage.list_variants";
        public const string UploadFile = "uploadFile";
        public const string GetAssetUrl = "getAssetUrl";
        public const string DeleteAsset = "deleteAsset";
        public const string HealthCheck = "health.check";
    }

    public static class HttpPaths
    {
        public const string Upload = "/v1/upload";
        public const string UploadInitiate = "/v1/upload/initiate";
        public const string UploadComplete = "/v1/upload/complete";
        public const string UploadAbort = "/v1/upload/abort";
        public const string UploadMultipartPartUrl = "/v1/upload/multipart/part-url";
        public const string UploadMultipartInitiate = "/v1/upload/multipart/initiate";
        public const string UploadMultipartComplete = "/v1/upload/multipart/complete";
        public const string UploadMultipartAbort = "/v1/upload/multipart/abort";
        public const string GetFile = "/v1/files/{id}";
        public const string DeleteFile = "/v1/files/{id}";
        public const string Download = "/v1/files/{id}/download";
        public const string SignedUrl = "/v1/files/{id}/signed-url";
        public const string Metadata = "/v1/files/{id}/metadata";
        public const string ProcessorResults = "/v1/files/{id}/processor-results";
        public const string ProcessorResult = "/v1/files/{id}/processor-results/{processorKey}";
        public const string Variants = "/v1/files/{id}/variants";
        public const string Health = "/health";
    }

    public static class Topics
    {
        public const string FileUploaded = "file.uploaded";
        public const string FileDeleted = "file.deleted";
        public const string FileProcessed = "file.processed";
    }

    public static class EventTypes
    {
        public const string Uploaded = "evt.storage.file.uploaded.v1";
        public const string Deleted = "evt.storage.file.deleted.v1";
        public const string Processed = "evt.storage.file.processed.v1";
    }
}
