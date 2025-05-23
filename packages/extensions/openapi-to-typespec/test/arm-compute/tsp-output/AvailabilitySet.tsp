import "@azure-tools/typespec-azure-core";
import "@azure-tools/typespec-azure-resource-manager";
import "@typespec/openapi";
import "@typespec/rest";
import "./models.tsp";

using TypeSpec.Rest;
using Azure.ResourceManager;
using TypeSpec.Http;
using TypeSpec.OpenAPI;

namespace Microsoft.Compute;
/**
 * Specifies information about the availability set that the virtual machine should be assigned to. Virtual machines specified in the same availability set are allocated to different nodes to maximize availability. For more information about availability sets, see [Availability sets overview](https://docs.microsoft.com/azure/virtual-machines/availability-set-overview). For more information on Azure planned maintenance, see [Maintenance and updates for Virtual Machines in Azure](https://docs.microsoft.com/azure/virtual-machines/maintenance-and-updates). Currently, a VM can only be added to an availability set at creation time. An existing VM cannot be added to an availability set.
 */
model AvailabilitySet
  is Azure.ResourceManager.TrackedResource<AvailabilitySetProperties> {
  ...ResourceNameParameter<
    Resource = AvailabilitySet,
    KeyName = "availabilitySetName",
    SegmentName = "availabilitySets",
    NamePattern = ""
  >;

  /**
   * Sku of the availability set, only name is required to be set. See AvailabilitySetSkuTypes for possible set of values. Use 'Aligned' for virtual machines with managed disks and 'Classic' for virtual machines with unmanaged disks. Default value is 'Classic'.
   */
  #suppress "@azure-tools/typespec-azure-resource-manager/arm-resource-invalid-envelope-property" "For backward compatibility"
  sku?: Sku;
}

@armResourceOperations
interface AvailabilitySets {
  /**
   * Retrieves information about an availability set.
   */
  get is ArmResourceRead<AvailabilitySet>;

  /**
   * Create or update an availability set.
   */
  #suppress "@azure-tools/typespec-azure-resource-manager/arm-put-operation-response-codes" "For backward compatibility"
  createOrUpdate is ArmResourceCreateOrReplaceSync<
    AvailabilitySet,
    Response = ArmResourceUpdatedResponse<AvailabilitySet>
  >;

  /**
   * Update an availability set.
   */
  @patch(#{ implicitOptionality: false })
  update is ArmCustomPatchSync<
    AvailabilitySet,
    PatchModel = AvailabilitySetUpdate
  >;

  /**
   * Delete an availability set.
   */
  delete is ArmResourceDeleteSync<AvailabilitySet>;

  /**
   * Lists all availability sets in a resource group.
   */
  list is ArmResourceListByParent<AvailabilitySet>;

  /**
   * Lists all availability sets in a subscription.
   */
  listBySubscription is ArmListBySubscription<
    AvailabilitySet,
    Parameters = {
      /**
       * The expand expression to apply to the operation. Allowed values are 'instanceView'.
       */
      @query("$expand")
      $expand?: string;
    }
  >;

  /**
   * Lists all available virtual machine sizes that can be used to create a new virtual machine in an existing availability set.
   */
  @get
  @action("vmSizes")
  listAvailableSizes is ArmResourceActionSync<
    AvailabilitySet,
    void,
    ArmResponse<VirtualMachineSizeListResult>
  >;
}

@@doc(AvailabilitySet.name, "The name of the availability set.");
@@doc(AvailabilitySet.properties, "The instance view of a resource.");
@@doc(AvailabilitySets.createOrUpdate::parameters.resource,
  "Parameters supplied to the Create Availability Set operation."
);
@@doc(AvailabilitySets.update::parameters.properties,
  "Parameters supplied to the Update Availability Set operation."
);
