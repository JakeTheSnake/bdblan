'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import { BASE_PATH } from '@/lib/basePath.js';

// Longest-side pixel cap for the client-generated thumbnail.
const THUMB_MAX = 400;

/**
 * Downscale a chosen image to a small WebP thumbnail via <canvas> so the LAN
 * page can render the gallery from tiny blobs. Admin-only path, so doing this
 * in the browser keeps the server dependency-free.
 */
function makeThumbnail(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, THUMB_MAX / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('thumbnail failed'))),
        'image/webp',
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('could not load image'));
    };
    img.src = url;
  });
}

export default function LanImages({ lanId, images }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Detect admin status without forcing the LAN page itself to read cookies.
  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE_PATH}/api/admin/session`)
      .then((res) => {
        if (!cancelled && res.ok) setIsAdmin(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Close the lightbox on Escape.
  useEffect(() => {
    if (openId == null) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setOpenId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const thumb = await makeThumbnail(file);
        const form = new FormData();
        form.append('image', file);
        form.append('thumb', thumb, 'thumb.webp');
        form.append('filename', file.name);
        const res = await fetch(`${BASE_PATH}/api/admin/lans/${lanId}/images`, {
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'upload failed');
        }
      }
      router.refresh();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id) {
    if (!window.confirm('Delete this image?')) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`${BASE_PATH}/api/admin/lans/${lanId}/images/${id}`, {
      method: 'DELETE',
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'delete failed');
      return;
    }
    router.refresh();
  }

  if (images.length === 0 && !isAdmin) {
    return <p className="text-sm text-muted-foreground">No images yet.</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-card shadow-card"
          >
            <button
              type="button"
              onClick={() => setOpenId(img.id)}
              className="block h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${BASE_PATH}/api/images/${img.id}?thumb=1`}
                alt={img.filename || ''}
                className="h-full w-full object-cover"
              />
            </button>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => onDelete(img.id)}
                disabled={busy}
                aria-label="Delete image"
                className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition hover:bg-destructive group-hover:opacity-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ))}
        {isAdmin ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label="Upload images"
            className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border bg-card text-muted-foreground shadow-card transition hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <Plus className="h-10 w-10" />
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFiles}
        className="hidden"
      />

      {busy ? <p className="mt-2 text-sm text-muted-foreground">Uploading…</p> : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      {openId != null ? (
        <div
          onClick={() => setOpenId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <button
            type="button"
            onClick={() => setOpenId(null)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-md bg-black/60 p-2 text-white hover:bg-black/80"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${BASE_PATH}/api/images/${openId}`}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
