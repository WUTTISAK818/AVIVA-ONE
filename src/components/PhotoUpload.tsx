"use client";

import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Loader } from "lucide-react";

interface PhotoUploadProps {
  activityId: string;
  userId: string;
  onPhotoAdded?: (photoUrl: string) => void;
  photos?: string[];
  onPhotoRemoved?: (photoUrl: string) => void;
}

export function PhotoUpload({
  activityId,
  userId,
  onPhotoAdded,
  photos = [],
  onPhotoRemoved,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPhotos, setLocalPhotos] = useState<string[]>(photos);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("activityId", activityId);
      formData.append("userId", userId);

      const response = await fetch("/api/activity/upload-photo", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to upload photo");
        return;
      }

      setLocalPhotos((prev) => [...prev, data.photoUrl]);
      onPhotoAdded?.(data.photoUrl);
    } catch (err) {
      setError("Network error: " + String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async (photoUrl: string) => {
    try {
      const response = await fetch(
        `/api/activity/upload-photo?activityId=${activityId}&photoUrl=${encodeURIComponent(photoUrl)}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to delete photo");
        return;
      }

      setLocalPhotos((prev) => prev.filter((url) => url !== photoUrl));
      onPhotoRemoved?.(photoUrl);
    } catch (err) {
      setError("Network error: " + String(err));
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      <div className="flex gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aviva-gold/20 border border-aviva-gold/40 text-aviva-gold hover:bg-aviva-gold/30 disabled:opacity-50 text-sm font-medium"
        >
          {uploading ? (
            <>
              <Loader size={16} className="animate-spin" />
              อัปโหลดรูปภาพ...
            </>
          ) : (
            <>
              <Upload size={16} />
              แนบรูปภาพ
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        {localPhotos.length > 0 && (
          <span className="text-xs text-aviva-secondary self-center">
            {localPhotos.length} รูป
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Photo Gallery */}
      {localPhotos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {localPhotos.map((photoUrl, idx) => (
            <div
              key={idx}
              className="relative group rounded-lg overflow-hidden bg-aviva-card border border-aviva-gold/10"
            >
              <img
                src={photoUrl}
                alt={`Photo ${idx + 1}`}
                className="w-full h-24 object-cover"
              />
              <button
                onClick={() => handleRemovePhoto(photoUrl)}
                className="absolute top-1 right-1 p-1 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {localPhotos.length === 0 && (
        <div className="text-center py-3 border border-dashed border-aviva-gold/20 rounded-lg">
          <ImageIcon size={24} className="text-aviva-secondary/40 mx-auto mb-1" />
          <p className="text-xs text-aviva-secondary">ยังไม่มีรูปภาพ</p>
        </div>
      )}
    </div>
  );
}
