import { DynamicTool, Tool, DynamicStructuredTool, StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
export declare function getAgentBuiltinSkillDispatch(): "legacy" | "gateway";
export type BuiltinSkillDispatch = "legacy" | "gateway";
export declare const computeToolInputSchema: z.ZodObject<{
    operation: z.ZodEnum<["add", "subtract", "multiply", "divide", "factorial", "square", "sqrt", "timestamp_to_date", "date_diff_days"]>;
    operands: z.ZodArray<z.ZodUnion<[z.ZodNumber, z.ZodString]>, "many">;
}, "strip", z.ZodTypeAny, {
    operation?: "add" | "subtract" | "multiply" | "divide" | "factorial" | "square" | "sqrt" | "timestamp_to_date" | "date_diff_days";
    operands?: (string | number)[];
}, {
    operation?: "add" | "subtract" | "multiply" | "divide" | "factorial" | "square" | "sqrt" | "timestamp_to_date" | "date_diff_days";
    operands?: (string | number)[];
}>;
declare const serverLookupToolInputSchema: z.ZodObject<{
    serverName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    serverName?: string;
}, {
    serverName?: string;
}>;
declare const linuxScriptToolInputSchema: z.ZodObject<{
    id: z.ZodNumber;
    command: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id?: number;
    command?: string;
}, {
    id?: number;
    command?: string;
}>;
export declare const apiCallerToolInputSchema: z.ZodObject<{
    url: z.ZodString;
    method: z.ZodDefault<z.ZodEnum<["GET", "POST", "PUT", "DELETE", "PATCH"]>>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    body: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    url?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers?: Record<string, string>;
    body?: any;
}, {
    url?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers?: Record<string, string>;
    body?: any;
}>;
export declare const sshExecutorToolInputSchema: z.ZodObject<{
    host: z.ZodString;
    username: z.ZodString;
    command: z.ZodString;
    privateKey: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    confirmed: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    password?: string;
    command?: string;
    host?: string;
    username?: string;
    privateKey?: string;
    confirmed?: boolean;
}, {
    password?: string;
    command?: string;
    host?: string;
    username?: string;
    privateKey?: string;
    confirmed?: boolean;
}>;
declare const skillGeneratorToolInputSchema: z.ZodObject<{
    targetType: z.ZodEnum<["api", "ssh", "openclaw", "template"]>;
    rawDescription: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    allowOverwrite: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>, boolean, unknown>;
    method: z.ZodOptional<z.ZodString>;
    endpoint: z.ZodOptional<z.ZodString>;
    headers: z.ZodEffects<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>, Record<string, string>, unknown>;
    query: z.ZodEffects<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>>, Record<string, string | number | boolean>, unknown>;
    body: z.ZodOptional<z.ZodAny>;
    interfaceDescription: z.ZodOptional<z.ZodString>;
    parameterContract: z.ZodEffects<z.ZodOptional<z.ZodAny>, any, unknown>;
    parameterBinding: z.ZodOptional<z.ZodEnum<["query", "jsonBody", "formBody"]>>;
    timeoutSeconds: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number, unknown>;
    asyncPoll: z.ZodEffects<z.ZodOptional<z.ZodObject<{
        pollEndpoint: z.ZodOptional<z.ZodString>;
        idJsonPath: z.ZodOptional<z.ZodString>;
        pollMethod: z.ZodOptional<z.ZodString>;
        pollIntervalSeconds: z.ZodOptional<z.ZodNumber>;
        maxWaitSeconds: z.ZodOptional<z.ZodNumber>;
        completionJsonPath: z.ZodOptional<z.ZodString>;
        completionValue: z.ZodOptional<z.ZodString>;
        failedValues: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        resultJsonPath: z.ZodOptional<z.ZodString>;
        pollHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        pollStrategy: z.ZodOptional<z.ZodEnum<["PERIODIC", "SINGLE_CALL"]>>;
        singleCallReadTimeoutSeconds: z.ZodOptional<z.ZodNumber>;
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
        pollStrategy?: "PERIODIC" | "SINGLE_CALL";
        singleCallReadTimeoutSeconds?: number;
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
        pollStrategy?: "PERIODIC" | "SINGLE_CALL";
        singleCallReadTimeoutSeconds?: number;
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
        pollStrategy?: "PERIODIC" | "SINGLE_CALL";
        singleCallReadTimeoutSeconds?: number;
    }, unknown>;
    testInput: z.ZodEffects<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>, Record<string, unknown>, unknown>;
    enabled: z.ZodEffects<z.ZodOptional<z.ZodBoolean>, boolean, unknown>;
    requiresConfirmation: z.ZodEffects<z.ZodOptional<z.ZodBoolean>, boolean, unknown>;
    command: z.ZodOptional<z.ZodString>;
    systemPrompt: z.ZodOptional<z.ZodString>;
    allowedTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    prompt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    command?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    targetType?: "api" | "ssh" | "openclaw" | "template";
    rawDescription?: string;
    name?: string;
    description?: string;
    allowOverwrite?: boolean;
    endpoint?: string;
    query?: Record<string, string | number | boolean>;
    interfaceDescription?: string;
    parameterContract?: any;
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
        pollStrategy?: "PERIODIC" | "SINGLE_CALL";
        singleCallReadTimeoutSeconds?: number;
    };
    testInput?: Record<string, unknown>;
    enabled?: boolean;
    requiresConfirmation?: boolean;
    systemPrompt?: string;
    allowedTools?: string[];
    prompt?: string;
}, {
    command?: string;
    method?: string;
    headers?: unknown;
    body?: any;
    targetType?: "api" | "ssh" | "openclaw" | "template";
    rawDescription?: string;
    name?: string;
    description?: string;
    allowOverwrite?: unknown;
    endpoint?: string;
    query?: unknown;
    interfaceDescription?: string;
    parameterContract?: unknown;
    parameterBinding?: "query" | "jsonBody" | "formBody";
    timeoutSeconds?: unknown;
    asyncPoll?: unknown;
    testInput?: unknown;
    enabled?: unknown;
    requiresConfirmation?: unknown;
    systemPrompt?: string;
    allowedTools?: string[];
    prompt?: string;
}>;
export declare function describeGatewayExtendedTool(toolName: string): {
    displayName: string;
    kind: 'skill' | 'tool';
    executionMode?: string;
    executionLabel?: string;
} | null;
export type BindableAgentTool = Tool | DynamicTool | StructuredTool;
export declare function loadGatewayExtendedTools(gatewayUrl: string, apiToken: string, userId?: string, options?: {
    plannerModel?: any;
    availableTools?: BindableAgentTool[];
}): Promise<StructuredTool[]>;
export declare function buildConfirmedToolInputString(args: unknown): string;
export declare function buildConfirmedToolArgs(args: unknown): Record<string, unknown>;
export declare function invokeExtendedSkillWithConfirmed(gatewayUrl: string, apiToken: string, userId: string | undefined, toolName: string, toolArguments: unknown, options: {
    plannerModel: any;
    availableTools: BindableAgentTool[];
}): Promise<string>;
export declare class JavaSkillGeneratorTool extends DynamicStructuredTool<typeof skillGeneratorToolInputSchema> {
    private readonly gatewayUrl;
    private readonly apiToken;
    private readonly userId?;
    constructor(gatewayUrl: string, apiToken: string, userId?: string);
}
export declare class JavaSshTool extends DynamicStructuredTool<typeof sshExecutorToolInputSchema> {
    constructor(gatewayUrl: string, apiToken: string, userId?: string, options?: {
        dispatch?: BuiltinSkillDispatch;
    });
}
export declare class JavaComputeTool extends DynamicStructuredTool<typeof computeToolInputSchema> {
    constructor(gatewayUrl: string, apiToken: string, options?: {
        dispatch?: BuiltinSkillDispatch;
    });
}
export declare class JavaLinuxScriptTool extends DynamicStructuredTool<typeof linuxScriptToolInputSchema> {
    constructor(gatewayUrl: string, apiToken: string, userId?: string);
}
export declare class JavaServerLookupTool extends DynamicStructuredTool<typeof serverLookupToolInputSchema> {
    constructor(gatewayUrl: string, apiToken: string, userId?: string);
}
export declare class JavaApiTool extends DynamicStructuredTool<typeof apiCallerToolInputSchema> {
    constructor(gatewayUrl: string, apiToken: string, options?: {
        dispatch?: BuiltinSkillDispatch;
    });
}
export {};
