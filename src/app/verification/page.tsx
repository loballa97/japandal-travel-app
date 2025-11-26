"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { sendEmailVerification, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "@/lib/firebase";
import UploadDocument from "@/components/verification/UploadDocument";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Phone, CheckCircle, AlertCircle } from "lucide-react";

export default function VerificationPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [emailSent, setEmailSent] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [documents, setDocuments] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Initialiser RecaptchaVerifier pour la vérification téléphone
    if (typeof window !== "undefined" && !window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: () => {
            // reCAPTCHA résolu
          },
        });
      } catch (error) {
        console.error("RecaptchaVerifier error:", error);
      }
    }
  }, []);

  const handleSendEmailVerification = async () => {
    if (!user) return;

    try {
      await sendEmailVerification(user);
      setEmailSent(true);
      toast({
        title: "Email envoyé",
        description: "Vérifiez votre boîte de réception et cliquez sur le lien de vérification.",
      });
    } catch (error) {
      console.error("Email verification error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer l'email de vérification.",
        variant: "destructive",
      });
    }
  };

  const handleSendPhoneVerification = async () => {
    if (!phoneNumber || !window.recaptchaVerifier) return;

    setPhoneVerifying(true);
    try {
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      toast({
        title: "Code envoyé",
        description: "Entrez le code reçu par SMS.",
      });
    } catch (error) {
      console.error("Phone verification error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le code SMS. Vérifiez le numéro.",
        variant: "destructive",
      });
    } finally {
      setPhoneVerifying(false);
    }
  };

  const handleVerifyPhoneCode = async () => {
    if (!confirmationResult || !verificationCode) return;

    try {
      await confirmationResult.confirm(verificationCode);
      
      // Mettre à jour Firestore
      if (user) {
        await updateDoc(doc(db, "userProfiles", user.uid), {
          phoneVerified: true,
          phoneNumber: phoneNumber,
        });
      }

      toast({
        title: "Téléphone vérifié",
        description: "Votre numéro de téléphone est maintenant vérifié.",
      });
    } catch (error) {
      console.error("Phone code verification error:", error);
      toast({
        title: "Code invalide",
        description: "Le code entré est incorrect.",
        variant: "destructive",
      });
    }
  };

  const handleDocumentUpload = (docType: string, url: string) => {
    setDocuments((prev) => ({ ...prev, [docType]: url }));
  };

  const handleSubmitVerification = async () => {
    if (!user || !userProfile) return;

    // Validation minimale
    if (!documents.idFront || !documents.idBack || !documents.selfie) {
      toast({
        title: "Documents manquants",
        description: "Veuillez télécharger au minimum: ID recto, ID verso et selfie.",
        variant: "destructive",
      });
      return;
    }

    // Pour les drivers, vérifier documents véhicule
    if (userProfile.role === "driver" && (!documents.registrationDoc || !documents.insuranceDoc)) {
      toast({
        title: "Documents véhicule manquants",
        description: "Veuillez télécharger la carte grise et l'assurance.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Mettre à jour le profil avec les documents
      await updateDoc(doc(db, "userProfiles", user.uid), {
        documents: documents,
        identityStatus: "pending",
        vehicleStatus: userProfile.role === "driver" ? "pending" : "none",
      });

      // Créer une demande de vérification
      await addDoc(collection(db, "verifications"), {
        userId: user.uid,
        userEmail: user.email,
        userRole: userProfile.role,
        type: "identity",
        status: "pending",
        createdAt: serverTimestamp(),
        documentUrls: Object.values(documents),
        metadata: {
          hasIdFront: !!documents.idFront,
          hasIdBack: !!documents.idBack,
          hasSelfie: !!documents.selfie,
          hasRegistration: !!documents.registrationDoc,
          hasInsurance: !!documents.insuranceDoc,
        },
      });

      toast({
        title: "Demande envoyée",
        description: "Votre demande de vérification a été soumise. Un administrateur la traitera sous peu.",
      });

      router.push("/pending-approval");
    } catch (error) {
      console.error("Submit verification error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de soumettre la demande.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !userProfile) {
    return null;
  }

  const isDriver = userProfile.role === "driver";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Vérification d&apos;identité</h1>

      {/* Statuts actuels */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Statut de vérification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            {userProfile.emailVerified || user.emailVerified ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            )}
            <span>Email: {userProfile.emailVerified || user.emailVerified ? "Vérifié" : "Non vérifié"}</span>
          </div>
          <div className="flex items-center gap-2">
            {userProfile.phoneVerified ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            )}
            <span>Téléphone: {userProfile.phoneVerified ? "Vérifié" : "Non vérifié"}</span>
          </div>
          <div className="flex items-center gap-2">
            {userProfile.identityStatus === "verified" ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : userProfile.identityStatus === "pending" ? (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-gray-400" />
            )}
            <span>
              Identité: {userProfile.identityStatus === "verified" ? "Vérifiée" : userProfile.identityStatus === "pending" ? "En attente" : "Non vérifiée"}
            </span>
          </div>
          {isDriver && (
            <div className="flex items-center gap-2">
              {userProfile.vehicleStatus === "verified" ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : userProfile.vehicleStatus === "pending" ? (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-gray-400" />
              )}
              <span>
                Véhicule: {userProfile.vehicleStatus === "verified" ? "Vérifié" : userProfile.vehicleStatus === "pending" ? "En attente" : "Non vérifié"}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vérification Email */}
      {!(userProfile.emailVerified || user.emailVerified) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Vérification Email
            </CardTitle>
            <CardDescription>
              Vérifiez votre adresse email pour continuer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSendEmailVerification} disabled={emailSent}>
              {emailSent ? "Email envoyé" : "Envoyer l'email de vérification"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Vérification Téléphone */}
      {!userProfile.phoneVerified && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Vérification Téléphone
            </CardTitle>
            <CardDescription>
              Vérifiez votre numéro de téléphone avec un code SMS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div id="recaptcha-container"></div>
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="+33612345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={!!confirmationResult}
              />
              <Button onClick={handleSendPhoneVerification} disabled={phoneVerifying || !!confirmationResult}>
                {phoneVerifying ? <Loader2 className="animate-spin" /> : "Envoyer code"}
              </Button>
            </div>
            {confirmationResult && (
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Code SMS"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
                <Button onClick={handleVerifyPhoneCode}>Vérifier</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Documents */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Documents d&apos;identité</CardTitle>
          <CardDescription>
            Téléchargez vos documents pour vérification manuelle par un administrateur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UploadDocument
            userId={user.uid}
            userRole={userProfile.role === "driver" ? "drivers" : userProfile.role === "manager" ? "managers" : "clients"}
            documentType="idFront"
            label="Pièce d'identité (Recto)"
            currentUrl={userProfile.documents?.idFront}
            onUploadSuccess={(url) => handleDocumentUpload("idFront", url)}
            required
          />
          <UploadDocument
            userId={user.uid}
            userRole={userProfile.role === "driver" ? "drivers" : userProfile.role === "manager" ? "managers" : "clients"}
            documentType="idBack"
            label="Pièce d'identité (Verso)"
            currentUrl={userProfile.documents?.idBack}
            onUploadSuccess={(url) => handleDocumentUpload("idBack", url)}
            required
          />
          <UploadDocument
            userId={user.uid}
            userRole={userProfile.role === "driver" ? "drivers" : userProfile.role === "manager" ? "managers" : "clients"}
            documentType="selfie"
            label="Selfie (pour reconnaissance faciale)"
            accept="image/*"
            currentUrl={userProfile.documents?.selfie}
            onUploadSuccess={(url) => handleDocumentUpload("selfie", url)}
            required
          />

          {isDriver && (
            <>
              <UploadDocument
                userId={user.uid}
                userRole="drivers"
                documentType="registrationDoc"
                label="Carte grise du véhicule"
                currentUrl={userProfile.documents?.registrationDoc}
                onUploadSuccess={(url) => handleDocumentUpload("registrationDoc", url)}
                required
              />
              <UploadDocument
                userId={user.uid}
                userRole="drivers"
                documentType="insuranceDoc"
                label="Assurance du véhicule"
                currentUrl={userProfile.documents?.insuranceDoc}
                onUploadSuccess={(url) => handleDocumentUpload("insuranceDoc", url)}
                required
              />
              <UploadDocument
                userId={user.uid}
                userRole="drivers"
                documentType="driverLicense"
                label="Permis de conduire"
                currentUrl={userProfile.documents?.driverLicense}
                onUploadSuccess={(url) => handleDocumentUpload("driverLicense", url)}
              />
              <UploadDocument
                userId={user.uid}
                userRole="drivers"
                documentType="vtcLicense"
                label="Licence VTC (si applicable)"
                currentUrl={userProfile.documents?.vtcLicense}
                onUploadSuccess={(url) => handleDocumentUpload("vtcLicense", url)}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSubmitVerification} disabled={submitting} size="lg" className="w-full">
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Soumission...
          </>
        ) : (
          "Soumettre pour vérification"
        )}
      </Button>
    </div>
  );
}
