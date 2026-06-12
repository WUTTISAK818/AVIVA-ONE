"use client";
import { useEffect, useState } from "react";
import { toSignedUrl } from "@/lib/storage";

// แสดงรูปจาก storage โดยแปลงเป็น signed URL อัตโนมัติ (รองรับ private bucket)
// link=true ครอบด้วย <a> เปิดรูปเต็มในแท็บใหม่
export default function SignedImg({
  src, alt = "", imgClassName, link = false,
}: {
  src: string | null | undefined;
  alt?: string;
  imgClassName?: string;
  link?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    toSignedUrl(src).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [src]);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={url} alt={alt} className={imgClassName} />;
  return link ? <a href={url} target="_blank" rel="noreferrer">{img}</a> : img;
}
