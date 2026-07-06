import { signCloudinaryUpload } from "./cloudinary.functions";

export async function uploadToCloudinary(file: File): Promise<string> {
  const sig = await signCloudinaryUpload();
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upload failed: ${t}`);
  }
  const json = (await res.json()) as { secure_url: string };
  return json.secure_url;
}
