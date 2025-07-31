import {
  Agent,
  openai,
  gemini,
  createAgent,
  createTool,
  createNetwork,
} from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";

import { inngest } from "./client";
import { stepsSchemas } from "inngest/api/schema";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { z } from "zod";
import { PROMPT } from "@/prompt";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("wizio-nextjs-test-2");
      return sandbox.sandboxId;
    });

    const codeAgent = createAgent({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: gemini({
        model: "gemini-2.0-flash",
        // @ts-expect-error: 'tools' is not a valid property on AiModelOptions, but required for agent-kit
        tools: [
          createTool({
            name: "terminal",
            description: "Use the terminal to run commands",
            parameters: z.object({
              command: z.string(),
            }) as any,
            handler: async ({ command }, { step }) => {
              console.log("Terminal tool called with command:", command);
              return await step?.run("terminal", async () => {
                const buffers = { stdout: "", stderr: "" };
                try {
                  const sandbox = await getSandbox(sandboxId);
                  const result = await sandbox.commands.run(command, {
                    onStdout: (data: string) => {
                      buffers.stdout += data;
                    },
                    onStderr: (data: string) => {
                      buffers.stderr += data;
                    },
                  });
                  return result.stdout;
                } catch (e) {
                  console.error(
                    `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`
                  );
                  return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
                }
              });
            },
          }),

          createTool({
            name: "createOrUpdateFiles",
            description: "Create or update files in the sandbox",
            parameters: z.object({
              files: z.array(
                z.object({
                  path: z.string(),
                  content: z.string(),
                })
              ),
            }) as any,
            handler: async ({ files }, { step, network }) => {
              console.log("createOrUpdateFiles tool called with files:", files);
              const newFiles = await step?.run(
                "createOrUpdateFiles",
                async () => {
                  try {
                    const updatedFiles = network.state.data.files || {};
                    const sandbox = await getSandbox(sandboxId);
                    for (const file of files) {
                      await sandbox.files.write(file.path, file.content);
                      updatedFiles[file.path] = file.content;
                    }
                    return updatedFiles;
                  } catch (e) {
                    return "Error:" + e;
                  }
                }
              );

              if (typeof newFiles === "object") {
                network.state.data.files = newFiles;
              }
            },
          }),

          createTool({
            name: "readFiles",
            description: "Read files from the sandbox",
            parameters: z.object({
              files: z.array(z.string()),
            }) as any,
            handler: async ({ files }, { step }) => {
              console.log("readFiles tool called with files:", files);
              return await step?.run("readFiles", async () => {
                try {
                  const sandbox = await getSandbox(sandboxId);
                  const contents = [];
                  for (const file of files) {
                    const content = await sandbox.files.read(file);
                    contents.push({ path: file, content });
                  }
                  return JSON.stringify(contents);
                } catch (e) {
                  return "Error: " + e;
                }
              });
            },
          }),
        ],

        Lifecycle: {
          onResponse: async ({
            result,
            network,
          }: {
            result: any;
            network: any;
          }) => {
            const lastAssistantMessageText =
              lastAssistantTextMessageContent(result);
            if (lastAssistantMessageText && network) {
              // Store the summary but don't stop execution
              if (lastAssistantMessageText.includes("<task_summary>")) {
                network.state.data.summary = lastAssistantMessageText;
              }
            }
            return result;
          },
        },
      }),
    });

    const network = createNetwork({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      router: async ({ network }) => {
        // Always return the codeAgent to allow it to use all tools
        // The maxIter will prevent infinite loops
        return codeAgent;
      },
    });

    console.log("Starting agent with input:", event.data.value);

    const result = await network.run(event.data.value);

    console.log("Agent result state:", result.state.data);

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);
