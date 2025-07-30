import { Agent, openai, gemini, createAgent } from "@inngest/agent-kit";

import { inngest } from "./client";
import { success } from "zod";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
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

    return { output };
    // await step.sleep("wait-a-moment", "5s");
    // return { message: `Hello ${event.data.value}!` };
  }
);
