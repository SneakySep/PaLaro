import type { Metadata } from "next";
import { TeamDirectory } from "@/components/TeamDirectory";

export const metadata: Metadata = {
  title: "Teams — PaLaro",
};

export default function TeamsPage() {
  return <TeamDirectory />;
}
