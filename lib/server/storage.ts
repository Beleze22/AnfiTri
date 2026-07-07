import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "property-photos";

// O bucket é público: só entram formatos que o navegador trata como imagem
// inerte. SVG fica de fora de propósito (pode carregar script — XSS
// armazenado servido do nosso domínio de storage).
const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export class InvalidPhotoError extends Error {}

function getClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// A extensão vem do content type validado, nunca do nome do arquivo.
// Separada do upload para o lote inteiro poder ser validado antes de subir
// o primeiro arquivo.
export function validatePropertyPhoto(file: File) {
  const extension = ALLOWED_PHOTO_TYPES[file.type];
  if (!extension) {
    throw new InvalidPhotoError(
      "Formato de imagem não suportado (use JPG, PNG ou WebP).",
    );
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new InvalidPhotoError("Imagem muito grande (máximo de 10 MB).");
  }
  return extension;
}

// Upload de fotos via Supabase Storage (pendência da arquitetura, seção 11,
// resolvida na Etapa 6). Usa a service role key — só roda no servidor,
// nunca exposta ao client.
export async function uploadPropertyPhoto(propertyId: string, file: File) {
  const extension = validatePropertyPhoto(file);

  const path = `${propertyId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await getClient()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw error;

  const { data } = getClient().storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deletePropertyPhoto(path: string) {
  const { error } = await getClient().storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

// O modelo Photo guarda só a URL pública (seção 4.1 da arquitetura) — o
// caminho do objeto no bucket é extraído dela na hora de remover, em vez de
// adicionar uma coluna nova só para isso.
export function pathFromPublicUrl(url: string) {
  const marker = `/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : url.slice(index + marker.length);
}
