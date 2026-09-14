import type { PanelContext } from "./hub-types";
import { BookingPanel } from "../features/bookings/BookingPanel";
import { ThrowingPlansPanel } from "../features/plans/ThrowingPlansPanel";
import { ProgressReportsPanel } from "../features/reports/ProgressReportsPanel";
import { VideoSubmissionPanel } from "../features/videos/VideoSubmissionPanel";
export function renderHubPanels(context: PanelContext) {
  return {
    lessonsPanel: <BookingPanel {...context} />,
    plansPanel: <ThrowingPlansPanel {...context} />,
    reportsPanel: <ProgressReportsPanel {...context} />,
    videosPanel: <VideoSubmissionPanel {...context} />,
  };
}
