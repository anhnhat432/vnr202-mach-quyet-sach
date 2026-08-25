import type { Metadata } from "next";

import { DossierCard } from "@/features/content/ui/dossier-card";
import { listPublishedDossiers } from "@/features/content/server/dossier-repository";

export const metadata: Metadata = { title: "Kho Hồ sơ Quyết sách" };

const chapters = [
  { id: "chapter_1", anchor: "chapter-1", name: "Tìm đường và giành chính quyền", period: "trước 1930-1945" },
  { id: "chapter_2", anchor: "chapter-2", name: "Giữ chính quyền, kháng chiến và thống nhất", period: "1945-1975" },
  { id: "chapter_3", anchor: "chapter-3", name: "Đổi mới và năng lực phát triển", period: "1975-nay" },
] as const;

export default async function DossierIndexPage() {
  const dossiers = await listPublishedDossiers();

  return (
    <div className="page-shell dossier-index">
      <header className="page-intro">
        <p className="eyebrow">Kho chuyên sâu · có nguồn dẫn</p>
        <h1>Hồ sơ Quyết sách</h1>
        <p>Ba hồ sơ chuyên sâu đã mở với đầy đủ nguồn dẫn — đọc dữ kiện, chọn hướng đi và đối chiếu với lịch sử thực tế. Muốn chơi nhanh cả 15 khoảnh khắc, hãy vào &ldquo;Chơi ngay&rdquo;.</p>
        <div className="page-intro__metric"><strong>03</strong><span>hồ sơ chuyên sâu<br />đã mở, có nguồn</span></div>
      </header>
      {chapters.map((chapter) => {
        const chapterDossiers = dossiers.filter((item) => item.chapter === chapter.id);
        return (
          <section className="dossier-chapter" id={chapter.anchor} key={chapter.id}>
            <div className="dossier-chapter__header">
              <span>{chapter.period}</span>
              <h2>{chapter.name}</h2>
              <small>{chapterDossiers.length}/5 hồ sơ mở</small>
            </div>
            <div className="dossier-list">
              {chapterDossiers.map((dossier) => <DossierCard dossier={dossier} key={dossier.id} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
