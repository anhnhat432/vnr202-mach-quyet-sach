# Supplied textbook scan: page cross-check

Checked: 2026-11-11. Source supplied by the user after the initial knowledge-page implementation.

## Bibliographic identity

- Title: Giáo trình Lịch sử Đảng Cộng sản Việt Nam (Dành cho bậc đại học hệ không chuyên lý luận chính trị).
- Authoring body: Bộ Giáo dục và Đào tạo.
- Publisher: Nhà xuất bản Chính trị quốc gia Sự thật, Hà Nội, 2021.
- ISBN: 978-604-57-6590-6. Title/imprint read on PDF pages 3–4; colophon on page 440 records printing in June 2021.
- File: `D:\Hoc_tap\26_FALL\VNR202\Giao trinh lich su dang cong san viet nam.pdf`.
- Size: 17,853,356 bytes; 440 PDF pages.
- SHA-256: `bc108b5153b2ed982a05567d233faed4249ed88b79502314bec3f793b3edb98f`.

The supplied PDF is image-based. `pypdf.extract_text()` returned no text on the cover and sampled body pages; it has no bookmarks. Poppler rendered scan pages to ignored `tmp/pdfs/`. Windows OCR (installed English recognizer) was used only to locate possible passages; its Vietnamese output is imperfect. The page references below were accepted only after reading complete relevant page images, including the printed footer numbers. They are not claims of lecturer review or approval.

The printed page numbers match the 1-based PDF page positions at every cited location below. Neither the original PDF nor its rendered page images are copied into the public assets or committed source; only bibliographic metadata and page pointers are added to the website.

## Event locators and supported scope

| Event ID | Printed pages = PDF positions | Verified scope / limits |
| --- | --- | --- |
| `1911-ra-di` | 49–50 | Crisis of earlier rescue movements and departure in 1911. The precise 5 June date, port and ship retain their museum source; those details are not attributed to page 50. |
| `1920-tours` | 51 | Lenin theses, Tours in December 1920, support for International III and founding of the French Communist Party. |
| `1925-thanh-nien` | 55–56 | June 1925 founding at Guangzhou, Thanh niên first issue on 21 June, organizational/educational activity. |
| `1930-thanh-lap-dang` | 61–64 | Unification conference, Nguyễn Ái Quốc, early documents; page 61 footnote explains 3 February as the anniversary date. |
| `1941-viet-minh` | 95–98 | Central Committee VIII, national liberation priority, Việt Minh and preparation for uprising. The exact 19 May date retains its museum source. |
| `1945-thang-tam` | 114–115 | Hanoi 19 August, Hue 23 August, Saigon 25 August and mass mobilization. |
| `1945-doc-lap` | 117 | Ceremony at Ba Đình on 2 September, Hồ Chí Minh reading the Declaration and announcement of the new state. |
| `1946-khang-chien` | 145–148 | Breakdown of accommodation, decision/call for resistance, Hanoi fighting from 19 December 1946. |
| `1950-bien-gioi` | 159–160 | Campaign decision, Cao Bằng–Lạng Sơn, international communications and campaign dates 16 September–17 October 1950. Tactical details such as Đông Khê remain supported by the museum article. |
| `1954-dien-bien` | 171–173 | Logistics, opening on 13 March, 56 days/nights, victory on 7 May and Geneva negotiations. |
| `1960-dong-khoi` | 191–192 | 17 January at Mỏ Cày, Nguyễn Thị Định, expansion of Đồng khởi and change in posture. |
| `1968-mau-than` | 217–219 | Urban offensive, strategic effect and negotiations; page 219 explicitly discusses leadership shortcomings and losses. |
| `1973-paris` | 227–228 | Signing on 27 January, US troop withdrawal and continuing conflict. |
| `1975-thong-nhat` | 232–233 | Campaign beginning 26 April, Saigon victory 30 April and conclusion/meaning of the war. |
| `1976-quoc-hoi` | 240–241 | Election 25 April, first unified National Assembly session, state name and institutions. Exact 2 July date remains separately attributed to the National Assembly source. |
| `1981-khoan-100` | 247 | Directive 100 dated 13 January 1981, product contracting, work allocation and production incentives. |
| `1986-doi-moi` | 260–262 | Congress VI dates 15–18 December 1986, crisis context, Nguyễn Văn Linh and economic management changes. |
| `1995-asean` | 281 | Accession on 28 July 1995 and foreign-relations context; location and seventh-member status retain ASEAN attribution. |
| `2007-wto` | 332 | WTO integration and 150th-member context. **Date discrepancy: see below.** |
| `2021-dai-hoi-xiii` | 386–387 | Congress XIII 25 January–1 February 2021 at Hanoi, context, theme and development horizons 2025/2030/2045. |

## WTO date distinction

Page 332 associates official membership with November 2006. The [WTO accession record](https://www.wto.org/english/thewto_e/acc_e/a1_vietnam_e.htm) distinguishes approval on 7 November 2006 from membership taking effect on 11 January 2007. The [WTO notification of entry into force](https://goods-schedules.wto.org/system/files/WTO_import/Drive/WT-Let_English/552.pdf) also confirms 11 January 2007.

The timeline keeps its verified effective date `2007-01-11`. The page-332 reference is limited to the integration/150th-member context, with a visible discrepancy note and official WTO link. This source difference is not silently turned into a date change or presented as agreement between both sources.

## Implementation traceability

- `web/src/features/history/textbook.ts`: edition identity and 20 explicit reference records; per-record supported scope and WTO note.
- `history-explorer.tsx`: textbook source block, printed/PDF page distinction, scope and discrepancy note.
- `web/src/app/kien-thuc/page.tsx`: replaces the now-stale “no PDF supplied” notice with an accurate scan cross-check disclosure.
- `history-textbook.test.ts`: coverage of exactly 20 events, page bounds, ISBN, PDF/print mapping and WTO date preservation.
- E2E K07 checks visible page citations and WTO distinction on desktop/mobile.

The knowledge summaries remain paraphrases. Existing external references remain available for details beyond the indicated textbook scope. Academic review remains a separate human responsibility.
