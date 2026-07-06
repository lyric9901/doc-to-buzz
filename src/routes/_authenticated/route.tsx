import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { location } = useRouterState();
  // Hide nav on onboarding and inside a specific chat thread
  const hideNav =
    location.pathname === "/onboarding" ||
    location.pathname.startsWith("/chat/") ||
    location.pathname === "/profile/edit";
  return (
    <div className={hideNav ? "" : "pb-20"}>
      <Outlet />
      {!hideNav && <BottomNav />}
    </div>
  );
}
