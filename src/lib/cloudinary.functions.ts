import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const signCloudinaryUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
    const apiKey = process.env.CLOUDINARY_API_KEY!;
    const apiSecret = process.env.CLOUDINARY_API_SECRET!;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Cloudinary is not configured");
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `buzzme/users/${context.userId}`;
    // Cloudinary signature: SHA-1 of sorted params + api_secret
    const toSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");
    return { cloudName, apiKey, timestamp, folder, signature };
  });
