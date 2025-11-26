"use client";

import React from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Composant de test pour diagnostiquer la connexion Firebase Auth.
 * Affiche la config Firebase et permet un test rapide d'authentification.
 */
export default function FirebaseAuthTest() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [result, setResult] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ définie' : '✗ manquante',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '✗ manquante',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '✗ manquante',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✓ définie' : '✗ manquante',
  };

  const testAuth = async () => {
    if (!email || !password) {
      setResult('❌ Veuillez entrer email et mot de passe.');
      return;
    }
    setLoading(true);
    setResult('⏳ Tentative de connexion...');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setResult(`✅ Connexion réussie! UID: ${userCredential.user.uid}, Email: ${userCredential.user.email}`);
    } catch (error: any) {
      setResult(`❌ Erreur: ${error.code} - ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto my-8">
      <CardHeader>
        <CardTitle>🔧 Test Firebase Auth</CardTitle>
        <CardDescription>Diagnostic de connexion Firebase</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted p-4 rounded-md text-sm font-mono">
          <h3 className="font-semibold mb-2">Configuration Firebase (vars env):</h3>
          <ul className="space-y-1">
            <li>API Key: {config.apiKey}</li>
            <li>Auth Domain: {config.authDomain}</li>
            <li>Project ID: {config.projectId}</li>
            <li>App ID: {config.appId}</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Input
            type="email"
            placeholder="Email de test"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <Input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <Button onClick={testAuth} disabled={loading} className="w-full">
            {loading ? 'Test en cours...' : 'Tester la connexion'}
          </Button>
        </div>

        {result && (
          <div className={`p-3 rounded-md text-sm whitespace-pre-wrap ${
            result.includes('✅') ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : 
            result.includes('❌') ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' : 
            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
          }`}>
            {result}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Checks à faire si échec:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Variables manquantes dans .env.local → redémarrer <code>npm run dev</code></li>
            <li>Email/Password activé dans Firebase Console → Authentication</li>
            <li>Restrictions HTTP referer (Google Cloud Console) → autoriser localhost</li>
            <li>Utilisateur existe dans Firebase → Authentication → Users</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
