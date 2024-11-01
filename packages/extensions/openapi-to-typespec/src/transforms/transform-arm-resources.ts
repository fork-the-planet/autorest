import {
  ArraySchema,
  ObjectSchema,
  Operation,
  Parameter,
  Property,
  Response,
  SchemaResponse,
  SchemaType,
} from "@autorest/codemodel";
import _ from "lodash";
import pluralize, { singular } from "pluralize";
import { getArmCommonTypeVersion, getSession } from "../autorest-session";
import { getDataTypes } from "../data-types";
import { generateParameter } from "../generate/generate-parameter";
import {
  ArmResourceKind,
  TypespecDecorator,
  TypespecObjectProperty,
  TypespecOperation,
  TypespecParameter,
  TspArmResource,
  TspArmResourceOperation,
  isFirstLevelResource,
} from "../interfaces";
import { getOptions, updateOptions } from "../options";
import { createClientNameDecorator, createCSharpNameDecorator } from "../pretransforms/rename-pretransform";
import { getOperationClientDecorators } from "../utils/decorators";
import { generateDocsContent } from "../utils/docs";
import {
  ArmResource,
  ArmResourceSchema,
  _ArmResourceOperation,
  getResourceExistOperation as getResourceExistsOperation,
  getResourceOperations,
  isResourceSchema,
} from "../utils/resource-discovery";
import { isArraySchema, isResponseSchema } from "../utils/schemas";
import {
  getSuppressionsForArmResourceCreateOrReplaceAsync,
  getSuppressionsForArmResourceDeleteAsync,
  getSuppressionsForArmResourceDeleteSync,
} from "../utils/suppressions";
import { getFullyQualifiedName, isResourceListResult } from "../utils/type-mapping";
import { getTypespecType, transformObjectProperty } from "./transform-object";
import { transformParameter, transformRequest } from "./transform-operations";

const armResourceCache: Map<ArmResourceSchema, TspArmResource> = new Map<ArmResourceSchema, TspArmResource>();
export function transformTspArmResource(schema: ArmResourceSchema): TspArmResource {
  if (armResourceCache.has(schema)) return armResourceCache.get(schema)!;

  const { isFullCompatible } = getOptions();
  const fixMe: string[] = [];

  if (!getSession().configuration["namespace"]) {
    const segments = schema.resourceMetadata.GetOperations[0].Path.split("/");
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i] === "providers") {
        getSession().configuration["namespace"] = segments[i + 1];
        updateOptions();
        break;
      }
    }
  }

  // TODO: deal with a resource with multiple parents
  if (schema.resourceMetadata.Parents.length > 1) {
    fixMe.push(
      `// FIXME: ${schema.resourceMetadata.SwaggerModelName} has more than one parent, currently converter will only use the first one`,
    );
  }

  const propertiesModel = schema.properties?.find((p) => p.serializedName === "properties");
  const propertiesModelSchema = propertiesModel?.schema;
  let propertiesModelName = propertiesModelSchema?.language.default.name;
  let propertiesPropertyRequired = false;
  let propertiesPropertyDescription = "";

  if (propertiesModelSchema?.type === SchemaType.Dictionary) {
    propertiesModelName = "Record<unknown>";
  } else if (propertiesModelSchema?.type === SchemaType.Object) {
    propertiesPropertyRequired = propertiesModel?.required ?? false;
    propertiesPropertyDescription = propertiesModel?.language.default.description ?? "";
  }

  // TODO: deal with resources that has no properties property
  if (!propertiesModelName) {
    fixMe.push(`// FIXME: ${schema.resourceMetadata.SwaggerModelName} has no properties property`);
    propertiesModelName = "{}";
  }

  const operations = getTspOperations(schema);

  let baseModelName = undefined;
  if (!getArmCommonTypeVersion()) {
    const immediateParents = schema.parents?.immediate ?? [];

    baseModelName = immediateParents
      .filter((p) => p.language.default.name !== schema.language.default.name)
      .map((p) => p.language.default.name)[0];
  }

  const decorators = buildResourceDecorators(schema);
  if (!getArmCommonTypeVersion() && schema.resourceMetadata.IsExtensionResource) {
    decorators.push({ name: "extensionResource" });
  }

  const armResourceOperations = operations[0];
  const otherOperations = operations[1];

  const clientDecorators = buildResourceClientDecorators(schema, armResourceOperations, otherOperations);
  const keyProperty = buildKeyProperty(schema);
  const properties = [...getOtherProperties(schema, !getArmCommonTypeVersion())];
  let keyExpression, augmentDecorators;
  if (keyProperty.name === "name") {
    keyExpression = buildKeyExpression(schema, keyProperty);
    augmentDecorators = buildKeyAugmentDecorators(schema, keyProperty);
  } else {
    properties.unshift(keyProperty);
  }

  if (propertiesModel) {
    if (augmentDecorators === undefined) augmentDecorators = buildPropertiesAugmentDecorators(schema, propertiesModel);
    else augmentDecorators.push(...buildPropertiesAugmentDecorators(schema, propertiesModel));
  }

  const propertiesPropertyClientDecorator = [];
  if (isFullCompatible && propertiesModel?.extensions?.["x-ms-client-flatten"]) {
    propertiesPropertyClientDecorator.push({
      name: "flattenProperty",
      module: "@azure-tools/typespec-client-generator-core",
      namespace: "Azure.ClientGenerator.Core",
      suppressionCode: "deprecated",
      suppressionMessage: "@flattenProperty decorator is not recommended to use.",
    });
  }

  const tspResource: TspArmResource = {
    fixMe,
    resourceKind: getResourceKind(schema),
    kind: "object",
    properties,
    keyExpression,
    name: schema.resourceMetadata.SwaggerModelName,
    parents: [],
    resourceParent: getParentResource(schema),
    propertiesModelName,
    propertiesPropertyRequired,
    propertiesPropertyDescription,
    propertiesPropertyClientDecorator,
    doc: schema.language.default.description,
    decorators,
    clientDecorators,
    augmentDecorators,
    resourceOperations: armResourceOperations,
    normalOperations: otherOperations,
    optionalStandardProperties: getArmCommonTypeVersion() ? getResourceOptionalStandardProperties(schema) : [],
    baseModelName,
    locationParent: getLocationParent(schema),
  };
  armResourceCache.set(schema, tspResource);
  return tspResource;
}

function getOtherProperties(schema: ArmResourceSchema, noCommonTypes: boolean): TypespecObjectProperty[] {
  const knownProperties = ["properties", "name"];
  if (!noCommonTypes) {
    knownProperties.push(...["id", "type", "systemData", "location", "tags", "identity", "sku", "eTag", "plan"]);
  }
  const otherProperties: TypespecObjectProperty[] = [];
  for (const property of schema.properties ?? []) {
    if (!knownProperties.includes(property.serializedName)) {
      otherProperties.push(transformObjectProperty(property, getSession().model));
    }
  }
  return otherProperties;
}

function getResourceOptionalStandardProperties(schema: ArmResourceSchema): string[] {
  const optionalStandardProperties = [];

  const msi = schema.properties?.find((p) => p.serializedName === "identity");
  if (msi) {
    let msiType;
    if (msi.schema.language.default.name === "ManagedServiceIdentity") {
      msiType = "Azure.ResourceManager.ManagedServiceIdentityProperty";
    } else if (msi.schema.language.default.name === "SystemAssignedServiceIdentity") {
      msiType = "Azure.ResourceManager.ManagedSystemAssignedIdentityProperty";
    } else {
      // TODO: handle non-standard property
      msiType = "Azure.ResourceManager.ManagedServiceIdentityProperty";
    }
    optionalStandardProperties.push(msiType);
  }

  if (schema.properties?.find((p) => p.serializedName === "sku")) {
    // TODO: handle non-standard property
    optionalStandardProperties.push("Azure.ResourceManager.ResourceSkuProperty");
  }

  if (schema.properties?.find((p) => p.serializedName === "eTag")) {
    // TODO: handle non-standard property
    optionalStandardProperties.push("Azure.ResourceManager.EntityTagProperty");
  }

  if (schema.properties?.find((p) => p.serializedName === "plan")) {
    // TODO: handle non-standard property
    optionalStandardProperties.push("Azure.ResourceManager.ResourcePlanProperty");
  }

  return optionalStandardProperties;
}

function convertResourceReadOperation(
  resourceMetadata: ArmResource,
  operations: Record<string, Operation>,
): TspArmResourceOperation[] {
  // every resource should have a get operation
  const operation = resourceMetadata.GetOperations[0];
  const swaggerOperation = operations[operation.OperationID];
  const parameters = buildOperationParameters(swaggerOperation, resourceMetadata);
  const templateParameters = [resourceMetadata.SwaggerModelName];
  if (parameters.baseParameters) {
    templateParameters.push(parameters.baseParameters);
  }
  if (parameters.parameters) {
    templateParameters.push(`Parameters = ${parameters.parameters}`);
  }
  return [
    {
      doc: resourceMetadata.GetOperations[0].Description, // TODO: resource have duplicated CRUD operations
      kind: "ArmResourceRead",
      name: getOperationName(resourceMetadata.Name, operation.OperationID),
      operationId: operation.OperationID,
      clientDecorators: getOperationClientDecorators(swaggerOperation),
      templateParameters,
      examples: swaggerOperation.extensions?.["x-ms-examples"],
    },
  ];
}

function convertResourceExistsOperation(resourceMetadata: ArmResource): TspArmResourceOperation[] {
  const swaggerOperation = getResourceExistsOperation(resourceMetadata);
  if (swaggerOperation) {
    return [
      {
        doc: swaggerOperation.language.default.description,
        kind: "ArmResourceExists",
        name: swaggerOperation.operationId
          ? getOperationName(resourceMetadata.Name, swaggerOperation.operationId)
          : "exists",
        clientDecorators: getOperationClientDecorators(swaggerOperation),
        operationId: swaggerOperation.operationId,
        parameters: [
          `...ResourceInstanceParameters<${resourceMetadata.SwaggerModelName}, BaseParameters<${resourceMetadata.SwaggerModelName}>>`,
        ],
        responses: ["OkResponse", "ErrorResponse"],
        decorators: [{ name: "head" }],
        examples: swaggerOperation.extensions?.["x-ms-examples"],
      },
    ];
  }
  return [];
}

export function getTSPOperationGroupName(resourceName: string): string {
  const codeModel = getSession().model;
  const operationGroupName = pluralize(resourceName);
  if (
    operationGroupName === resourceName ||
    codeModel.schemas.objects?.find((o) => o.language.default.name === operationGroupName)
  ) {
    return `${operationGroupName}OperationGroup`;
  } else {
    return operationGroupName;
  }
}

function convertResourceCreateOrReplaceOperation(
  resourceMetadata: ArmResource,
  operations: Record<string, Operation>,
): TspArmResourceOperation[] {
  const { isFullCompatible } = getOptions();
  if (resourceMetadata.CreateOperations.length) {
    const operation = resourceMetadata.CreateOperations[0];
    const swaggerOperation = operations[operation.OperationID];
    const bodyParam = swaggerOperation.requests?.[0].parameters?.find((p) => p.protocol.http?.in === "body");
    const isLongRunning = swaggerOperation.extensions?.["x-ms-long-running-operation"] ?? false;
    const parameters = buildOperationParameters(swaggerOperation, resourceMetadata);
    const templateParameters = [resourceMetadata.SwaggerModelName];
    if (parameters.baseParameters) {
      templateParameters.push(parameters.baseParameters);
    }
    if (parameters.parameters) {
      templateParameters.push(`Parameters = ${parameters.parameters}`);
    }
    const tspOperationGroupName = getTSPOperationGroupName(resourceMetadata.SwaggerModelName);
    const operationName = getOperationName(resourceMetadata.Name, operation.OperationID);
    const [customizations, clientDecorators] = getCustomizations(
      bodyParam,
      tspOperationGroupName,
      operationName,
      "resource",
      "Resource create parameters.",
    );

    let suppressions = undefined;
    if (isFullCompatible) {
      const acceptedResponse = swaggerOperation.responses?.find((r) => r.protocol.http?.statusCodes[0] === "202");
      if (acceptedResponse) {
        let responseParameter = `ArmResourceCreatedResponse<${resourceMetadata.SwaggerModelName}> | ArmResourceUpdatedResponse<${resourceMetadata.SwaggerModelName}>`;
        if (isResponseSchema(acceptedResponse) && acceptedResponse.schema) {
          responseParameter += `| (ArmAcceptedLroResponse & {@bodyRoot _: ${resourceMetadata.SwaggerModelName};})`;
        } else responseParameter += `| ArmAcceptedLroResponse`;
        templateParameters.push(`Response = ${responseParameter}`);
        suppressions = getSuppressionsForArmResourceCreateOrReplaceAsync();
      }
    }

    return [
      {
        doc: operation.Description,
        kind: isLongRunning ? "ArmResourceCreateOrReplaceAsync" : "ArmResourceCreateOrReplaceSync",
        name: operationName,
        clientDecorators: getOperationClientDecorators(swaggerOperation),
        operationId: operation.OperationID,
        templateParameters: templateParameters,
        examples: swaggerOperation.extensions?.["x-ms-examples"],
        customizations,
        suppressions,
      },
    ];
  }
  return [];
}

function getCustomizations(
  bodyParam: Parameter | undefined,
  tspOperationGroupName: string,
  operationName: string,
  templateName: string,
  templateDoc: string,
): [string[], TypespecDecorator[]] {
  const { isFullCompatible } = getOptions();

  const augmentedDecorators = [];
  const clientDecorators = [];
  if (bodyParam) {
    if (bodyParam.language.default.name !== templateName && isFullCompatible) {
      clientDecorators.push(
        createClientNameDecorator(
          `${tspOperationGroupName}.${operationName}::parameters.${templateName}`,
          `${bodyParam.language.default.name}`,
        ),
      );
    }
    if (bodyParam.language.default.description !== templateDoc) {
      augmentedDecorators.push(
        `@@doc(${tspOperationGroupName}.\`${operationName}\`::parameters.${templateName}, "${bodyParam.language.default.description}");`,
      );
    }
  }
  return [augmentedDecorators, clientDecorators];
}

function convertResourceUpdateOperation(
  resourceMetadata: ArmResource,
  operations: Record<string, Operation>,
): TspArmResourceOperation[] {
  if (resourceMetadata.UpdateOperations.length) {
    const operation = resourceMetadata.UpdateOperations[0];
    if (
      !resourceMetadata.CreateOperations.length ||
      resourceMetadata.CreateOperations[0].OperationID !== operation.OperationID
    ) {
      const swaggerOperation = operations[operation.OperationID];
      const isLongRunning = swaggerOperation.extensions?.["x-ms-long-running-operation"] ?? false;
      const parameters = buildOperationParameters(swaggerOperation, resourceMetadata);
      const bodyParam = swaggerOperation.requests?.[0].parameters?.find((p) => p.protocol.http?.in === "body");
      const fixMe: string[] = [];
      if (!bodyParam) {
        fixMe.push(
          "// FIXME: (ArmResourcePatch): ArmResourcePatchSync/ArmResourcePatchAsync should have a body parameter with either properties property or tag property",
        );
      }

      const tspOperationGroupName = getTSPOperationGroupName(resourceMetadata.SwaggerModelName);
      const operationName = getOperationName(resourceMetadata.Name, operation.OperationID);
      const customizations = getCustomizations(
        bodyParam,
        tspOperationGroupName,
        operationName,
        "properties",
        "The resource properties to be updated.",
      );

      let kind;
      const templateParameters = [resourceMetadata.SwaggerModelName];
      if (bodyParam) {
        kind = isLongRunning ? "ArmCustomPatchAsync" : "ArmCustomPatchSync";
        templateParameters.push(bodyParam.schema.language.default.name);
      } else {
        kind = isLongRunning ? "ArmCustomPatchAsync" : "ArmCustomPatchSync";
        templateParameters.push("{}");
      }
      if (parameters.baseParameters) {
        templateParameters.push(parameters.baseParameters);
      }
      if (parameters.parameters) {
        templateParameters.push(`Parameters = ${parameters.parameters}`);
      }
      return [
        {
          fixMe,
          doc: operation.Description,
          kind: kind as any,
          name: operationName,
          clientDecorators: getOperationClientDecorators(swaggerOperation).concat(customizations[1]),
          operationId: operation.OperationID,
          templateParameters,
          examples: swaggerOperation.extensions?.["x-ms-examples"],
          customizations: customizations[0],
          // To resolve auto-generate update model with proper visibility
          decorators: [{ name: "parameterVisibility", arguments: [] }],
        },
      ];
    }
  }
  return [];
}

function convertResourceDeleteOperation(
  resourceMetadata: ArmResource,
  operations: Record<string, Operation>,
): TspArmResourceOperation[] {
  if (resourceMetadata.DeleteOperations.length) {
    const operation = resourceMetadata.DeleteOperations[0];
    const swaggerOperation = operations[operation.OperationID];
    const isLongRunning = swaggerOperation.extensions?.["x-ms-long-running-operation"] ?? false;
    const okResponse = swaggerOperation?.responses?.filter((o) => o.protocol.http?.statusCodes.includes("200"))?.[0];
    const parameters = buildOperationParameters(swaggerOperation, resourceMetadata);
    const templateParameters = [resourceMetadata.SwaggerModelName];
    const kind = isLongRunning
      ? okResponse
        ? "ArmResourceDeleteAsync"
        : "ArmResourceDeleteWithoutOkAsync"
      : "ArmResourceDeleteSync";
    const suppressions =
      kind === "ArmResourceDeleteAsync"
        ? getSuppressionsForArmResourceDeleteAsync()
        : kind === "ArmResourceDeleteSync"
          ? getSuppressionsForArmResourceDeleteSync()
          : undefined;
    if (parameters.baseParameters) {
      templateParameters.push(parameters.baseParameters);
    }
    if (parameters.parameters) {
      templateParameters.push(`Parameters = ${parameters.parameters}`);
    }
    return [
      {
        doc: operation.Description,
        kind: kind,
        name: getOperationName(resourceMetadata.Name, operation.OperationID),
        clientDecorators: getOperationClientDecorators(swaggerOperation),
        operationId: operation.OperationID,
        templateParameters,
        examples: swaggerOperation.extensions?.["x-ms-examples"],
        suppressions: suppressions,
      },
    ];
  }
  return [];
}

function convertResourceListOperations(
  resourceMetadata: ArmResource,
  operations: Record<string, Operation>,
): TspArmResourceOperation[] {
  const converted: TspArmResourceOperation[] = [];

  // list by parent operation
  if (resourceMetadata.ListOperations.length) {
    // TODO: TParentName, TParentFriendlyName
    const operation = resourceMetadata.ListOperations[0];
    const swaggerOperation = operations[operation.OperationID];
    const okResponse = swaggerOperation?.responses?.filter((o) => o.protocol.http?.statusCodes.includes("200"))?.[0];
    const templateParameters = [resourceMetadata.SwaggerModelName];
    const parameters = buildOperationParameters(swaggerOperation, resourceMetadata);
    if (parameters.baseParameters) {
      templateParameters.push(parameters.baseParameters);
    }
    if (parameters.parameters) {
      templateParameters.push(`Parameters = ${parameters.parameters}`);
    }
    const responseSchemaName = getSchemaResponseSchemaName(okResponse);
    if (responseSchemaName && !isResourceListResult(okResponse as SchemaResponse)) {
      templateParameters.push(`Response = ${responseSchemaName}`);
    }

    converted.push({
      doc: operation.Description,
      kind: "ArmResourceListByParent",
      name: getOperationName(resourceMetadata.Name, operation.OperationID),
      clientDecorators: getOperationClientDecorators(swaggerOperation),
      operationId: operation.OperationID,
      templateParameters: templateParameters,
      examples: swaggerOperation.extensions?.["x-ms-examples"],
    });
  }

  // list operation under subscription
  if (resourceMetadata.OperationsFromSubscriptionExtension.length) {
    for (const operation of resourceMetadata.OperationsFromSubscriptionExtension) {
      if (operation.PagingMetadata) {
        const swaggerOperation = operations[operation.OperationID];
        const okResponse = swaggerOperation?.responses?.filter(
          (o) => o.protocol.http?.statusCodes.includes("200"),
        )?.[0];
        const responseSchemaName = getSchemaResponseSchemaName(okResponse);
        const parameters = buildOperationParameters(swaggerOperation, resourceMetadata);

        // either list in location or list in subscription
        if (operation.Path.includes("/locations/")) {
          const templateParameters = [
            resourceMetadata.SwaggerModelName,
            `LocationScope<${resourceMetadata.SwaggerModelName}>`,
          ];
          if (parameters.baseParameters) {
            templateParameters.push(parameters.baseParameters);
          }
          if (parameters.parameters) {
            templateParameters.push(`Parameters = ${parameters.parameters}`);
          }
          if (!responseSchemaName || !isResourceListResult(okResponse as SchemaResponse)) {
            templateParameters.push(`Response = ${responseSchemaName}`);
          }
          converted.push({
            doc: operation.Description,
            kind: "ArmResourceListAtScope",
            name: getOperationName(resourceMetadata.Name, operation.OperationID),
            clientDecorators: getOperationClientDecorators(swaggerOperation),
            operationId: operation.OperationID,
            templateParameters,
            examples: swaggerOperation.extensions?.["x-ms-examples"],
          });
        } else {
          const templateParameters = [resourceMetadata.SwaggerModelName];
          if (parameters.parameters) {
            templateParameters.push(`Parameters = ${parameters.parameters}`);
          }
          if (!responseSchemaName || !isResourceListResult(okResponse as SchemaResponse)) {
            templateParameters.push(`Response = ${responseSchemaName}`);
          }
          converted.push({
            doc: operation.Description,
            kind: "ArmListBySubscription",
            name: getOperationName(resourceMetadata.Name, operation.OperationID),
            clientDecorators: getOperationClientDecorators(swaggerOperation),
            operationId: operation.OperationID,
            templateParameters,
            examples: swaggerOperation.extensions?.["x-ms-examples"],
          });
        }
      }
    }
  }

  return converted;
}

function convertResourceActionOperations(
  resourceMetadata: ArmResource,
  operations: Record<string, Operation>,
): TspArmResourceOperation[] {
  const codeModel = getSession().model;
  const dataTypes = getDataTypes(codeModel);

  const converted: TspArmResourceOperation[] = [];

  if (resourceMetadata.OtherOperations.length) {
    for (const operation of resourceMetadata.OtherOperations) {
      const swaggerOperation = operations[operation.OperationID];
      const bodyParam = swaggerOperation.requests?.[0].parameters?.find((p) => p.protocol.http?.in === "body");
      const isLongRunning = swaggerOperation.extensions?.["x-ms-long-running-operation"] ?? false;
      const okResponse = swaggerOperation?.responses?.filter((o) => o.protocol.http?.statusCodes.includes("200"))?.[0];
      // TODO: deal with non-schema response for action
      let operationResponseName;
      if (okResponse && isResponseSchema(okResponse)) {
        if (!okResponse.schema.language.default.name.includes("·")) {
          operationResponseName = okResponse.schema.language.default.name;
          if (isResourceListResult(okResponse)) {
            const valueSchema = ((okResponse as SchemaResponse).schema as ObjectSchema).properties?.find(
              (p) => p.language.default.name === "value",
            );
            const responseName = dataTypes.get((valueSchema!.schema as ArraySchema).elementType)?.name;
            operationResponseName = `ResourceListResult<${responseName ?? "void"}>`;
          }
        }
      }

      const request = bodyParam ? getTypespecType(bodyParam.schema, getSession().model) : "void";
      const parameters = buildOperationParameters(swaggerOperation, resourceMetadata);
      let kind;
      if (!okResponse) {
        // TODO: Sync operation should have a 204 response
        kind = isLongRunning ? "ArmResourceActionNoResponseContentAsync" : "ArmResourceActionNoContentSync";
      } else {
        kind = isLongRunning ? "ArmResourceActionAsync" : "ArmResourceActionSync";
      }
      const templateParameters = [resourceMetadata.SwaggerModelName, request];
      if (okResponse) {
        templateParameters.push(operationResponseName ?? "void");
      }
      if (parameters.baseParameters) {
        templateParameters.push(parameters.baseParameters);
      }
      if (parameters.parameters) {
        templateParameters.push(`Parameters = ${parameters.parameters}`);
      }

      const tspOperationGroupName = getTSPOperationGroupName(resourceMetadata.SwaggerModelName);
      const operationName = getOperationName(resourceMetadata.Name, operation.OperationID);
      const customizations = getCustomizations(
        bodyParam,
        tspOperationGroupName,
        operationName,
        "body",
        "The content of the action request",
      );

      const verbDecorator: TypespecDecorator | undefined =
        operation.Method !== "POST"
          ? {
              name: operation.Method.toLocaleLowerCase(),
            }
          : undefined;

      converted.push({
        doc: operation.Description,
        kind: kind as any,
        name: operationName,
        clientDecorators: getOperationClientDecorators(swaggerOperation).concat(customizations[1]),
        operationId: operation.OperationID,
        templateParameters,
        examples: swaggerOperation.extensions?.["x-ms-examples"],
        customizations: customizations[0],
        decorators: verbDecorator !== undefined ? [verbDecorator] : undefined,
      });
    }
  }

  return converted;
}

function convertCheckNameAvailabilityOperations(
  resourceMetadata: ArmResource,
  operations: Record<string, Operation>,
): TspArmResourceOperation[] {
  const converted: TspArmResourceOperation[] = [];

  // check name availability operation under subscription
  if (resourceMetadata.OperationsFromSubscriptionExtension.length) {
    for (const operation of resourceMetadata.OperationsFromSubscriptionExtension) {
      if (operation.Path.includes("/checkNameAvailability")) {
        const swaggerOperation = operations[operation.OperationID];
        const response =
          (
            swaggerOperation?.responses?.filter(
              (o) => o.protocol.http?.statusCodes.includes("200"),
            )?.[0] as SchemaResponse
          ).schema?.language.default.name ?? "CheckNameAvailabilityResponse";
        const bodyParam = swaggerOperation.requests?.[0].parameters?.find((p) => p.protocol.http?.in === "body");
        const request = bodyParam ? bodyParam.schema.language.default.name : "CheckNameAvailabilityRequest";
        if (operation.Path.includes("/locations/")) {
          converted.push({
            doc: operation.Description,
            kind: "checkLocalNameAvailability",
            name: getOperationName(resourceMetadata.Name, operation.OperationID),
            clientDecorators: getOperationClientDecorators(swaggerOperation),
            operationId: operation.OperationID,
            examples: swaggerOperation.extensions?.["x-ms-examples"],
            templateParameters: [request, response],
          });
        } else {
          converted.push({
            doc: operation.Description,
            kind: "checkGlobalNameAvailability",
            name: getOperationName(resourceMetadata.Name, operation.OperationID),
            clientDecorators: getOperationClientDecorators(swaggerOperation),
            operationId: operation.OperationID,
            examples: swaggerOperation.extensions?.["x-ms-examples"],
            templateParameters: [request, response],
          });
        }
      }
    }
  }

  return converted;
}

function getTspOperations(armSchema: ArmResourceSchema): [TspArmResourceOperation[], TypespecOperation[]] {
  const resourceMetadata = armSchema.resourceMetadata;
  const operations = getResourceOperations(resourceMetadata);
  const tspOperations: TspArmResourceOperation[] = [];
  const normalOperations: TypespecOperation[] = [];

  // TODO: handle operations under resource group / management group / tenant

  // read operation
  tspOperations.push(...convertResourceReadOperation(resourceMetadata, operations));

  // exist operation
  tspOperations.push(...convertResourceExistsOperation(resourceMetadata));

  // create operation
  tspOperations.push(...convertResourceCreateOrReplaceOperation(resourceMetadata, operations));

  // patch update operation could either be patch for resource/tag or custom patch
  tspOperations.push(...convertResourceUpdateOperation(resourceMetadata, operations));

  // delete operation
  tspOperations.push(...convertResourceDeleteOperation(resourceMetadata, operations));

  // list operation
  tspOperations.push(...convertResourceListOperations(resourceMetadata, operations));

  // action operation
  tspOperations.push(...convertResourceActionOperations(resourceMetadata, operations));

  // check name availability operation
  tspOperations.push(...convertCheckNameAvailabilityOperations(resourceMetadata, operations));

  return [tspOperations, normalOperations];
}

const existingNames: { [resourceName: string]: Set<string> } = {};
// TO-DO: Figure out a way to create a new name if the name exists
function getOperationName(resourceName: string, operationId: string): string {
  let operationName = _.lowerFirst(_.last(operationId.split("_")));
  if (resourceName in existingNames) {
    if (existingNames[resourceName].has(operationName)) {
      operationName = _.lowerFirst(
        operationId
          .split("_")
          .map((n) => _.upperFirst(n))
          .join(""),
      );
    }
    existingNames[resourceName].add(operationName);
  } else {
    existingNames[resourceName] = new Set<string>([operationName]);
  }
  return operationName;
}

function getOperationGroupName(name: string | undefined): string {
  if (name && name.includes("_")) {
    return _.first(name.split("_"))!;
  } else {
    return "";
  }
}

function buildOperationParameters(
  operation: Operation,
  resource: ArmResource,
): Record<"baseParameters" | "parameters", string | undefined> {
  const codeModel = getSession().model;
  const otherParameters: TypespecParameter[] = [];
  const pathParameters = [];
  resource.GetOperations[0].Path.split("/").forEach((p) => {
    if (p.match(/^{.+}$/)) {
      pathParameters.push(p.replace("{", "").replace("}", ""));
    }
  });
  pathParameters.push("api-version");
  pathParameters.push("$host");
  if (operation.parameters) {
    for (const parameter of operation.parameters) {
      if (resource.IsSingletonResource && parameter.schema.type === SchemaType.Constant) {
        continue;
      }
      if (!pathParameters.includes(parameter.language.default.serializedName)) {
        otherParameters.push(transformParameter(parameter, codeModel));
      }
    }
  }

  // By default we don't need any base parameters.
  let parameterTemplate = undefined;
  if (resource.IsExtensionResource) {
    parameterTemplate = `${getFullyQualifiedName("ExtensionBaseParameters")}`;
  } else if (resource.IsTenantResource) {
    parameterTemplate = `${getFullyQualifiedName("TenantBaseParameters")}`;
  } else if (resource.IsSubscriptionResource) {
    parameterTemplate = `${getFullyQualifiedName("SubscriptionBaseParameters")}`;
  }

  return {
    baseParameters: parameterTemplate,
    parameters: otherParameters.length
      ? `{
    ${otherParameters.map((p) => generateParameter(p)).join(";\n")}
    }`
      : undefined,
  };
}

function getKeyParameter(resourceMetadata: ArmResource): Parameter | undefined {
  for (const operationGroup of getSession().model.operationGroups) {
    for (const operation of operationGroup.operations) {
      if (operation.operationId === resourceMetadata.GetOperations[0].OperationID) {
        for (const parameter of operation.parameters ?? []) {
          if (parameter.language.default.serializedName === resourceMetadata.ResourceKey) {
            return parameter;
          }
        }
      }
    }
  }
}

function generateSingletonKeyParameter(): TypespecParameter {
  return {
    kind: "parameter",
    name: "name",
    isOptional: false,
    type: "string",
    location: "path",
    serializedName: "name",
  };
}

function getParentResource(schema: ArmResourceSchema): TspArmResource | undefined {
  const resourceParent = schema.resourceMetadata.Parents?.[0];

  if (!resourceParent || isFirstLevelResource(resourceParent)) {
    return undefined;
  }

  for (const objectSchema of getSession().model.schemas.objects ?? []) {
    if (!isResourceSchema(objectSchema)) {
      continue;
    }

    if (objectSchema.resourceMetadata.Name === resourceParent) {
      return transformTspArmResource(objectSchema);
    }
  }
}

function getResourceKind(schema: ArmResourceSchema): ArmResourceKind {
  if (schema.resourceMetadata.IsExtensionResource) {
    return "ExtensionResource";
  }

  if (schema.resourceMetadata.IsTrackedResource) {
    return "TrackedResource";
  }

  return "ProxyResource";
}

function getSchemaResponseSchemaName(response: Response | undefined): string | undefined {
  if (!response || !isResponseSchema(response) || isArraySchema(response.schema)) {
    return undefined;
  }

  return (response as SchemaResponse).schema.language.default.name;
}

function buildKeyExpression(schema: ArmResourceSchema, keyProperty: TypespecObjectProperty): string {
  const namePattern = keyProperty.decorators?.find((d) => d.name === "pattern")?.arguments?.[0];
  const keyName = keyProperty.decorators?.find((d) => d.name === "key")?.arguments?.[0];
  const segmentName = keyProperty.decorators?.find((d) => d.name === "segment")?.arguments?.[0];
  return `...ResourceNameParameter<
    Resource = ${schema.resourceMetadata.SwaggerModelName}
    ${keyName ? `, KeyName = "${keyName}"` : ""}
    ${segmentName ? `, SegmentName = "${segmentName}"` : ""},
    NamePattern = ${namePattern ? `"${namePattern}"` : `""`}
    ${keyProperty.type !== "string" ? `, Type = ${keyProperty.type}` : ""}
  >`;
}

function buildKeyAugmentDecorators(
  schema: ArmResourceSchema,
  keyProperty: TypespecObjectProperty,
): TypespecDecorator[] | undefined {
  return keyProperty.decorators
    ?.filter((d) => !["pattern", "key", "segment", "path"].includes(d.name))
    .filter((d) => !(d.name === "visibility" && d.arguments?.[0] === "read"))
    .map((d) => {
      d.target = `${schema.resourceMetadata.SwaggerModelName}.name`;
      return d;
    })
    .concat({
      name: "doc",
      target: `${schema.resourceMetadata.SwaggerModelName}.name`,
      arguments: [generateDocsContent(keyProperty)],
    });
}

function buildPropertiesAugmentDecorators(schema: ArmResourceSchema, propertiesModel: Property): TypespecDecorator[] {
  return [
    {
      name: "doc",
      target: `${schema.resourceMetadata.SwaggerModelName}.properties`,
      arguments: [generateDocsContent({ doc: propertiesModel?.language.default.description })],
    },
  ];
}

function buildKeyProperty(schema: ArmResourceSchema): TypespecObjectProperty {
  let parameter;
  if (!schema.resourceMetadata.IsSingletonResource) {
    const keyProperty = getKeyParameter(schema.resourceMetadata);
    if (!keyProperty) {
      throw new Error(
        `Failed to find key property ${schema.resourceMetadata.ResourceKey} for ${schema.language.default.name}`,
      );
    }
    parameter = transformParameter(keyProperty, getSession().model);
  } else {
    parameter = generateSingletonKeyParameter();
  }

  if (!parameter.decorators) {
    parameter.decorators = [];
  }

  parameter.decorators.push(
    {
      name: "key",
      arguments: [
        schema.resourceMetadata.IsSingletonResource
          ? singular(schema.resourceMetadata.ResourceKeySegment)
          : schema.resourceMetadata.ResourceKey,
      ],
    },
    {
      name: "segment",
      arguments: [schema.resourceMetadata.ResourceKeySegment],
    },
    {
      name: "visibility",
      arguments: ["read"],
    },
  );

  // remove @path decorator for key parameter
  // TODO: still under discussion with TSP team about this behavior, in order to keep generated swagger good, comment out for now
  // parameter.decorators = parameter.decorators.filter((d) => d.name !== "path");

  // by convention the property itself needs to be called "name"
  parameter.name = "name";

  return { ...parameter, kind: "property" };
}

function buildResourceDecorators(schema: ArmResourceSchema): TypespecDecorator[] {
  const resourceModelDecorators: TypespecDecorator[] = [];

  if (schema.resourceMetadata.IsSingletonResource) {
    resourceModelDecorators.push({
      name: "singleton",
      arguments: [getSingletonName(schema)],
    });
  }

  if (schema.resourceMetadata.IsTenantResource) {
    resourceModelDecorators.push({
      name: "tenantResource",
    });
  } else if (schema.resourceMetadata.IsSubscriptionResource) {
    resourceModelDecorators.push({
      name: "subscriptionResource",
    });
  }

  return resourceModelDecorators;
}

function buildResourceClientDecorators(
  schema: ArmResourceSchema,
  armResourceOperations: TspArmResourceOperation[],
  normalOperations: TypespecOperation[],
): TypespecDecorator[] {
  const clientDecorator: TypespecDecorator[] = [];
  if (schema.language.csharp?.name) {
    clientDecorator.push(createCSharpNameDecorator(schema));
  }

  return clientDecorator;
}

function getSingletonName(schema: ArmResourceSchema): string {
  const key = schema.resourceMetadata.ResourceKey;
  const pathLast = schema.resourceMetadata.GetOperations[0].Path.split("/").pop() ?? "";
  if (key !== pathLast) {
    if (pathLast?.includes("{")) {
      // this is from c# config, which need confirm with service
      return "default";
    } else {
      return pathLast;
    }
  }
  return key;
}

function getLocationParent(schema: ArmResourceSchema): string | undefined {
  if (schema.resourceMetadata.GetOperations[0].Path.includes("/locations/")) {
    if (schema.resourceMetadata.IsTenantResource) {
      return "TenantLocationResource";
    } else if (schema.resourceMetadata.IsSubscriptionResource) {
      return "SubscriptionLocationResource";
    } else if (schema.resourceMetadata.Parents?.[0] === "ResourceGroupResource") {
      return "ResourceGroupLocationResource";
    }
  }
}
