import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/beheer/ui")({ component: () => <Outlet /> });
