import { Agent, openai, gemini, createAgent } from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";

import { inngest } from "./client";
import { success } from "zod";
import { stepsSchemas } from "inngest/api/schema";
import { getSandbox } from "./utils";

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
      system:
        "You are an expert Next.js & React developer.  You write readable, maintainable code. You write simple Next.js & React snippet,",
      model: gemini({
        model: "gemini-2.0-flash",
      }),
    });
    // gemini-2.0-flash
    const { output } = await codeAgent.run(
      `Write the following snippet: ${event.data.value}`
    );
    console.log(output);

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    return { output, sandboxUrl };
    // await step.sleep("wait-a-moment", "5s");
    // return { message: `Hello ${event.data.value}!` };
  }
);
