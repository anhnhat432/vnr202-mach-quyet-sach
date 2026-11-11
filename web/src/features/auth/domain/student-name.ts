import { z } from "zod";

// Self-reported name, not a verified identity. Public abbreviation is derived on the server.
export const studentNameSchema = z.object({
  name: z.string().max(100).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Tên không được chứa ký tự điều khiển.")
    .transform((value) => value.normalize("NFC").trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1).max(100)),
}).strict();
