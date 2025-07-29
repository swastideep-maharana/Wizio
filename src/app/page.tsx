"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

const Page = () => {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.createAI.queryOptions({ text: "swastideep" }));

  return <div>{JSON.stringify(data)}</div>;
};
export default Page;

