import { Loader } from "@/components/manager-ui";

// Route-level loading boundary for every /manager page (App Router convention).
// Shows inside the layout's content area while a segment loads, so the sidebar
// stays put. Renders whatever the switchboard's Loading_style says
// (content-shaped skeleton stack / centered spinner / pulsing dots).
export default function ManagerLoading() {
  return (
    <div className="min-h-[65vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Loader lines={3} />
      </div>
    </div>
  );
}
