import "@azure-tools/typespec-azure-core";
import "@azure-tools/typespec-azure-resource-manager";
import "@typespec/openapi";
import "@typespec/rest";
import "./models.tsp";

using TypeSpec.Rest;
using Azure.ResourceManager;
using TypeSpec.Http;
using TypeSpec.OpenAPI;

namespace Microsoft.Test;
/**
 * A Test resource
 */
model Employee is Azure.ResourceManager.TrackedResource<EmployeeProperties> {
  ...ResourceNameParameter<
    Resource = Employee,
    KeyName = "employeeName",
    SegmentName = "employees"
  >;
}

@armResourceOperations
interface Employees {
  /**
   * Get a Employee
   */
  get is ArmResourceRead<Employee>;

  /**
   * Create a Employee
   */
  createOrUpdate is ArmResourceCreateOrReplaceAsync<Employee>;

  /**
   * Update a Employee
   */
  @patch(#{ implicitOptionality: false })
  update is ArmCustomPatchSync<Employee, PatchModel = EmployeeUpdate>;

  /**
   * Delete a Employee
   */
  delete is ArmResourceDeleteSync<Employee>;

  /**
   * List Employee resources by resource group
   */
  listByResourceGroup is ArmResourceListByParent<Employee>;

  /**
   * List Employee resources by subscription ID
   */
  listBySubscription is ArmListBySubscription<Employee>;
}

@@doc(Employee.name, "Name of employee");
@@doc(Employee.properties,
  "The resource-specific properties for this resource."
);
