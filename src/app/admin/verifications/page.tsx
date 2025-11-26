"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Eye, FileText } from "lucide-react";
import { Verification } from "@/types/firestore";

interface VerificationWithId extends Verification {
  id: string;
}

export default function AdminVerificationsPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [verifications, setVerifications] = useState<VerificationWithId[]>([]);
  const [loadingVerifications, setLoadingVerifications] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<VerificationWithId | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !userProfile || (userProfile.role !== "admin" && userProfile.role !== "sub_admin" && userProfile.role !== "manager"))) {
      router.push("/");
    }
  }, [user, userProfile, loading, router]);

  useEffect(() => {
    if (user && userProfile && (userProfile.role === "admin" || userProfile.role === "sub_admin" || userProfile.role === "manager")) {
      loadVerifications();
    }
  }, [user, userProfile]);

  const loadVerifications = async () => {
    setLoadingVerifications(true);
    try {
      const q = query(
        collection(db, "verifications"),
        where("status", "==", "pending")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as VerificationWithId[];
      setVerifications(data);
    } catch (error) {
      console.error("Load verifications error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les vérifications.",
        variant: "destructive",
      });
    } finally {
      setLoadingVerifications(false);
    }
  };

  const handleApprove = async (verification: VerificationWithId) => {
    if (!user) return;

    setProcessing(true);
    try {
      // Mettre à jour la vérification
      await updateDoc(doc(db, "verifications", verification.id), {
        status: "verified",
        reviewerId: user.uid,
        reviewerName: userProfile?.displayName || user.email,
        reviewedAt: serverTimestamp(),
        notes: reviewNotes,
      });

      // Mettre à jour le profil utilisateur
      const updates: any = {
        identityStatus: "verified",
      };

      // Si c'est un driver et que des documents véhicule sont présents
      if (
        verification.userRole === "driver" &&
        verification.metadata?.hasRegistration &&
        verification.metadata?.hasInsurance
      ) {
        updates.vehicleStatus = "verified";
      }

      await updateDoc(doc(db, "userProfiles", verification.userId), updates);

      toast({
        title: "Vérification approuvée",
        description: `L'utilisateur ${verification.userEmail} a été vérifié.`,
      });

      setSelectedVerification(null);
      setReviewNotes("");
      loadVerifications();
    } catch (error) {
      console.error("Approve verification error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'approuver la vérification.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (verification: VerificationWithId) => {
    if (!user || !rejectionReason) {
      toast({
        title: "Raison requise",
        description: "Veuillez fournir une raison de rejet.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      // Mettre à jour la vérification
      await updateDoc(doc(db, "verifications", verification.id), {
        status: "rejected",
        reviewerId: user.uid,
        reviewerName: userProfile?.displayName || user.email,
        reviewedAt: serverTimestamp(),
        rejectionReason: rejectionReason,
        notes: reviewNotes,
      });

      // Mettre à jour le profil utilisateur
      await updateDoc(doc(db, "userProfiles", verification.userId), {
        identityStatus: "rejected",
        rejectionReason: rejectionReason,
      });

      toast({
        title: "Vérification rejetée",
        description: `La demande de ${verification.userEmail} a été rejetée.`,
      });

      setSelectedVerification(null);
      setReviewNotes("");
      setRejectionReason("");
      loadVerifications();
    } catch (error) {
      console.error("Reject verification error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de rejeter la vérification.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading || loadingVerifications) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !userProfile) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Vérifications d&apos;identité en attente</h1>

      {verifications.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Aucune vérification en attente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {verifications.map((verification) => (
            <Card key={verification.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{verification.userEmail}</CardTitle>
                    <CardDescription>
                      Rôle: <Badge variant="outline">{verification.userRole}</Badge>
                    </CardDescription>
                    <CardDescription className="mt-1">
                      Soumis le:{" "}
                      {verification.createdAt instanceof Timestamp
                        ? verification.createdAt.toDate().toLocaleDateString("fr-FR")
                        : verification.createdAt instanceof Date
                        ? verification.createdAt.toLocaleDateString("fr-FR")
                        : "Date inconnue"}
                    </CardDescription>
                  </div>
                  <Badge>{verification.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documents fournis:
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      {verification.metadata?.hasIdFront ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span>ID Recto</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {verification.metadata?.hasIdBack ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span>ID Verso</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {verification.metadata?.hasSelfie ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span>Selfie</span>
                    </div>
                    {verification.userRole === "driver" && (
                      <>
                        <div className="flex items-center gap-1">
                          {verification.metadata?.hasRegistration ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span>Carte grise</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {verification.metadata?.hasInsurance ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span>Assurance</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {verification.documentUrls?.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Eye className="h-4 w-4" />
                      Voir document {idx + 1}
                    </a>
                  ))}
                </div>

                {selectedVerification?.id === verification.id ? (
                  <div className="space-y-3 pt-4 border-t">
                    <div>
                      <label className="block text-sm font-medium mb-1">Notes de révision</label>
                      <Textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Notes internes (optionnel)"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Raison de rejet (si applicable)</label>
                      <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Raison visible par l'utilisateur en cas de rejet"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleApprove(verification)} disabled={processing} variant="default">
                        {processing ? <Loader2 className="animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Approuver
                      </Button>
                      <Button onClick={() => handleReject(verification)} disabled={processing} variant="destructive">
                        {processing ? <Loader2 className="animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                        Rejeter
                      </Button>
                      <Button onClick={() => setSelectedVerification(null)} variant="outline">
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setSelectedVerification(verification)} variant="outline">
                    Réviser cette demande
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
