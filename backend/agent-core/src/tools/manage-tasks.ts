import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const taskUpdateSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe(
      "Stable task identifier. Use a short slug like 'check-disk', 'restart-nginx'. " +
        "Reuse the same id to update an existing task.",
    ),
  label: z
    .string()
    .describe("Brief human-readable description of the task"),
  status: z
    .enum(["pending", "in_progress", "completed", "cancelled"])
    .describe("New status for this task"),
});

const manageTasksInputSchema = z.object({
  updates: z
    .array(taskUpdateSchema)
    .min(1)
    .describe(
      "One or more task status updates. Create new tasks or update existing ones.",
    ),
});

export class ManageTasksTool extends DynamicStructuredTool {
  constructor() {
    super({
      name: "manage_tasks",
      description:
        "Track the progress of multi-step work. " +
        "Call this to register new sub-tasks (status=pending/in_progress) or mark them completed/cancelled. " +
        "The system uses this to avoid repeating finished work and to keep you focused on remaining items.",
      schema: manageTasksInputSchema,
      func: async (input: z.infer<typeof manageTasksInputSchema>) => {
        const lines = input.updates.map(
          (u) => `  ${u.id}: ${u.status} — ${u.label}`,
        );
        return `Task status updated:\n${lines.join("\n")}`;
      },
    });
  }
}
