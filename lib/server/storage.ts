import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "property-photos";

function getClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Upload de fotos via Supabase Storage (pendência da arquitetura, seção 11,
// resolvida na Etapa 6). Usa a service role key — só roda no servidor,
// nunca exposta ao client.
export async function uploadPropertyPhoto(propertyId: string, file: File) {
  const extension = file.name.split(".").pop() ?? "jpg";
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
