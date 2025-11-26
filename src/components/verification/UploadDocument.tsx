"use client";

import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Check, X } from "lucide-react";

export type DocumentType =
  | "idFront"
  | "idBack"
  | "selfie"
  | "registrationDoc"
  | "insuranceDoc"
  | "driverLicense"
  | "vtcLicense";

interface UploadDocumentProps {
  userId: string;
  userRole: string; // "clients" | "drivers" | "managers"
  documentType: DocumentType;
  label: string;
  accept?: string;
  currentUrl?: string | null;
  onUploadSuccess?: (url: string) => void;
  required?: boolean;
}

export default function UploadDocument({
  userId,
  userRole,
  documentType,
  label,
  accept = "image/*,application/pdf",
  currentUrl,
  onUploadSuccess,
  required = false,
}: UploadDocumentProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(currentUrl || null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validation: taille max 10MB
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "La taille maximale est de 10 MB.",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Aucun fichier sélectionné",
        description: "Veuillez choisir un fichier à télécharger.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    
    try {
      const ext = file.name.split(".").pop();
      const filename = `${documentType}_${Date.now()}.${ext}`;
      const path = `documents/${userRole}/${userId}/${filename}`;
      
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      setUploadedUrl(url);
      
      toast({
        title: "Document téléchargé",
        description: `${label} a été téléchargé avec succès.`,
      });
      
      if (onUploadSuccess) {
        onUploadSuccess(url);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur de téléchargement",
        description: "Une erreur est survenue lors du téléchargement du fichier.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
        />
        
        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          size="sm"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Upload...
            </>
          ) : uploadedUrl ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Téléchargé
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Télécharger
            </>
          )}
        </Button>
      </div>
      
      {file && (
        <p className="text-xs text-muted-foreground">
          Fichier sélectionné: {file.name} ({(file.size / 1024).toFixed(2)} KB)
        </p>
      )}
      
      {uploadedUrl && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Check className="h-4 w-4" />
          <a
            href={uploadedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-green-700"
          >
            Voir le document
          </a>
        </div>
      )}
    </div>
  );
}
