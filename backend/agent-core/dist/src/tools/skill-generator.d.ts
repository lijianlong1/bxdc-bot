import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
declare const skillGeneratorToolInputSchema: z.ZodDiscriminatedUnion<"targetType", [z.ZodObject<{
    targetType: z.ZodLiteral<"api">;
    rawDescription: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    method: z.ZodOptional<z.ZodString>;
    endpoint: z.ZodOptional<z.ZodString>;
    headers: z.ZodEffects<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>, Record<string, string>, unknown>;
    query: z.ZodEffects<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>>, Record<string, string | number | boolean>, unknown>;
    body: z.ZodOptional<z.ZodAny>;
    interfaceDescription: z.ZodString;
    parameterContract: z.ZodEffects<z.ZodAny, any, unknown>;
    parameterBinding: z.ZodOptional<z.ZodEnum<["query", "jsonBody", "formBody"]>>;
    timeoutSeconds: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number, unknown>;
    asyncPoll: z.ZodEffects<z.ZodOptional<z.ZodObject<{
        pollEndpoint: z.ZodString;
        idJsonPath: z.ZodOptional<z.ZodString>;
        pollMethod: z.ZodOptional<z.ZodString>;
        pollIntervalSeconds: z.ZodOptional<z.ZodNumber>;
        maxWaitSeconds: z.ZodOptional<z.ZodNumber>;
        completionJsonPath: z.ZodOptional<z.ZodString>;
        completionValue: z.ZodOptional<z.ZodString>;
        failedValues: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        resultJsonPath: z.ZodOptional<z.ZodString>;
        pollHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        pollEndpoint?: string;
        idJsonPath?: string;
        pollMethod?: string;
        pollIntervalSeconds?: number;
        maxWaitSeconds?: number;
        completionJsonPath?: string;
        completionValue?: string;
        failedValues?: string[];
        resultJsonPath?: string;
        pollHeaders?: Record<string, string>;
    }, {
        pollEndpoint?: string;
        idJsonPath?: string;
        pollMethod?: string;
        pollIntervalSeconds?: number;
        maxWaitSeconds?: number;
        completionJsonPath?: string;
        completionValue?: string;
        failedValues?: string[];
        resultJsonPath?: string;
        pollHeaders?: Record<string, string>;
    }>>, {
        pollEndpoint?: string;
        idJsonPath?: string;
        pollMethod?: string;
        pollIntervalSeconds?: number;
        maxWaitSeconds?: number;
        completionJsonPath?: string;
        completionValue?: string;
        failedValues?: string[];
        resultJsonPath?: string;
        pollHeaders?: Record<string, string>;
    }, unknown>;
    testInput: z.ZodEffects<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>, Record<string, unknown>, unknown>;
    enabled: z.ZodEffects<z.ZodOptional<z.ZodBoolean>, boolean, unknown>;
    requiresConfirmation: z.ZodEffects<z.ZodOptional<z.ZodBoolean>, boolean, unknown>;
    allowOverwrite: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>, boolean, unknown>;
}, "strip", z.ZodTypeAny, {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, string | number | boolean>;
    parameterContract?: any;
    description?: string;
    name?: string;
    targetType?: "api";
    rawDescription?: string;
    endpoint?: string;
    interfaceDescription?: string;
    parameterBinding?: "query" | "jsonBody" | "formBody";
    timeoutSeconds?: number;
    asyncPoll?: {
        pollEndpoint?: string;
        idJsonPath?: string;
        pollMethod?: string;
        pollIntervalSeconds?: number;
        maxWaitSeconds?: number;
        completionJsonPath?: string;
        completionValue?: string;
        failedValues?: string[];
        resultJsonPath?: string;
        pollHeaders?: Record<string, string>;
    };
    testInput?: Record<string, unknown>;
    enabled?: boolean;
    requiresConfirmation?: boolean;
    allowOverwrite?: boolean;
}, {
    method?: string;
    headers?: unknown;
    body?: any;
    query?: unknown;
    parameterContract?: unknown;
    description?: string;
    name?: string;
    targetType?: "api";
    rawDescription?: string;
    endpoint?: string;
    interfaceDescription?: string;
    parameterBinding?: "query" | "jsonBody" | "formBody";
    timeoutSeconds?: unknown;
    asyncPoll?: unknown;
    testInput?: unknown;
    enabled?: unknown;
    requiresConfirmation?: unknown;
    allowOverwrite?: unknown;
}>, z.ZodObject<{
    targetType: z.ZodLiteral<"ssh">;
    rawDescription: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    command: z.ZodOptional<z.ZodString>;
    allowOverwrite: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>, boolean, unknown>;
}, "strip", z.ZodTypeAny, {
    description?: string;
    name?: string;
    targetType?: "ssh";
    rawDescription?: string;
    allowOverwrite?: boolean;
    command?: string;
}, {
    description?: string;
    name?: string;
    targetType?: "ssh";
    rawDescription?: string;
    allowOverwrite?: unknown;
    command?: string;
}>, z.ZodObject<{
    targetType: z.ZodLiteral<"openclaw">;
    rawDescription: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    systemPrompt: z.ZodOptional<z.ZodString>;
    allowedTools: z.ZodOptional<z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], unknown>>;
    allowOverwrite: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>, boolean, unknown>;
}, "strip", z.ZodTypeAny, {
    description?: string;
    name?: string;
    targetType?: "openclaw";
    rawDescription?: string;
    allowOverwrite?: boolean;
    systemPrompt?: string;
    allowedTools?: string[];
}, {
    description?: string;
    name?: string;
    targetType?: "openclaw";
    rawDescription?: string;
    allowOverwrite?: unknown;
    systemPrompt?: string;
    allowedTools?: unknown;
}>, z.ZodObject<{
    targetType: z.ZodLiteral<"template">;
    rawDescription: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    prompt: z.ZodOptional<z.ZodString>;
    allowOverwrite: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>, boolean, unknown>;
}, "strip", z.ZodTypeAny, {
    description?: string;
    name?: string;
    targetType?: "template";
    rawDescription?: string;
    allowOverwrite?: boolean;
    prompt?: string;
}, {
    description?: string;
    name?: string;
    targetType?: "template";
    rawDescription?: string;
    allowOverwrite?: unknown;
    prompt?: string;
}>]>;
export declare class JavaSkillGeneratorTool extends DynamicStructuredTool<typeof skillGeneratorToolInputSchema> {
    private readonly gatewayUrl;
    private readonly apiToken;
    private readonly userId?;
    constructor(gatewayUrl: string, apiToken: string, userId?: string);
}
export {};
