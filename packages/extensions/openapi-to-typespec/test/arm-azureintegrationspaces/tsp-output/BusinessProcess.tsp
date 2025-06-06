import "@azure-tools/typespec-azure-core";
import "@azure-tools/typespec-azure-resource-manager";
import "@typespec/openapi";
import "@typespec/rest";
import "./models.tsp";
import "./Application.tsp";

using TypeSpec.Rest;
using Azure.ResourceManager;
using TypeSpec.Http;
using TypeSpec.OpenAPI;

namespace Microsoft.IntegrationSpaces;
/**
 * A business process under application.
 */
@parentResource(Application)
model BusinessProcess
  is Azure.ResourceManager.ProxyResource<BusinessProcessProperties> {
  ...ResourceNameParameter<
    Resource = BusinessProcess,
    KeyName = "businessProcessName",
    SegmentName = "businessProcesses",
    NamePattern = "[a-zA-Z0-9_.()-]{0,79}$"
  >;
}

@armResourceOperations
interface BusinessProcesses {
  /**
   * Get a BusinessProcess
   */
  get is ArmResourceRead<BusinessProcess>;

  /**
   * Create a BusinessProcess
   */
  createOrUpdate is ArmResourceCreateOrReplaceSync<BusinessProcess>;

  /**
   * Update a BusinessProcess
   */
  @patch(#{ implicitOptionality: false })
  patch is ArmCustomPatchSync<
    BusinessProcess,
    PatchModel = BusinessProcessUpdate
  >;

  /**
   * Delete a BusinessProcess
   */
  delete is ArmResourceDeleteSync<BusinessProcess>;

  /**
   * List BusinessProcess resources by Application
   */
  listByApplication is ArmResourceListByParent<
    BusinessProcess,
    Parameters = {
      /**
       * The number of result items to return.
       */
      @query("top")
      top?: int32;

      /**
       * The number of result items to skip.
       */
      @query("skip")
      skip?: int32;

      /**
       * The maximum number of result items per page.
       */
      @query("maxpagesize")
      maxpagesize?: int32;

      /**
       * Filter the result list using the given expression.
       */
      @query("filter")
      filter?: string;

      /**
       * Select the specified fields to be included in the response.
       */
      #suppress "@azure-tools/typespec-azure-core/no-query-explode" "For backward compatibility"
      @query(#{ name: "select", explode: true })
      select?: string[];

      /**
       * Expand the indicated resources into the response.
       */
      #suppress "@azure-tools/typespec-azure-core/no-query-explode" "For backward compatibility"
      @query(#{ name: "expand", explode: true })
      expand?: string[];

      /**
       * Expressions that specify the order of returned results.
       */
      #suppress "@azure-tools/typespec-azure-core/no-query-explode" "For backward compatibility"
      @query(#{ name: "orderby", explode: true })
      orderby?: string[];
    }
  >;
}

@@doc(BusinessProcess.name, "The name of the business process");
@@doc(BusinessProcess.properties,
  "The resource-specific properties for this resource."
);
