import "@typespec/rest";
import "@typespec/http";
import "@azure-tools/typespec-azure-core";
import "@azure-tools/typespec-azure-resource-manager";

using TypeSpec.Rest;
using TypeSpec.Http;
using Azure.ResourceManager;
using Azure.ResourceManager.Foundations;

namespace Microsoft.AzureSphere;

/**
 * The intended executor of the operation; as in Resource Based Access Control (RBAC) and audit logs UX. Default value is "user,system"
 */
union Origin {
  string,
  user: "user",
  system: "system",
  `user,system`: "user,system",
}

/**
 * Enum. Indicates the action type. "Internal" refers to actions that are for internal only APIs.
 */
union ActionType {
  string,
  Internal: "Internal",
}

/**
 * Provisioning state of the resource.
 */
union ProvisioningState {
  string,

  /**
   * Resource has been created.
   */
  Succeeded: "Succeeded",

  /**
   * Resource creation failed.
   */
  Failed: "Failed",

  /**
   * Resource creation was canceled.
   */
  Canceled: "Canceled",

  /**
   * The resource is being provisioned
   */
  Provisioning: "Provisioning",

  /**
   * The resource is being updated
   */
  Updating: "Updating",

  /**
   * The resource is being deleted
   */
  Deleting: "Deleting",

  /**
   * The resource create request has been accepted
   */
  Accepted: "Accepted",
}

/**
 * The type of identity that created the resource.
 */
union CreatedByType {
  string,
  User: "User",
  Application: "Application",
  ManagedIdentity: "ManagedIdentity",
  Key: "Key",
}

/**
 * Certificate status values.
 */
union CertificateStatus {
  string,

  /**
   * Certificate is active
   */
  Active: "Active",

  /**
   * Certificate is inactive
   */
  Inactive: "Inactive",

  /**
   * Certificate has expired
   */
  Expired: "Expired",

  /**
   * Certificate has been revoked
   */
  Revoked: "Revoked",
}

/**
 * Regional data boundary values.
 */
union RegionalDataBoundary {
  string,

  /**
   * No data boundary
   */
  None: "None",

  /**
   * EU data boundary
   */
  EU: "EU",
}

/**
 * Image type values.
 */
union ImageType {
  string,

  /**
   * Invalid image.
   */
  InvalidImageType: "InvalidImageType",

  /**
   * One Bl image type
   */
  OneBl: "OneBl",

  /**
   * Pluton image type
   */
  PlutonRuntime: "PlutonRuntime",

  /**
   * Wifi firmware image type
   */
  WifiFirmware: "WifiFirmware",

  /**
   * Security monitor image type
   */
  SecurityMonitor: "SecurityMonitor",

  /**
   * Normal world loader image type
   */
  NormalWorldLoader: "NormalWorldLoader",

  /**
   * Normal world dtb image type
   */
  NormalWorldDtb: "NormalWorldDtb",

  /**
   * Normal world kernel image type
   */
  NormalWorldKernel: "NormalWorldKernel",

  /**
   * Root FS image type
   */
  RootFs: "RootFs",

  /**
   * Services image type
   */
  Services: "Services",

  /**
   * Applications image type
   */
  Applications: "Applications",

  /**
   * FW config image type
   */
  FwConfig: "FwConfig",

  /**
   * Boot manifest image type
   */
  BootManifest: "BootManifest",

  /**
   * Nwfs image type
   */
  Nwfs: "Nwfs",

  /**
   * Trusted key store image type
   */
  TrustedKeystore: "TrustedKeystore",

  /**
   * Policy image type
   */
  Policy: "Policy",

  /**
   * Customer board config image type
   */
  CustomerBoardConfig: "CustomerBoardConfig",

  /**
   * Update certificate store image type
   */
  UpdateCertStore: "UpdateCertStore",

  /**
   * Base system update manifest image type
   */
  BaseSystemUpdateManifest: "BaseSystemUpdateManifest",

  /**
   * Firmware update manifest image type
   */
  FirmwareUpdateManifest: "FirmwareUpdateManifest",

  /**
   * Customer update manifest image type
   */
  CustomerUpdateManifest: "CustomerUpdateManifest",

  /**
   * Recovery manifest image type
   */
  RecoveryManifest: "RecoveryManifest",

  /**
   * manifest set image type
   */
  ManifestSet: "ManifestSet",

  /**
   * Other image type
   */
  Other: "Other",
}

/**
 * OS feed type values.
 */
union OSFeedType {
  string,

  /**
   * Retail OS feed type.
   */
  Retail: "Retail",

  /**
   * Retail evaluation OS feed type.
   */
  RetailEval: "RetailEval",
}

/**
 * Update policy values.
 */
union UpdatePolicy {
  string,

  /**
   * Update all policy.
   */
  UpdateAll: "UpdateAll",

  /**
   * No update for 3rd party app policy.
   */
  No3rdPartyAppUpdates: "No3rdPartyAppUpdates",
}

/**
 * Allow crash dumps values.
 */
union AllowCrashDumpCollection {
  string,

  /**
   * Crash dump collection enabled
   */
  Enabled: "Enabled",

  /**
   * Crash dump collection disabled
   */
  Disabled: "Disabled",
}

/**
 * Capability image type
 */
union CapabilityType {
  string,

  /**
   * Application development capability
   */
  ApplicationDevelopment: "ApplicationDevelopment",

  /**
   * Field servicing capability
   */
  FieldServicing: "FieldServicing",
}

/**
 * Localized display information for this particular operation.
 */
model OperationDisplay {
  /**
   * The localized friendly form of the resource provider name, e.g. "Microsoft Monitoring Insights" or "Microsoft Compute".
   */
  @visibility(Lifecycle.Read)
  provider?: string;

  /**
   * The localized friendly name of the resource type related to this operation. E.g. "Virtual Machines" or "Job Schedule Collections".
   */
  @visibility(Lifecycle.Read)
  resource?: string;

  /**
   * The concise, localized friendly name for the operation; suitable for dropdowns. E.g. "Create or Update Virtual Machine", "Restart Virtual Machine".
   */
  @visibility(Lifecycle.Read)
  operation?: string;

  /**
   * The short, localized friendly description of the operation; suitable for tool tips and detailed views.
   */
  @visibility(Lifecycle.Read)
  description?: string;
}

/**
 * Catalog properties
 */
model CatalogProperties {
  /**
   * The status of the last operation.
   */
  @visibility(Lifecycle.Read)
  provisioningState?: ProvisioningState;
}

/**
 * The type used for update operations of the Catalog.
 */
model CatalogUpdate {
  /**
   * Resource tags.
   */
  tags?: Record<string>;
}

/**
 * The properties of certificate
 */
model CertificateProperties {
  /**
   * The certificate as a UTF-8 encoded base 64 string.
   */
  @visibility(Lifecycle.Read)
  certificate?: string;

  /**
   * The certificate status.
   */
  @visibility(Lifecycle.Read)
  status?: CertificateStatus;

  /**
   * The certificate subject.
   */
  @visibility(Lifecycle.Read)
  subject?: string;

  /**
   * The certificate thumbprint.
   */
  @visibility(Lifecycle.Read)
  thumbprint?: string;

  /**
   * The certificate expiry date.
   */
  @visibility(Lifecycle.Read)
  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  expiryUtc?: utcDateTime;

  /**
   * The certificate not before date.
   */
  @visibility(Lifecycle.Read)
  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  notBeforeUtc?: utcDateTime;

  /**
   * The status of the last operation.
   */
  @visibility(Lifecycle.Read)
  provisioningState?: ProvisioningState;
}

/**
 * The certificate chain response.
 */
model CertificateChainResponse {
  /**
   * The certificate chain.
   */
  @visibility(Lifecycle.Read)
  certificateChain?: string;
}

/**
 * Request for the proof of possession nonce
 */
model ProofOfPossessionNonceRequest {
  /**
   * The proof of possession nonce
   */
  proofOfPossessionNonce: string;
}

/**
 * Result of the action to generate a proof of possession nonce
 */
#suppress "@azure-tools/typespec-azure-core/composition-over-inheritance" "For backward compatibility"
model ProofOfPossessionNonceResponse extends CertificateProperties {}

/**
 * Response to the action call for count devices in a catalog.
 */
#suppress "@azure-tools/typespec-azure-core/composition-over-inheritance" "For backward compatibility"
model CountDeviceResponse extends CountElementsResponse {}

/**
 * Response of the count for elements.
 */
model CountElementsResponse {
  /**
   * Number of children resources in parent resource.
   */
  value: int32;
}

/**
 * The properties of image
 */
model ImageProperties {
  /**
   * Image as a UTF-8 encoded base 64 string on image create. This field contains the image URI on image reads.
   */
  @visibility(Lifecycle.Read, Lifecycle.Create)
  image?: string;

  /**
   * Image ID
   */
  @visibility(Lifecycle.Read, Lifecycle.Create)
  imageId?: string;

  /**
   * Image name
   */
  @visibility(Lifecycle.Read)
  imageName?: string;

  /**
   * Regional data boundary for an image
   */
  @visibility(Lifecycle.Read, Lifecycle.Create)
  regionalDataBoundary?: RegionalDataBoundary;

  /**
   * Location the image
   */
  @visibility(Lifecycle.Read)
  uri?: string;

  /**
   * The image description.
   */
  @visibility(Lifecycle.Read)
  description?: string;

  /**
   * The image component id.
   */
  @visibility(Lifecycle.Read)
  componentId?: string;

  /**
   * The image type.
   */
  @visibility(Lifecycle.Read)
  imageType?: ImageType;

  /**
   * The status of the last operation.
   */
  @visibility(Lifecycle.Read)
  provisioningState?: ProvisioningState;
}

/**
 * The properties of deployment
 */
model DeploymentProperties {
  /**
   * Deployment ID
   */
  @visibility(Lifecycle.Read, Lifecycle.Create)
  deploymentId?: string;

  /**
   * Images deployed
   */
  @visibility(Lifecycle.Read, Lifecycle.Create)
  deployedImages?: Image[];

  /**
   * Deployment date UTC
   */
  @visibility(Lifecycle.Read)
  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  deploymentDateUtc?: utcDateTime;

  /**
   * The status of the last operation.
   */
  @visibility(Lifecycle.Read)
  provisioningState?: ProvisioningState;
}

/**
 * Request of the action to list device groups for a catalog.
 */
model ListDeviceGroupsRequest {
  /**
   * Device Group name.
   */
  deviceGroupName?: string;
}

/**
 * The properties of deviceGroup
 */
model DeviceGroupProperties {
  /**
   * Description of the device group.
   */
  description?: string;

  /**
   * Operating system feed type of the device group.
   */
  osFeedType?: OSFeedType;

  /**
   * Update policy of the device group.
   */
  updatePolicy?: UpdatePolicy;

  /**
   * Flag to define if the user allows for crash dump collection.
   */
  allowCrashDumpsCollection?: AllowCrashDumpCollection;

  /**
   * Regional data boundary for the device group.
   */
  regionalDataBoundary?: RegionalDataBoundary;

  /**
   * Deployment status for the device group.
   */
  @visibility(Lifecycle.Read)
  hasDeployment?: boolean;

  /**
   * The status of the last operation.
   */
  @visibility(Lifecycle.Read)
  provisioningState?: ProvisioningState;
}

/**
 * Paged collection of DeviceInsight items
 */
model PagedDeviceInsight is Azure.Core.Page<DeviceInsight>;

/**
 * Device insight report.
 */
model DeviceInsight {
  /**
   * Device ID
   */
  deviceId: string;

  /**
   * Event description
   */
  description: string;

  /**
   * Event start timestamp
   */
  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  startTimestampUtc: utcDateTime;

  /**
   * Event end timestamp
   */
  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  endTimestampUtc: utcDateTime;

  /**
   * Event category
   */
  eventCategory: string;

  /**
   * Event class
   */
  eventClass: string;

  /**
   * Event type
   */
  eventType: string;

  /**
   * Event count
   */
  eventCount: int32;
}

/**
 * The properties of device
 */
model DeviceProperties {
  /**
   * Device ID
   */
  @visibility(Lifecycle.Read, Lifecycle.Create)
  deviceId?: string;

  /**
   * SKU of the chip
   */
  @visibility(Lifecycle.Read)
  chipSku?: string;

  /**
   * OS version available for installation when update requested
   */
  @visibility(Lifecycle.Read)
  lastAvailableOsVersion?: string;

  /**
   * OS version running on device when update requested
   */
  @visibility(Lifecycle.Read)
  lastInstalledOsVersion?: string;

  /**
   * Time when update requested and new OS version available
   */
  @visibility(Lifecycle.Read)
  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  lastOsUpdateUtc?: utcDateTime;

  /**
   * Time when update was last requested
   */
  @visibility(Lifecycle.Read)
  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  lastUpdateRequestUtc?: utcDateTime;

  /**
   * The status of the last operation.
   */
  @visibility(Lifecycle.Read)
  provisioningState?: ProvisioningState;
}

/**
 * The properties of product
 */
model ProductProperties {
  /**
   * Description of the product
   */
  description: string;

  /**
   * The status of the last operation.
   */
  @visibility(Lifecycle.Read)
  provisioningState?: ProvisioningState;
}

/**
 * The type used for update operations of the Product.
 */
model ProductUpdate {
  /**
   * The updatable properties of the Product.
   */
  properties?: ProductUpdateProperties;
}

/**
 * The updatable properties of the Product.
 */
model ProductUpdateProperties {
  /**
   * Description of the product
   */
  description?: string;
}

/**
 * The type used for update operations of the DeviceGroup.
 */
model DeviceGroupUpdate {
  /**
   * The updatable properties of the DeviceGroup.
   */
  properties?: DeviceGroupUpdateProperties;
}

/**
 * The updatable properties of the DeviceGroup.
 */
model DeviceGroupUpdateProperties {
  /**
   * Description of the device group.
   */
  description?: string;

  /**
   * Operating system feed type of the device group.
   */
  osFeedType?: OSFeedType;

  /**
   * Update policy of the device group.
   */
  updatePolicy?: UpdatePolicy;

  /**
   * Flag to define if the user allows for crash dump collection.
   */
  allowCrashDumpsCollection?: AllowCrashDumpCollection;

  /**
   * Regional data boundary for the device group.
   */
  regionalDataBoundary?: RegionalDataBoundary;
}

/**
 * Request to the action call to bulk claim devices.
 */
model ClaimDevicesRequest {
  /**
   * Device identifiers of the devices to be claimed.
   */
  deviceIdentifiers: string[];
}

/**
 * The type used for update operations of the Device.
 */
model DeviceUpdate {
  /**
   * The updatable properties of the Device.
   */
  properties?: DeviceUpdateProperties;
}

/**
 * The updatable properties of the Device.
 */
model DeviceUpdateProperties {
  /**
   * Device group id
   */
  deviceGroupId?: string;
}

/**
 * Request of the action to create a signed device capability image
 */
model GenerateCapabilityImageRequest {
  /**
   * List of capabilities to create
   */
  capabilities: CapabilityType[];
}

/**
 * Signed device capability image response
 */
model SignedCapabilityImageResponse {
  /**
   * The signed device capability image as a UTF-8 encoded base 64 string.
   */
  @visibility(Lifecycle.Read)
  image?: string;
}

/**
 * The properties of device patch
 */
model DevicePatchProperties {
  /**
   * Device group id
   */
  deviceGroupId: string;
}

/**
 * Image upload request body.
 */
model ImageUploadRequestBody {
  /**
   * .
   */
  images: string;
}
