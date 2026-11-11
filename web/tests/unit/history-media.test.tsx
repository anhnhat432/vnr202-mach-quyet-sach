import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BA_DINH_IMAGE } from "@/features/history/data";
import { HistoryFilm, HistoryPhoto } from "@/features/history/history-media";
import { HistoryQuiz } from "@/features/history/history-quiz";

afterEach(cleanup);

describe("K04 media and missing-content recovery", () => {
  it("shows honest text fallback when no image exists", () => {
    render(<HistoryPhoto year="1911" />);
    expect(screen.getByText("Dấu mốc qua tư liệu chữ")).toBeVisible();
  });
  it("retains source and license when an image fails", () => {
    render(<HistoryPhoto year="1945" image={BA_DINH_IMAGE} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("Ảnh tạm thời không tải được")).toBeVisible();
    expect(screen.getByRole("link", { name: "Nguồn ảnh ↗" })).toHaveAttribute("rel", "noopener noreferrer");
  });
  it("loads an embed only on request and keeps an external fallback", () => {
    // Synthetic provider fixture only: no unverified video is added to public data.
    const { container } = render(<HistoryFilm video={{ title: "Test documentary", publisher: "Test fixture", youtubeId: "abcdefghijk", sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk", checkedAt: "2026-11-11" }} />);
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tải video tư liệu" }));
    const iframe = container.querySelector("iframe")!;
    expect(iframe.src).not.toContain("autoplay");
    fireEvent.click(screen.getByRole("button", { name: "Video không phát? Dùng nguồn gốc" }));
    expect(screen.getByRole("status")).toHaveTextContent("Video không phát được");
    expect(screen.getByRole("link")).toBeVisible();
  });
  it("does not embed malformed provider IDs", () => {
    const { container } = render(<HistoryFilm video={{ title: "Invalid fixture", publisher: "Test", youtubeId: "bad/id", sourceUrl: "https://www.youtube.com/", checkedAt: "2026-11-11" }} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("status")).toBeVisible();
  });
  it("supports a missing question set without crashing", () => {
    render(<HistoryQuiz questions={[]} />);
    expect(screen.getByText("Câu hỏi cho sự kiện này đang được bổ sung.")).toBeVisible();
  });
});
