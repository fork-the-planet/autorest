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
 * Describes a Virtual Machine Extension Image.
 */
@subscriptionResource
@parentResource(SubscriptionLocationResource)
model VirtualMachineExtensionImage
  is Azure.ResourceManager.TrackedResource<VirtualMachineExtensionImageProperties> {
  ...ResourceNameParameter<
    Resource = VirtualMachineExtensionImage,
    KeyName = "version",
    SegmentName = "versions",
    NamePattern = ""
  >;
}

@armResourceOperations
interface VirtualMachineExtensionImages {
  /**
   * Gets a virtual machine extension image.
   */
  get is ArmResourceRead<
    VirtualMachineExtensionImage,
    BaseParameters = Azure.ResourceManager.Foundations.SubscriptionBaseParameters
  >;

  /**
   * Gets a list of virtual machine extension image types.
   */
  listTypes is ArmResourceListByParent<
    VirtualMachineExtensionImage,
    BaseParameters = Azure.ResourceManager.Foundations.SubscriptionBaseParameters,
    Response = ArmResponse<VirtualMachineExtensionImage[]>
  >;
}

@@doc(VirtualMachineExtensionImage.name, "");
@@doc(VirtualMachineExtensionImage.properties,
  "Describes the properties of a Virtual Machine Extension Image."
);
